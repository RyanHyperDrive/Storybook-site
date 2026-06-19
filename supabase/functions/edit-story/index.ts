// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import {
  READING_LEVEL_TARGETS,
  validateStory,
  getAgeBand,
} from "../_shared/story.ts";

/**
 * POST /edit-story
 *
 * Second-pass story editor. Critiques the freshly written story against the
 * same craft bar the writer uses (one clear problem, child agency, ruled
 * magic, physical truth, state continuity, show-don't-tell, woven lesson,
 * distinct beats, sensory quality, earned ending, no em-dashes) and rewrites
 * only what the critique flags. The server gate (validateCritique) recomputes
 * needs_rewrite — never trust the model's own verdict. Persists the accepted
 * story to books.story_json and the final critique to books.story_review.
 * Never blocks the book: bails out gracefully after MAX_EDITOR_PASSES.
 *
 * Body: {
 *   bookId: string,
 *   story?: any,                  // optional override; else read books.story_json
 *   reading_level?: string,
 *   child_details?: string,
 *   favorites?: string,
 *   avoid?: string,
 *   parent_situation?: string,
 *   cast?: string[]
 * }
 */

const MAX_EDITOR_PASSES = 2;

const SCORE_KEYS = [
  "single_problem_clarity",
  "causal_chain",
  "child_agency",
  "magic_rule_consistency",
  "physical_plausibility",
  "state_continuity",
  "show_dont_tell",
  "lesson_woven",
  "distinct_beats",
  "sensory_quality",
  "earned_ending",
] as const;

const SCORE_THRESHOLDS: Record<string, number> = {
  single_problem_clarity: 0.85,
  causal_chain: 0.90,
  child_agency: 0.90,
  magic_rule_consistency: 0.90,
  physical_plausibility: 0.95,
  state_continuity: 0.95,
  show_dont_tell: 0.90,
  lesson_woven: 0.85,
  distinct_beats: 0.85,
  sensory_quality: 0.80,
  earned_ending: 0.90,
};

const HARD_FAIL_FLAGS = [
  "em_dash_present",
  "stated_moral_or_label_present",
  "physical_impossibility_present",
  "state_contradiction_present",
  "deus_ex_machina_present",
  "unruled_magic_present",
  "filler_page_present",
  "dangling_introduction_present",
] as const;

const EM_DASH_RE = /[—–]|--/;

function clamp01(n: unknown, fallback = 0): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(0, Math.min(1, x));
}

function arr(v: unknown): any[] {
  return Array.isArray(v) ? v : [];
}

