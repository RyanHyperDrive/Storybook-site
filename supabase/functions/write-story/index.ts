// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";

/**
 * POST /write-story
 * Body: {
 *   theme: string,
 *   child_details: string,        // parent-provided main character info
 *   favorites?: string,           // parent-provided favorite things
 *   avoid?: string,               // parent-provided things to avoid
 *   bookId?: string               // optional: persist onto books.story_json
 * }
 *
 * Generates a warm, parent-approved children's storybook (ages 4-7).
 * Returns strict JSON: title, subtitle, dedication, style_notes, 10 pages.
 *
 * The model is told NOT to invent sensitive facts (health, family, religion,
 * location, school, etc.) beyond what the parent provided. Output is
 * schema-validated before returning.
 */

// Story length and tone are derived per-call from the requested reading_level
// (see READING_LEVEL_TARGETS below) so the same prompt template adapts from
// board-book voice (ages 2-3) up through early reader (ages 7-10).

type ReadingLevelTarget = {
  ageBand: string;
  minPages: number;
  targetPages: number;
  sentencesPerPage: string;
  toneNotes: string;
};

const READING_LEVEL_TARGETS: Record<string, ReadingLevelTarget> = {
  ages_2_3: {
    ageBand: "2-3",
    minPages: 8,
    targetPages: 8,
    sentencesPerPage: "exactly 1 very short sentence (under 10 words)",
    toneNotes:
      "Board-book voice. Repetition is welcome. Tiny vocabulary. Soft, simple ideas.",
  },
  ages_4_6: {
    ageBand: "4-6",
    minPages: 10,
    targetPages: 10,
    sentencesPerPage: "1 to 3 short read-aloud sentences",
    toneNotes:
      "Classic picture-book voice. Warm, calm, age-appropriate, positive resolution.",
  },
  ages_7_10: {
    ageBand: "7-10",
    minPages: 12,
    targetPages: 12,
    sentencesPerPage: "2 to 5 sentences",
    toneNotes:
      "Early-reader voice. Slightly richer vocabulary, gentle wit, light suspense, always a kind resolution.",
  },
};

// Legacy aliases kept so older books keep working.
READING_LEVEL_TARGETS.ages_3_5 = READING_LEVEL_TARGETS.ages_2_3;
READING_LEVEL_TARGETS.ages_4_7 = READING_LEVEL_TARGETS.ages_4_6;
READING_LEVEL_TARGETS.ages_6_8 = READING_LEVEL_TARGETS.ages_7_10;

function buildSystemPrompt(t: ReadingLevelTarget): string {
  return `You are a warm, gentle children's book author writing for ages ${t.ageBand}.

Use only the parent's provided details. Never invent sensitive facts the parent
did not provide (no health conditions, religion, family structure, location,
school, race/ethnicity, or personality traits beyond what is given).

Tone: ${t.toneNotes}
Avoid scary, violent, romantic, commercial, or competitive content.

Output STRICT JSON only — no markdown, no commentary. The JSON must match the
schema exactly:

{
  "title": "",
  "subtitle": "",
  "dedication": "",
  "style_notes": "",
  "pages": [
    {
      "page_number": 1,
      "page_text": "",
      "scene_description": "",
      "characters_present": [],
      "visual_must_haves": [],
      "visual_must_not_include": [],
      "continuity_notes": ""
    }
  ]
}

Rules:
- Exactly ${t.targetPages} entries in "pages", numbered 1 through ${t.targetPages}.
- Each "page_text" is ${t.sentencesPerPage}.
- "scene_description" describes the illustration in concrete, visual terms (no embedded text — all titles and page text are rendered by the app over the image).
- "visual_must_haves" lists key items/clothing/colors that must appear for continuity.
- "visual_must_not_include" lists anything to keep out (e.g. brands, scary creatures, weapons, any letters/words/logos in the image).
- "continuity_notes" tracks anything the next page must respect (time of day, outfit, companions).
- "style_notes" is a short note on the overall illustrative tone.
- Do NOT include a cover image description in pages — pages are story pages only.`;
}

const PAGE_KEYS = [
  "page_number",
  "page_text",
  "scene_description",
  "characters_present",
  "visual_must_haves",
  "visual_must_not_include",
  "continuity_notes",
];

