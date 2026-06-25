// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { jsonrepair } from "https://esm.sh/jsonrepair@3";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";

/**
 * POST /write-story
 *
 * Best-of-N writer:
 *   1. Generate N candidate stories in parallel (different angles+temperatures).
 *   2. Validate each; survivors only.
 *   3. Ask a judge model to score each survivor on JUDGE_RUBRIC and set
 *      hard-fail flags.
 *   4. The SERVER deterministically picks the winner from the judge's scores
 *      (weighted sum + hard-fail disqualification + tie-breakers).
 *   5. On any judge/parse failure, fall back to a heuristic scorer. On any
 *      catastrophic failure, fall back to the single best surviving candidate.
 *      We NEVER 500 the book just because best-of-N machinery failed.
 *
 * The winning story is written to books.story_json + title exactly as today;
 * the audit trail goes to books.story_candidates. The existing editor pass
 * runs downstream unchanged.
 */

import {
  READING_LEVEL_TARGETS,
  buildSystemPrompt,
  validateStory,
  RHYME_MODULE,
  JUDGE_RUBRIC,
  buildJudgePrompt,
  EM_DASH_RE,
} from "../_shared/story.ts";

const CANDIDATE_COUNT = Number(Deno.env.get("WRITE_STORY_N")) || 3;
const WRITE_STORY_MERGE = false;
const PER_CANDIDATE_TIMEOUT_MS = 130_000;
const TOTAL_STEP_TIMEOUT_MS = 230_000;
const JUDGE_TIMEOUT_MS = 75_000;

type AngleSpec = { temperature: number; angle: string };
const ANGLES: AngleSpec[] = [
  {
    temperature: 0.7,
    angle:
      "Lean into the child's comfort object and build a gentle repeated refrain.",
  },
  {
    temperature: 0.9,
    angle:
      "Lean into a named pet or loved one and the child's funny quirk for warmth and humor.",
  },
  {
    temperature: 0.8,
    angle:
      "Lean into the real situation or feeling as the hidden emotional spine.",
  },
];

function pickAngles(n: number): AngleSpec[] {
  const out: AngleSpec[] = [];
  for (let i = 0; i < n; i++) out.push(ANGLES[i % ANGLES.length]);
  return out;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

function stripDashes(s: string): string {
  if (typeof s !== "string") return s;
  // Replace em/en/double-hyphen with a comma+space; collapse leftover spacing.
  return s.replace(/\s*(?:—|–|--)\s*/g, ", ").replace(/,\s*,/g, ",").trim();
}

function normalizeCandidate(story: any): any {
  if (!story || typeof story !== "object") return story;
  for (const k of ["title", "subtitle", "dedication", "style_notes"]) {
    if (typeof story[k] === "string" && EM_DASH_RE.test(story[k])) {
      story[k] = stripDashes(story[k]);
    }
  }
  if (Array.isArray(story.pages)) {
    for (const p of story.pages) {
      if (p && typeof p.page_text === "string" && EM_DASH_RE.test(p.page_text)) {
        p.page_text = stripDashes(p.page_text);
      }
      if (p && typeof p.beat === "string" && EM_DASH_RE.test(p.beat)) {
        p.beat = stripDashes(p.beat);
      }
    }
  }
  return story;
}

function extractJson(raw: string): any {
  if (typeof raw !== "string") throw new Error("non-string content");
  let s = raw.trim();
  if (!s) throw new Error("empty content");
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(s);
  } catch {
    const first = s.indexOf("{");
    const last = s.lastIndexOf("}");
    if (first !== -1 && last > first) {
      const sub = s.slice(first, last + 1);
      try { return JSON.parse(sub); } catch {
        try { return JSON.parse(jsonrepair(sub)); } catch { /* fall through */ }
      }
    }
    return JSON.parse(jsonrepair(s));
  }
}