function buildCritiqueSystemPrompt(ageBand: string): string {
  return `You are a senior children's book editor critiquing a finished story manuscript intended for ages ${ageBand}. Read the WHOLE story (all pages + the story_spine) and judge it against this craft bar exactly as a great picture-book editor would, page by page, with quote-level findings.

THE BAR (judge strictly against each):
1. ONE CLEAR CHILD-SIZED PROBLEM, set up early and kept as the spine of every page. No scenic tour with a problem bolted on at the end.
2. REAL CAUSE-AND-EFFECT every page. Each page happens because of the page before it; nothing changes without a shown cause a child can picture.
3. CHILD AGENCY. The child solves it through their OWN planted, believable action. Reject any resolution by luck, coincidence, a conveniently found object, an adult rescue, or a magic effect the child did not earn (deus ex machina).
4. RULED MAGIC. If the story has magic, there must be ONE simple stated cause-and-effect rule, introduced the first time magic appears and honored every time after. No one-off magical fixes, no unruled magic.
5. PHYSICAL PLAUSIBILITY. Anything not covered by the magic rule must obey the physical world a child already knows. No ball bouncing on grass/sand/carpet/bed; no living thing "drinking" light or "eating" colors; no sensory impossibility stated as bare fact.
6. STATE CONTINUITY. The STATE of the central problem (and of props/companions/outfits in a continuous setting) must never contradict from one page to the next unless THIS page's action caused the change. A thing shown unlit/stuck/sad cannot be fixed/lit/glowing on the next page without the child's action causing it on that page.
7. SHOW, DON'T TELL. No stated morals. No "she learned that…" / "and that's how X discovered the importance of…". No character labels ("he was a scientist and a helper"). Traits and meaning must be inferred from action, dialogue, sensation, and detail.
8. LESSON / PARENT SITUATION WOVEN NATURALLY. If a parent lesson or real situation was provided, it must be the hidden emotional spine — shown through specific feelings and small actions, NEVER named or moralized.
9. DISTINCT BEATS, NO FILLER, NO DANGLING INTROS. Every page is a new action, discovery, complication, decision, or emotional shift. No two pages share the same beat. Anything introduced (a squirrel, a prop, a friend) must matter later or stay clearly incidental — no dangling spotlights.
10. CONCRETE SENSORY QUALITY. Strong, picturable nouns and verbs; one true sensory image over generic sparkle. At most one glow/sparkle-type word per page, and only when earned.
11. EARNED ENDING. The last page resolves the exact opening problem and we FEEL the change in a concrete final image, not stated meaning.
12. NO EM-DASHES, en-dashes, or double-hyphens anywhere (title, subtitle, dedication, style_notes, page_text, beat).

Return STRICT JSON only — no markdown, no commentary — matching this schema EXACTLY:

{
  "scores": {
    "single_problem_clarity": 0,
    "causal_chain": 0,
    "child_agency": 0,
    "magic_rule_consistency": 0,
    "physical_plausibility": 0,
    "state_continuity": 0,
    "show_dont_tell": 0,
    "lesson_woven": 0,
    "distinct_beats": 0,
    "sensory_quality": 0,
    "earned_ending": 0
  },
  "flags": {
    "has_magic": false,
    "has_parent_lesson": false,
    "em_dash_present": false,
    "stated_moral_or_label_present": false,
    "physical_impossibility_present": false,
    "state_contradiction_present": false,
    "deus_ex_machina_present": false,
    "unruled_magic_present": false,
    "filler_page_present": false,
    "dangling_introduction_present": false
  },
  "declared_problem": "",
  "declared_magic_rule": "",
  "page_findings": [
    { "page_number": 1, "issue_types": [], "quote": "", "explanation": "", "fix_instruction": "" }
  ],
  "global_notes": [],
  "needs_rewrite": false,
  "overall_score": 0
}

Scoring rules:
- All scores are floats from 0.0 to 1.0 against THIS bar (not a generic "is it cute?" standard).
- Set flags.has_magic to true if any magical effect appears anywhere. Set flags.has_parent_lesson to true if the inputs include a parent situation/lesson to weave.
- page_findings: include only pages with real issues; each finding cites the offending quote and gives a concrete, page-addressed fix instruction (what to add/cut/rewrite, never a vague "make it better").
- Hard-fail flags (set to true when the corresponding craft violation is present anywhere): em_dash_present, stated_moral_or_label_present, physical_impossibility_present, state_contradiction_present, deus_ex_machina_present, unruled_magic_present, filler_page_present, dangling_introduction_present.
- needs_rewrite is your own verdict; the server will recompute it from the scores and flags.`;
}

function buildRewriteSystemPrompt(ageBand: string, targetPages: number, sentencesPerPage: string): string {
  return `You are a children's story editor. You will receive the full story JSON and a critique with page-addressed findings. Rewrite ONLY what the findings flag; preserve everything that works. KEEP THE EXACT SAME JSON SCHEMA, the same number of pages (${targetPages}), the same per-page sentence range (${sentencesPerPage}), the same age band (${ageBand}), the same story_spine object, the per-page "beat" field, and the no-em-dash rule (never use —, –, or --). Return the full corrected story JSON, strict JSON only — no markdown, no commentary.`;
}

function recompose(story: any, parentSituation: string, childDetails: string, favorites: string, avoid: string): string {
  return [
    `Child / main character: ${childDetails || "(none)"}`,
    `Parent situation / lesson to weave (NEVER name it, weave it as the hidden emotional spine): ${parentSituation || "(none provided)"}`,
    `Favorites to include: ${favorites || "(none)"}`,
    `Things to avoid: ${avoid || "(none)"}`,
    "",
    "FULL STORY JSON (critique this end-to-end):",
    JSON.stringify(story, null, 2),
  ].join("\n");
}

function emDashSweep(story: any): boolean {
  if (!story || typeof story !== "object") return false;
  for (const k of ["title", "subtitle", "dedication", "style_notes"]) {
    if (typeof story[k] === "string" && EM_DASH_RE.test(story[k])) return true;
  }
  if (Array.isArray(story.pages)) {
    for (const p of story.pages) {
      if (typeof p?.page_text === "string" && EM_DASH_RE.test(p.page_text)) return true;
      if (typeof p?.beat === "string" && EM_DASH_RE.test(p.beat)) return true;
    }
  }
  return false;
}