function validateStory(
  obj: any,
  expectedPages: number,
  maxSentences: number,
): { ok: true; data: any } | { ok: false; error: string } {
  if (!obj || typeof obj !== "object") return { ok: false, error: "Not an object" };
  for (const k of ["title", "subtitle", "dedication", "style_notes"]) {
    if (typeof obj[k] !== "string") return { ok: false, error: `Field ${k} must be a string` };
  }
  if (!Array.isArray(obj.pages)) return { ok: false, error: "pages must be an array" };
  if (obj.pages.length !== expectedPages) {
    return { ok: false, error: `pages must have exactly ${expectedPages} entries (got ${obj.pages.length})` };
  }

  for (let i = 0; i < obj.pages.length; i++) {
    const p = obj.pages[i];
    if (!p || typeof p !== "object") return { ok: false, error: `Page ${i + 1} is not an object` };
    for (const k of PAGE_KEYS) {
      if (!(k in p)) return { ok: false, error: `Page ${i + 1} missing key: ${k}` };
    }
    if (p.page_number !== i + 1) return { ok: false, error: `Page ${i + 1} has wrong page_number (${p.page_number})` };
    if (typeof p.page_text !== "string" || !p.page_text.trim()) {
      return { ok: false, error: `Page ${i + 1} page_text must be a non-empty string` };
    }
    const sentenceCount = (p.page_text.match(/[.!?]+/g) ?? []).length;
    if (sentenceCount < 1 || sentenceCount > maxSentences + 1) {
      return { ok: false, error: `Page ${i + 1} sentence count out of range (found ~${sentenceCount}, max ${maxSentences})` };
    }
    for (const arrKey of ["characters_present", "visual_must_haves", "visual_must_not_include"]) {
      if (!Array.isArray(p[arrKey])) return { ok: false, error: `Page ${i + 1} ${arrKey} must be an array` };
    }
  }
  return { ok: true, data: obj };
}

function buildUserPrompt(input: {
  theme: string;
  child_details: string;
  favorites?: string;
  avoid?: string;
}): string {
  return [
    `Theme: ${input.theme}`,
    `Main character(s): ${input.child_details}`,
    `Favorite details to include: ${input.favorites?.trim() || "(none provided)"}`,
    `Details to avoid: ${input.avoid?.trim() || "(none provided)"}`,
    "",
    "Write the storybook now. Return strict JSON only.",
  ].join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const { user, admin } = await requireUser(req);
    const body = await req.json();
    const { theme, child_details, favorites, avoid, bookId, reading_level } = body ?? {};

    if (typeof theme !== "string" || !theme.trim()) return errorResponse("theme is required");
    if (typeof child_details !== "string" || !child_details.trim()) {
      return errorResponse("child_details is required");
    }

    const target =
      READING_LEVEL_TARGETS[String(reading_level ?? "ages_4_6")] ??
      READING_LEVEL_TARGETS.ages_4_6;
    const maxSentences = target.sentencesPerPage.includes("1")
      ? target.sentencesPerPage.includes("5")
        ? 5
        : 3
      : 5;

    // If bookId is supplied, verify ownership before we spend tokens.
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

    const userPrompt = buildUserPrompt({ theme, child_details, favorites, avoid });
    const SYSTEM_PROMPT = buildSystemPrompt(target);

    // Try up to 2 times if the model returns invalid JSON / wrong page count.
    let lastError = "";
    for (let attempt = 1; attempt <= 2; attempt++) {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt + (lastError ? `\n\nPrevious attempt failed validation: ${lastError}. Please fix and return strict JSON.` : "") },
          ],
        }),
      });

      if (!aiRes.ok) {
        const text = await aiRes.text();
        if (aiRes.status === 429) return errorResponse("Rate limit exceeded, try again shortly", 429);
        if (aiRes.status === 402) return errorResponse("AI credits exhausted", 402);
        return errorResponse(`AI gateway error: ${text}`, 502);
      }

      const payload = await aiRes.json();
      const raw: string = payload?.choices?.[0]?.message?.content ?? "";

      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
        try {
          parsed = JSON.parse(cleaned);
        } catch (e) {
          lastError = `invalid JSON: ${(e as Error).message}`;
          continue;
        }
      }

      const check = validateStory(parsed, target.targetPages, maxSentences);
      if (!check.ok) {
        lastError = check.error;
        continue;
      }

      // Persist if bookId provided (best-effort; ignore column-not-exist).
      if (bookId) {
        const { error: persistErr } = await admin
          .from("books")
          .update({ story_json: check.data, title: check.data.title })
          .eq("id", bookId);
        if (persistErr) console.warn("write-story persist warning:", persistErr.message);
      }

      return jsonResponse({ ok: true, story: check.data, attempt });
    }

    return errorResponse(`Story generation failed validation after retries: ${lastError}`, 502);
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("write-story error", e);
    return errorResponse(e?.message ?? "Internal error", 500);
  }
});