function buildUserPrompt(input: {
  theme: string;
  child_details: string;
  favorites?: string;
  avoid?: string;
  cast?: string[];
  lesson?: string;
}): string {
  const cast = (input.cast ?? []).filter(Boolean);
  return [
    `Theme: ${input.theme}`,
    `Main character(s): ${input.child_details}`,
    cast.length
      ? `Approved cast (ONLY these named human characters may appear; "characters_present" on every page MUST be a subset of this list — do NOT invent siblings, friends, classmates, or other named humans not on this list): ${cast.join(", ")}. Animal companions and incidental background figures are fine but must remain unnamed.`
      : "",
    `Favorite details to include: ${input.favorites?.trim() || "(none provided)"}`,
    `Details to avoid: ${input.avoid?.trim() || "(none provided)"}`,
    `Lesson to gently teach (this is the HIDDEN emotional spine; show it through the child's specific feelings and one planted action that resolves it; NEVER name it, moralize, or break frame; and if the story subject above already states this lesson, do NOT also state it on the surface, keep it buried): ${input.lesson?.trim() || "(none provided)"}`,
    "",
    "Write the storybook now. Return strict JSON only.",
  ].filter(Boolean).join("\n");
}

// ---------------------------------------------------------------------------
// Provider abstraction (multi-model bake-off)
// ---------------------------------------------------------------------------

type Provider = "gemini" | "gpt" | "claude";