function validateCritique(raw: any, story: any): { critique: any } {
  const c: any = raw && typeof raw === "object" ? { ...raw } : {};
  const scoresIn = c.scores && typeof c.scores === "object" ? c.scores : {};
  const scores: Record<string, number> = {};
  for (const k of SCORE_KEYS) scores[k] = clamp01(scoresIn[k], 0);

  const flagsIn = c.flags && typeof c.flags === "object" ? c.flags : {};
  const flags: Record<string, boolean> = {
    has_magic: Boolean(flagsIn.has_magic),
    has_parent_lesson: Boolean(flagsIn.has_parent_lesson),
  };
  for (const f of HARD_FAIL_FLAGS) flags[f] = Boolean(flagsIn[f]);

  // If no magic, force magic-rule clean.
  if (!flags.has_magic) {
    scores.magic_rule_consistency = 1.0;
    flags.unruled_magic_present = false;
  }
  // If no parent lesson to weave, force lesson_woven clean.
  if (!flags.has_parent_lesson) {
    scores.lesson_woven = 1.0;
  }

  // Server-side em-dash sweep — never trust the model.
  if (emDashSweep(story)) flags.em_dash_present = true;

  // Recompute needs_rewrite server-side.
  let needs_rewrite = false;
  const failingScores: string[] = [];
  for (const k of SCORE_KEYS) {
    if (scores[k] < (SCORE_THRESHOLDS[k] ?? 0.85)) {
      needs_rewrite = true;
      failingScores.push(`${k} ${scores[k].toFixed(2)} < ${SCORE_THRESHOLDS[k]}`);
    }
  }
  const failingFlags: string[] = [];
  for (const f of HARD_FAIL_FLAGS) {
    if (flags[f]) {
      needs_rewrite = true;
      failingFlags.push(f);
    }
  }

  const overall = SCORE_KEYS.reduce((s, k) => s + scores[k], 0) / SCORE_KEYS.length;

  const page_findings = arr(c.page_findings)
    .map((f: any) => ({
      page_number: Number(f?.page_number) || 0,
      issue_types: arr(f?.issue_types).map(String),
      quote: typeof f?.quote === "string" ? f.quote : "",
      explanation: typeof f?.explanation === "string" ? f.explanation : "",
      fix_instruction: typeof f?.fix_instruction === "string" ? f.fix_instruction : "",
    }))
    .filter((f) => f.page_number > 0);

  const global_notes = arr(c.global_notes).map(String);

  return {
    critique: {
      scores,
      flags,
      declared_problem: typeof c.declared_problem === "string" ? c.declared_problem : "",
      declared_magic_rule: typeof c.declared_magic_rule === "string" ? c.declared_magic_rule : "",
      page_findings,
      global_notes,
      needs_rewrite,
      overall_score: Number(overall.toFixed(4)),
      failing_scores: failingScores,
      failing_flags: failingFlags,
    },
  };
}

function extractJson(raw: string): any {
  if (typeof raw !== "string") throw new Error("non-string content");
  let s = raw.trim();
  if (!s) throw new Error("empty content");
  // strip fences
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  if (!s) throw new Error("empty content after fence strip");
  try {
    return JSON.parse(s);
  } catch {
    const first = s.indexOf("{");
    const last = s.lastIndexOf("}");
    if (first === -1 || last <= first) throw new Error("no JSON object braces found");
    return JSON.parse(s.slice(first, last + 1));
  }
}