async function callModel(
  provider: Provider,
  opts: { system: string; user: string; temperature: number },
): Promise<string> {
  const { system, user, temperature } = opts;

  if (provider === "gemini") {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        response_format: { type: "json_object" },
        temperature,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`gemini gateway ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const payload = await res.json();
    return payload?.choices?.[0]?.message?.content ?? "";
  }

  if (provider === "gpt") {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
    const model = Deno.env.get("WRITE_STORY_GPT_MODEL") || "openai/gpt-5";
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`gpt gateway ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const payload = await res.json();
    return payload?.choices?.[0]?.message?.content ?? "";
  }

  if (provider === "claude") {
    const proxyBase = Deno.env.get("WRITER_CLAUDE_BASE_URL");
    const proxyKey = Deno.env.get("WRITER_CLAUDE_API_KEY");
    if (proxyBase && proxyKey) {
      const model = Deno.env.get("WRITER_CLAUDE_MODEL") || "claude-sonnet-4-6";
      const res = await fetch(proxyBase, {
        method: "POST",
        headers: { Authorization: `Bearer ${proxyKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          temperature,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        }),
      });
      if (!res.ok) throw new Error(`claude proxy ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
      const payload = await res.json();
      return payload?.choices?.[0]?.message?.content ?? "";
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const kieKey = Deno.env.get("KIE_API_KEY");
    if (!anthropicKey && !kieKey) {
      throw new Error("claude provider not configured");
    }

    const explicitBase = Deno.env.get("ANTHROPIC_BASE_URL");
    let base: string;
    let key: string;
    if (explicitBase) {
      base = explicitBase;
      key = anthropicKey || kieKey || "";
    } else if (anthropicKey) {
      base = "https://api.anthropic.com";
      key = anthropicKey;
    } else {
      base = "https://api.kie.ai/claude";
      key = kieKey!;
    }
    const isKie = base.includes("kie.ai");
    const url = base.replace(/\/$/, "") + "/v1/messages";
    const model = Deno.env.get("WRITER_CLAUDE_MODEL") || (isKie ? "claude-opus-4-5-20251101" : "claude-sonnet-4-6");
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
        ...(isKie ? { Authorization: `Bearer ${key}` } : { "x-api-key": key }),
      },
      body: JSON.stringify({
        model,
        max_tokens: 8000,
        temperature,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`claude native ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const payload = await res.json();
    const blocks = Array.isArray(payload?.content) ? payload.content : [];
    return blocks.map((b: any) => (typeof b?.text === "string" ? b.text : "")).join("");
  }


  throw new Error(`unknown provider: ${provider}`);
}

// ---------------------------------------------------------------------------
// Candidate generation
// ---------------------------------------------------------------------------

async function generateCandidate(opts: {
  provider?: Provider;
  systemPrompt: string;
  userPrompt: string;
  target: { targetPages: number; maxSentences: number };
  angle: string;
  temperature: number;
}): Promise<any | null> {
  const { systemPrompt, userPrompt, target, angle, temperature } = opts;
  const provider: Provider =
    opts.provider ?? ((Deno.env.get("WRITE_STORY_MODEL") as Provider) || "gemini");
  const fullUserPrompt =
    userPrompt +
    "\n\nANGLE FOR THIS DRAFT (make it genuinely distinct from other drafts): " +
    angle;
  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await callModel(provider, {
        system: systemPrompt,
        user:
          fullUserPrompt +
          (lastError
            ? `\n\nPrevious attempt failed validation: ${lastError}. Please fix and return strict JSON.`
            : ""),
        temperature,
      });
      let parsed: any;
      try { parsed = extractJson(raw); } catch (e) {
        lastError = `invalid JSON: ${(e as Error).message}`;
        continue;
      }
      const check = validateStory(parsed, target.targetPages, target.maxSentences);
      if (!check.ok) {
        lastError = check.error;
        continue;
      }
      return check.data;
    } catch (e: any) {
      console.warn(`write-story candidate error (${provider}):`, e?.message ?? e);
      return null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Judge + winner selection
// ---------------------------------------------------------------------------

type JudgeScores = Record<string, number>;
type JudgeFlags = {
  exemplar_echo?: boolean;
  object_renaming?: boolean;
  stated_moral?: boolean;
  age_inappropriate_dialogue?: boolean;
  forced_rhyme?: boolean;
};
type JudgeEntry = { index: number; scores: JudgeScores; flags: JudgeFlags; reason?: string };

const WEIGHTS: Record<string, number> = {
  warmth_and_charm: 0.18,
  specificity_personalization: 0.18,
  originality_vs_exemplar: 0.14,
  read_aloud_music: 0.12,
  child_agency_and_structure: 0.12,
  lesson_woven: 0.10,
  show_dont_tell: 0.06,
  literal_clarity: 0.06,
  age_fit: 0.04,
};

function weightedScore(scores: JudgeScores | undefined): number {
  if (!scores) return 0;
  let total = 0;
  for (const k of Object.keys(WEIGHTS)) {
    const v = Number(scores[k]);
    if (Number.isFinite(v)) total += v * WEIGHTS[k];
  }
  return total;
}

function isDisqualified(flags: JudgeFlags | undefined, rhymeOn: boolean): boolean {
  if (!flags) return false;
  if (flags.exemplar_echo) return true;
  if (flags.object_renaming) return true;
  if (flags.stated_moral) return true;
  if (flags.age_inappropriate_dialogue) return true;
  if (rhymeOn && flags.forced_rhyme) return true;
  return false;
}

async function judgeCandidates(opts: {
  apiKey: string;
  candidates: any[];
  ageBand: string;
  rhymeOn: boolean;
  childContext: string;
}): Promise<JudgeEntry[] | null> {
  const { apiKey, candidates, ageBand, rhymeOn, childContext } = opts;
  const system = buildJudgePrompt(ageBand, rhymeOn);
  const labelled = candidates
    .map(
      (c, i) =>
        `=== CANDIDATE INDEX ${i} ===\n${JSON.stringify(
          { title: c?.title, pages: (c?.pages ?? []).map((p: any) => ({ page_number: p?.page_number, page_text: p?.page_text })) },
        )}`,
    )
    .join("\n\n");
  const userMsg = `AGE BAND: ${ageBand}\nRHYME MODE: ${rhymeOn ? "ON" : "OFF"}\n\nCHILD AND STORY CONTEXT:\n${childContext}\n\nCANDIDATES TO SCORE (${candidates.length}):\n\n${labelled}\n\nReturn strict JSON only, matching the schema in the system prompt.`;
  try {
    const res = await withTimeout(
      fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          response_format: { type: "json_object" },
          temperature: 0.2,
          messages: [
            { role: "system", content: system },
            { role: "user", content: userMsg },
          ],
        }),
      }),
      JUDGE_TIMEOUT_MS,
      "judge",
    );
    if (!res.ok) {
      console.warn("write-story judge !ok status=", res.status);
      return null;
    }
    const payload = await res.json();
    const raw: string = payload?.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(raw);
    const arr = Array.isArray(parsed?.candidates) ? parsed.candidates : null;
    if (!arr) return null;
    const out: JudgeEntry[] = arr.map((e: any, i: number) => ({
      index: Number.isFinite(e?.index) ? Number(e.index) : i,
      scores: (e?.scores && typeof e.scores === "object") ? e.scores : {},
      flags: (e?.flags && typeof e.flags === "object") ? e.flags : {},
      reason: typeof e?.reason === "string" ? e.reason : "",
    }));
    return out;
  } catch (e: any) {
    console.warn("write-story judge error:", e?.message ?? e);
    return null;
  }
}

// HEURISTIC fallback (used only when the judge call/parse fails).
function heuristicScore(candidate: any, ctx: {
  childName: string;
  namedPeople: string[];
  comfortObject: string;
  rhymeOn: boolean;
  maxSentences: number;
}): number {
  const text = (candidate?.pages ?? [])
    .map((p: any) => String(p?.page_text ?? ""))
    .join("\n");
  if (!text) return 0;
  const lower = text.toLowerCase();
  let s = 0;
  if (ctx.childName && lower.includes(ctx.childName.toLowerCase())) s += 0.2;
  for (const n of ctx.namedPeople) {
    if (n && lower.includes(n.toLowerCase())) s += 0.08;
  }
  if (ctx.comfortObject && lower.includes(ctx.comfortObject.toLowerCase())) s += 0.12;
  // Refrain detection: any line that appears twice.
  const lines = text.split(/\n+/).map((l: string) => l.trim()).filter(Boolean);
  const counts = new Map<string, number>();
  for (const l of lines) counts.set(l, (counts.get(l) ?? 0) + 1);
  if ([...counts.values()].some((v) => v >= 2)) s += 0.15;
  // Sentence-length fit per page.
  let fit = 0; let total = 0;
  for (const p of candidate?.pages ?? []) {
    total++;
    const n = (String(p?.page_text ?? "").match(/[.!?]+/g) ?? []).length;
    if (n >= 1 && n <= ctx.maxSentences + 1) fit++;
  }
  if (total > 0) s += 0.15 * (fit / total);
  // Banned phrases penalty.
  if (/learned that|discovered the importance|the moral|the lesson/i.test(text)) s -= 0.3;
  // Cheap rhyme check (last-word matches between consecutive lines).
  if (ctx.rhymeOn) {
    let rh = 0; let pairs = 0;
    for (const p of candidate?.pages ?? []) {
      const pl = String(p?.page_text ?? "").split(/[.!?]+/).map((x: string) => x.trim()).filter(Boolean);
      for (let i = 0; i < pl.length - 1; i += 2) {
        pairs++;
        const a = (pl[i].match(/(\w+)\W*$/)?.[1] ?? "").toLowerCase();
        const b = (pl[i + 1].match(/(\w+)\W*$/)?.[1] ?? "").toLowerCase();
        if (a && b && (a === b || a.slice(-2) === b.slice(-2))) rh++;
      }
    }
    if (pairs > 0) s += 0.1 * (rh / pairs);
  }
  return s;
}

type Selection = {
  winnerIndex: number;
  selectedBy: "judge" | "heuristic" | "least_bad";
  judge?: JudgeEntry[];
};

function selectWinner(
  candidates: any[],
  judge: JudgeEntry[] | null,
  rhymeOn: boolean,
  heuristicCtx: Parameters<typeof heuristicScore>[1],
): Selection {
  if (candidates.length === 1) {
    return { winnerIndex: 0, selectedBy: judge ? "judge" : "heuristic", judge: judge ?? undefined };
  }

  // HEURISTIC fallback path.
  if (!judge || judge.length === 0) {
    const scored = candidates.map((c, i) => ({ i, s: heuristicScore(c, heuristicCtx) }));
    scored.sort((a, b) => b.s - a.s);
    return { winnerIndex: scored[0].i, selectedBy: "heuristic" };
  }

  // JUDGE path.
  // Build per-index judge entry map.
  const byIndex = new Map<number, JudgeEntry>();
  for (const e of judge) byIndex.set(e.index, e);

  type Row = { i: number; score: number; dq: boolean; entry: JudgeEntry | undefined };
  const rows: Row[] = candidates.map((_, i) => {
    const entry = byIndex.get(i);
    return {
      i,
      score: weightedScore(entry?.scores),
      dq: isDisqualified(entry?.flags, rhymeOn),
      entry,
    };
  });

  const clean = rows.filter((r) => !r.dq);
  const pool = clean.length > 0 ? clean : rows;
  const selectedBy: Selection["selectedBy"] = clean.length > 0 ? "judge" : "least_bad";

  pool.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aw = Number(a.entry?.scores?.warmth_and_charm ?? 0);
    const bw = Number(b.entry?.scores?.warmth_and_charm ?? 0);
    if (bw !== aw) return bw - aw;
    const asp = Number(a.entry?.scores?.specificity_personalization ?? 0);
    const bsp = Number(b.entry?.scores?.specificity_personalization ?? 0);
    if (bsp !== asp) return bsp - asp;
    const alc = Number(a.entry?.scores?.literal_clarity ?? 0);
    const blc = Number(b.entry?.scores?.literal_clarity ?? 0);
    return blc - alc;
  });

  return { winnerIndex: pool[0].i, selectedBy, judge };
}

// Detect "every candidate disqualified solely by forced_rhyme" — the signal
// for the rhyme-off fallback round.
function allFailedOnlyByForcedRhyme(judge: JudgeEntry[] | null): boolean {
  if (!judge || judge.length === 0) return false;
  let any = false;
  for (const e of judge) {
    const f = e.flags ?? {};
    if (!f.forced_rhyme) return false;
    if (f.exemplar_echo || f.object_renaming || f.stated_moral || f.age_inappropriate_dialogue) {
      // disqualified for some other reason too — handle via the usual least_bad path
      return false;
    }
    any = true;
  }
  return any;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const { user, admin } = await requireUser(req);
    const body = await req.json();
    const { theme, child_details, favorites, avoid, bookId, reading_level, cast, lesson, rhyme } = body ?? {};

    if (typeof theme !== "string" || !theme.trim()) return errorResponse("theme is required");
    if (typeof child_details !== "string" || !child_details.trim()) {
      return errorResponse("child_details is required");
    }

    const target =
      READING_LEVEL_TARGETS[String(reading_level ?? "ages_4_6")] ??
      READING_LEVEL_TARGETS.ages_4_6;
    const rhymeOn = rhyme === true;

    if (bookId) {
      const { data: bookRow, error: bookErr } = await admin
        .from("books")
        .select("id, user_id")
        .eq("id", bookId)
        .maybeSingle();
      if (bookErr) return errorResponse(bookErr.message, 500);
      if (!bookRow || bookRow.user_id !== user.id) return errorResponse("Book not found or forbidden", 403);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return errorResponse("LOVABLE_API_KEY not configured", 500);

    const castArr: string[] = Array.isArray(cast) ? cast : [];
    const lessonStr: string = typeof lesson === "string" ? lesson : "";
    const userPrompt = buildUserPrompt({
      theme,
      child_details,
      favorites,
      avoid,
      cast: castArr,
      lesson: lessonStr,
    });

    const baseSystem = buildSystemPrompt(target);
    const systemWithRhyme = rhymeOn ? baseSystem + "\n\n" + RHYME_MODULE : baseSystem;

    const childContext = [
      `Theme/subject: ${theme}`,
      `Main character(s): ${child_details}`,
      castArr.length ? `Approved cast: ${castArr.join(", ")}` : "",
      `Favorites: ${favorites || "(none)"}`,
      `Avoid: ${avoid || "(none)"}`,
      `Lesson: ${lessonStr || "(none)"}`,
    ].filter(Boolean).join("\n");

    // Cheap heuristic-context derivations (best-effort guesses).
    const childName = (castArr[0] ?? "").trim() ||
      (child_details.match(/^([A-Z][a-zA-Z'\-]+)/)?.[1] ?? "");
    const comfortObject = (favorites?.match(/\b(teddy|blanket|bunny|bear|doll|dinosaur|truck|book)\b/i)?.[1]) ?? "";

    // -------- generate candidates (best-of-N or bake-off) --------
    const BAKEOFF_FORCED_ON = true; // TEMP: bake-off testing — set back to false to return to normal single-model best-of-N
    const bakeoff =
      BAKEOFF_FORCED_ON || Deno.env.get("WRITE_STORY_BAKEOFF") === "true" || body?.bakeoff === true;
    const defaultProvider: Provider =
      (Deno.env.get("WRITE_STORY_MODEL") as Provider) || "gemini";


    const startedAt = Date.now();

    type CandidatePlan = { provider: Provider; angle: string; temperature: number };
    let plan: CandidatePlan[];
    if (bakeoff) {
      const neutralAngle =
        "Write your strongest possible version against the system rules. No special angle bias.";
      plan = (["gemini", "gpt", "claude"] as Provider[]).map((p) => ({
        provider: p,
        angle: neutralAngle,
        temperature: 0.8,
      }));
    } else {
      plan = pickAngles(CANDIDATE_COUNT).map((a) => ({
        provider: defaultProvider,
        angle: a.angle,
        temperature: a.temperature,
      }));
    }

    const generation = Promise.allSettled(
      plan.map((p) =>
        withTimeout(
          generateCandidate({
            provider: p.provider,
            systemPrompt: systemWithRhyme,
            userPrompt,
            target,
            angle: p.angle,
            temperature: p.temperature,
          }),
          PER_CANDIDATE_TIMEOUT_MS,
          `candidate:${p.provider}`,
        ).catch((e) => {
          console.warn(`candidate ${p.provider} timeout/err:`, e?.message ?? e);
          return null;
        }),
      ),
    );

    let settled: PromiseSettledResult<any>[];
    try {
      settled = await withTimeout(generation, TOTAL_STEP_TIMEOUT_MS, "best-of-N total");
    } catch (e: any) {
      console.warn("write-story total step timeout:", e?.message ?? e);
      settled = [];
    }

    type Survivor = { story: any; provider: Provider };
    let survivors: Survivor[] = settled
      .map((r, i) => {
        const story = r.status === "fulfilled" ? r.value : null;
        if (!story) return null;
        return { story: normalizeCandidate(story), provider: plan[i].provider };
      })
      .filter((v): v is Survivor => !!v);

    if (survivors.length === 0) {
      // Last resort: one plain gemini attempt with a generous timeout before giving up.
      const fb = await withTimeout(
        generateCandidate({
          provider: "gemini",
          systemPrompt: systemWithRhyme,
          userPrompt,
          target,
          angle: "Write your single strongest version against the rules.",
          temperature: 0.8,
        }),
        PER_CANDIDATE_TIMEOUT_MS,
        "fallback-candidate",
      ).catch(() => null);
      if (fb) {
        survivors = [{ story: normalizeCandidate(fb), provider: "gemini" }];
      } else {
        return errorResponse("Story generation failed validation after retries", 502);
      }
    }

    // Top up to >=2 with one sequential extra if needed (best-of-N mode only).
    if (!bakeoff && survivors.length < 2 && CANDIDATE_COUNT > 1) {
      const a = pickAngles(CANDIDATE_COUNT)[survivors.length % CANDIDATE_COUNT];
      const extra = await generateCandidate({
        provider: defaultProvider,
        systemPrompt: systemWithRhyme,
        userPrompt,
        target,
        angle: a.angle,
        temperature: a.temperature,
      }).catch(() => null);
      if (extra) survivors.push({ story: normalizeCandidate(extra), provider: defaultProvider });
    }

    let winningStory: any;
    let selection: Selection;
    let rhymeFallback = false;

    const survivorStories = () => survivors.map((s) => s.story);

    if (survivors.length === 1) {
      winningStory = survivors[0].story;
      selection = { winnerIndex: 0, selectedBy: "judge" };
    } else {
      const judge = await judgeCandidates({
        apiKey: LOVABLE_API_KEY,
        candidates: survivorStories(),
        ageBand: target.ageBand,
        rhymeOn,
        childContext,
      });

      // Rhyme-all-forced special case: re-run ONE more round with rhyme OFF.
      if (rhymeOn && judge && allFailedOnlyByForcedRhyme(judge) && !bakeoff) {
        console.log("write-story: all candidates failed only on forced_rhyme; running prose fallback round");
        const proseAngles = pickAngles(CANDIDATE_COUNT);
        const proseSettled = await Promise.allSettled(
          proseAngles.map((a) =>
            withTimeout(
              generateCandidate({
                provider: defaultProvider,
                systemPrompt: baseSystem,
                userPrompt,
                target,
                angle: a.angle,
                temperature: a.temperature,
              }),
              PER_CANDIDATE_TIMEOUT_MS,
              "prose-candidate",
            ).catch(() => null),
          ),
        );
        const proseSurvivors: Survivor[] = proseSettled
          .map((r) => (r.status === "fulfilled" ? r.value : null))
          .filter((v): v is any => !!v)
          .map((s) => ({ story: normalizeCandidate(s), provider: defaultProvider }));
        if (proseSurvivors.length > 0) {
          rhymeFallback = true;
          survivors = proseSurvivors;
          const proseJudge =
            proseSurvivors.length > 1
              ? await judgeCandidates({
                  apiKey: LOVABLE_API_KEY,
                  candidates: proseSurvivors.map((s) => s.story),
                  ageBand: target.ageBand,
                  rhymeOn: false,
                  childContext,
                })
              : null;
          selection = selectWinner(proseSurvivors.map((s) => s.story), proseJudge, false, {
            childName, namedPeople: castArr, comfortObject, rhymeOn: false, maxSentences: target.maxSentences,
          });
          winningStory = proseSurvivors[selection.winnerIndex].story;
        } else {
          selection = selectWinner(survivorStories(), judge, rhymeOn, {
            childName, namedPeople: castArr, comfortObject, rhymeOn, maxSentences: target.maxSentences,
          });
          winningStory = survivors[selection.winnerIndex].story;
        }
      } else {
        selection = selectWinner(survivorStories(), judge, rhymeOn, {
          childName, namedPeople: castArr, comfortObject, rhymeOn, maxSentences: target.maxSentences,
        });
        winningStory = survivors[selection.winnerIndex].story;
      }
    }

    void WRITE_STORY_MERGE; // merge disabled by design
    void JUDGE_RUBRIC;

    const elapsedMs = Date.now() - startedAt;
    console.log(
      `write-story ${bakeoff ? "bakeoff" : "best-of-N"}: ms=${elapsedMs} survivors=${survivors.length} selected_by=${selection.selectedBy} winner_index=${selection.winnerIndex} winner_model=${survivors[selection.winnerIndex]?.provider} rhyme_fallback=${rhymeFallback}`,
    );

    // Build audit payload (small).
    const judgeArr = selection.judge ?? null;
    const auditCandidates = survivors.map((s) => ({
      model: s.provider,
      title: s.story?.title ?? "",
      page_texts: (s.story?.pages ?? []).map((p: any) => String(p?.page_text ?? "")),
    }));
    const auditJudge = judgeArr
      ? {
          scores_by_candidate: judgeArr.map((e) => ({ index: e.index, scores: e.scores })),
          flags: judgeArr.map((e) => ({ index: e.index, flags: e.flags })),
          reasons: judgeArr.map((e) => ({ index: e.index, reason: e.reason ?? "" })),
        }
      : null;

    const auditPayload = {
      mode: bakeoff ? "bakeoff" : "best_of_n",
      n: survivors.length,
      winner_index: selection.winnerIndex,
      winner_model: survivors[selection.winnerIndex]?.provider ?? null,
      selected_by: selection.selectedBy,
      rhyme_fallback: rhymeFallback,
      judge: auditJudge,
      candidates: auditCandidates,
      merged: false,
      elapsed_ms: elapsedMs,
    };


    if (bookId) {
      const { error: persistErr } = await admin
        .from("books")
        .update({
          story_json: winningStory,
          title: winningStory.title,
          story_candidates: auditPayload,
        })
        .eq("id", bookId);
      if (persistErr) console.warn("write-story persist warning:", persistErr.message);
    }

    return jsonResponse({
      ok: true,
      story: winningStory,
      best_of_n: {
        n: survivors.length,
        winner_index: selection.winnerIndex,
        selected_by: selection.selectedBy,
        rhyme_fallback: rhymeFallback,
      },
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("write-story error", e);
    return errorResponse(e?.message ?? "Internal error", 500);
  }
});