async function callGateway(systemPrompt: string, userPrompt: string, apiKey: string, label: string): Promise<any> {
  const MAX_ATTEMPTS = 3;
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let status = 0;
    let finishReason: string | undefined;
    let rawContent = "";
    try {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          response_format: { type: "json_object" },
          max_tokens: 4000,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });
      status = aiRes.status;
      if (!aiRes.ok) {
        const text = await aiRes.text();
        throw new Error(`AI gateway error ${aiRes.status}: ${text}`);
      }
      const payload = await aiRes.json();
      finishReason = payload?.choices?.[0]?.finish_reason;
      rawContent = payload?.choices?.[0]?.message?.content ?? "";
      const parsed = extractJson(rawContent);
      if (attempt > 1) console.log(`edit-story ${label} succeeded on attempt ${attempt}`);
      return parsed;
    } catch (e) {
      lastErr = e;
      console.warn(
        `edit-story ${label} attempt ${attempt}/${MAX_ATTEMPTS} failed: ${(e as Error).message} | status=${status} finish_reason=${finishReason ?? "n/a"} raw="${String(rawContent).slice(0, 500)}"`,
      );
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const { user, admin } = await requireUser(req);
    const body = await req.json();
    const {
      bookId,
      story: storyOverride,
      reading_level,
      child_details,
      favorites,
      avoid,
      parent_situation,
      // cast is accepted for signature parity with write-story but the editor
      // only critiques/rewrites the already-written story.
    } = body ?? {};

    if (!bookId) return errorResponse("bookId is required");

    const { data: book, error: bookErr } = await admin
      .from("books")
      .select("id, user_id, story_json, title, reading_level, story_review")
      .eq("id", bookId)
      .maybeSingle();
    if (bookErr) return errorResponse(bookErr.message, 500);
    if (!book || book.user_id !== user.id) return errorResponse("Book not found or forbidden", 403);

    let story: any = storyOverride ?? book.story_json;
    if (!story || typeof story !== "object" || !Array.isArray(story.pages)) {
      return errorResponse("No story to edit (books.story_json missing or invalid).", 412);
    }

    const lvl = String(reading_level ?? book.reading_level ?? "ages_4_6");
    const target = READING_LEVEL_TARGETS[lvl] ?? READING_LEVEL_TARGETS.ages_4_6;
    const ageBand = getAgeBand(lvl);
    const maxSentences = target.sentencesPerPage.includes("1")
      ? target.sentencesPerPage.includes("5") ? 5 : 3
      : 5;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return errorResponse("LOVABLE_API_KEY not configured", 500);

    const critiqueSystem = buildCritiqueSystemPrompt(ageBand);
    const rewriteSystem = buildRewriteSystemPrompt(ageBand, target.targetPages, target.sentencesPerPage);

    let lastGoodStory: any = story;
    let finalCritique: any = null;
    let passes = 0;
    let acceptedWithWarnings = false;

    // CRITIQUE → REWRITE loop. The editor must NEVER block the book; on any
    // unexpected failure we bail out keeping the last good story.
    try {
      // First critique (pass "0" — pre-rewrite)
      const userPrompt = recompose(
        lastGoodStory,
        String(parent_situation ?? ""),
        String(child_details ?? ""),
        String(favorites ?? ""),
        String(avoid ?? ""),
      );
      const rawCritique = await callGateway(critiqueSystem, userPrompt, LOVABLE_API_KEY, "critique");
      finalCritique = validateCritique(rawCritique, lastGoodStory).critique;

      while (finalCritique.needs_rewrite && passes < MAX_EDITOR_PASSES) {
        passes += 1;
        const rewriteUser = [
          `Age band: ${ageBand}. Pages: ${target.targetPages}. Sentences per page: ${target.sentencesPerPage}.`,
          `Parent situation (weave naturally, never name): ${String(parent_situation ?? "") || "(none)"}`,
          `Favorites to include: ${String(favorites ?? "") || "(none)"}`,
          `Things to avoid: ${String(avoid ?? "") || "(none)"}`,
          "",
          "CRITIQUE (page-addressed findings — rewrite only what's flagged, preserve everything else):",
          JSON.stringify(
            {
              page_findings: finalCritique.page_findings,
              global_notes: finalCritique.global_notes,
              failing_scores: finalCritique.failing_scores,
              failing_flags: finalCritique.failing_flags,
            },
            null,
            2,
          ),
          "",
          "CURRENT STORY JSON (rewrite this and return the FULL corrected story JSON):",
          JSON.stringify(lastGoodStory, null, 2),
        ].join("\n");

        let rewritten: any;
        try {
          rewritten = await callGateway(rewriteSystem, rewriteUser, LOVABLE_API_KEY, "rewrite");
        } catch (e) {
          console.warn("edit-story rewrite gateway error, keeping last good story:", (e as Error).message);
          break;
        }

        const check = validateStory(rewritten, target.targetPages, maxSentences);
        if (!check.ok) {
          console.warn("edit-story rewrite failed writer validation, discarding rewrite:", check.error);
          break;
        }
        lastGoodStory = check.data;

        // Re-critique the rewritten story.
        try {
          const nextRaw = await callGateway(
            critiqueSystem,
            recompose(
              lastGoodStory,
              String(parent_situation ?? ""),
              String(child_details ?? ""),
              String(favorites ?? ""),
              String(avoid ?? ""),
            ),
            LOVABLE_API_KEY,
          );
          finalCritique = validateCritique(nextRaw, lastGoodStory).critique;
        } catch (e) {
          console.warn("edit-story re-critique gateway error, accepting current story:", (e as Error).message);
          break;
        }
      }

      if (finalCritique?.needs_rewrite) acceptedWithWarnings = true;
    } catch (e: any) {
      // Critique itself failed — accept the original story with warnings.
      console.warn("edit-story critique error, accepting original story:", e?.message);
      acceptedWithWarnings = true;
      finalCritique = finalCritique ?? {
        scores: {},
        flags: {},
        page_findings: [],
        global_notes: [`editor error: ${e?.message ?? "unknown"}`],
        needs_rewrite: false,
        overall_score: 0,
      };
    }

    const review = {
      ...finalCritique,
      passes_used: passes,
      accepted: !acceptedWithWarnings,
      accepted_with_warnings: acceptedWithWarnings,
      edited_at: new Date().toISOString(),
    };

    // Persist accepted story + review. Best-effort.
    const { error: persistErr } = await admin
      .from("books")
      .update({
        story_json: lastGoodStory,
        title: lastGoodStory?.title ?? book.title,
        story_review: review,
      })
      .eq("id", bookId);
    if (persistErr) console.warn("edit-story persist warning:", persistErr.message);

    return jsonResponse({ ok: true, story: lastGoodStory, review });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("edit-story error", e);
    return errorResponse(e?.message ?? "Internal error", 500);
  }
});
