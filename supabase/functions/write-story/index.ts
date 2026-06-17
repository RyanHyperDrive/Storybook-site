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
 * Generates a warm, parent-approved children's storybook (ages 2-10).
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
  safetyClause: string;
};

// Hard age-band safety rules. These are enforced in BOTH the story prompt and
// the illustration prompt, and the validator scores age_appropriateness against
// the same band. Marketing copy alone is not enough — this is the gate.
const SAFETY_AGES_2_3 =
  "AGE SAFETY (ages 2-3): Very gentle and cozy. NO peril, NO scary villains, NO chase scenes, " +
  "NO separation anxiety, NO loss/grief, NO conflict beyond a tiny puzzle, NO loud/scary sounds, " +
  "NO mature themes, NO romance, NO weapons, NO injury. Always reassuring and warm. " +
  "Vocabulary must stay tiny and concrete (food, animals, colors, family, comfort objects).";
const SAFETY_AGES_4_6 =
  "AGE SAFETY (ages 4-6): Picture-book stakes only — small problem, kind helpers, reassuring resolution. " +
  "NO graphic danger, NO real fear/horror, NO shame or punishment framing, NO bullying as humor, " +
  "NO romance beyond family love, NO weapons, NO injury/blood, NO body-horror or scary imagery, " +
  "NO mature/adult themes, NO commercial brands. Conflict must resolve gently and on-page.";
const SAFETY_AGES_7_10 =
  "AGE SAFETY (ages 7-10): Slightly richer adventure is okay, but still child-safe. " +
  "NO gore, NO sexual or romantic content, NO self-harm, NO realistic violence, NO weapons used to harm, " +
  "NO bullying portrayed approvingly, NO substance use, NO adult themes, NO unsafe instructions " +
  "(fire, climbing alone, talking to strangers, ingesting things, etc.). Tension must resolve kindly.";

const READING_LEVEL_TARGETS: Record<string, ReadingLevelTarget> = {
  ages_2_3: {
    ageBand: "2-3",
    minPages: 8,
    targetPages: 8,
    sentencesPerPage: "exactly 1 very short sentence (under 10 words)",
    toneNotes:
      "Board-book voice. Repetition is welcome. Tiny vocabulary. Soft, simple ideas.",
    safetyClause: SAFETY_AGES_2_3,
  },
  ages_4_6: {
    ageBand: "4-6",
    minPages: 10,
    targetPages: 10,
    sentencesPerPage: "1 to 3 short read-aloud sentences",
    toneNotes:
      "Classic picture-book voice. Warm, calm, age-appropriate, positive resolution.",
    safetyClause: SAFETY_AGES_4_6,
  },
  ages_7_10: {
    ageBand: "7-10",
    minPages: 12,
    targetPages: 12,
    sentencesPerPage: "2 to 5 sentences",
    toneNotes:
      "Early-reader voice. Slightly richer vocabulary, gentle wit, light suspense, always a kind resolution.",
    safetyClause: SAFETY_AGES_7_10,
  },
};

export function getAgeSafetyClause(readingLevel: string | null | undefined): string {
  const key = String(readingLevel ?? "ages_4_6");
  return (READING_LEVEL_TARGETS[key] ?? READING_LEVEL_TARGETS.ages_4_6).safetyClause;
}
export function getAgeBand(readingLevel: string | null | undefined): string {
  const key = String(readingLevel ?? "ages_4_6");
  return (READING_LEVEL_TARGETS[key] ?? READING_LEVEL_TARGETS.ages_4_6).ageBand;
}

// Legacy aliases kept so older books keep working.
READING_LEVEL_TARGETS.ages_3_5 = READING_LEVEL_TARGETS.ages_2_3;
READING_LEVEL_TARGETS.ages_4_7 = READING_LEVEL_TARGETS.ages_4_6;
READING_LEVEL_TARGETS.ages_6_8 = READING_LEVEL_TARGETS.ages_7_10;

function buildSystemPrompt(t: ReadingLevelTarget): string {
  return `You are a master children's book author writing for ages ${t.ageBand}. You write books that adults love reading aloud and children ask for again. Your stories are warm, specific, and logically airtight: a curious child never has to ask "but how?" or "wait, didn't they just say...?"

Use only the parent's provided details. Never invent sensitive facts the parent did not provide (no health conditions, religion, family structure, location, school, race/ethnicity, or personality traits beyond what is given).

Tone: ${t.toneNotes}

${t.safetyClause}

This age safety rule is a HARD GATE. If the requested theme or parent details would push the story past it, soften, reframe, or redirect to a safer version of the same idea (still warm, still personalized). Never refuse, never produce unsafe content. Vocabulary, sentence complexity, emotional intensity, conflict level, humor, and themes must all stay inside the band for ages ${t.ageBand}.

================  HOW TO WRITE A GREAT STORY (read before writing)  ================

Before you write a single page, decide these and hold them fixed:
  - THE PROBLEM: one clear, child-sized thing the main character WANTS, and what is in the way. This is the spine of every page.
  - THE PLAN/SKILL: the interest, idea, or tool the child will use to solve it. You MUST plant this early (an interest the child shows, a thing they notice, a small ability) so the ending is earned, not lucky.
  - THE MAGIC RULE (only if the story has magic): ONE simple cause-and-effect rule a 4-year-old could predict, e.g. "the star-leaves glow brighter when someone is kind or sings to them." State or show this rule the first time magic appears, and obey it for the rest of the book.
  - THE FEELING: how the child feels at the start, the snag that makes them feel it, and how the feeling shifts because of what they DO.

Then write to these rules:

1. ONE PROBLEM, SET UP EARLY. The problem must appear by the end of the setup (first ~20% of pages) and stay the spine of every following page. Do NOT write a scenic tour with a problem bolted on near the end.

2. THE CHILD SOLVES IT. The main character resolves the problem through their OWN believable, concrete action using something the story established about THIS child. NEVER resolve with luck, coincidence, a conveniently found object, an adult rescue, or a magic effect the child did not earn. If a tool solves the story, it must appear earlier and the child must understand why it works.

3. REAL CAUSE AND EFFECT, EVERY PAGE. Each page happens because of the page before it. When anything changes (a tree gets light, a friend cheers up, a door opens), the CAUSE must be shown on that page or the one just before, and it must be something a child can picture. Never let an effect appear with no shown reason.

4. RULED MAGIC, NOT NONSENSE. If a magical detail would make a child ask "but how/why?", either give it the one-line in-world rule you chose above and honor it, or cut it. Never invent a one-off mechanism purely to fix the plot (e.g. a rock that "bounces starlight" to heal a tree). Never state a sensory impossibility as bare fact (leaves that "hum with light" for no reason).

5. PHYSICAL TRUTH. Anything not covered by your magic rule must obey the world a child already knows. A ball bounces on a hard floor, pavement, or a court, NOT on grass, sand, carpet, or a bed. Living things do not "drink" light or "eat" colors. Before you write an action, picture it really happening on that exact surface.

6. NEVER CONTRADICT THE STATE. Track the STATE of the central problem as strictly as you track outfits. A thing cannot be unlit/stuck/sad on one page and already fixed/lit/glowing on the next unless the child's action on THAT page caused the change. Carry the current state in "continuity_notes" and never break it.

7. SHOW, DON'T TELL. Convey traits, feelings, and meaning only through action, dialogue, body sensation, and concrete detail. NEVER state a label or moral. BANNED endings and lines like: "He was a scientist and a helper," "She learned that sharing is caring," "And that's how X discovered the importance of...". Let the child observe, try, struggle, and succeed so the reader infers the trait themselves.

8. WEAVE THE PARENT'S LESSON / REAL SITUATION NATURALLY. If the parent gave a lesson or real situation (e.g. nervous about kindergarten, learning to share, loves dinosaurs), make it the hidden emotional spine: show it as the character's specific feelings and small actions (a flutter in the tummy, a deep breath, one brave step; a dinosaur fact that helps them solve the problem). NEVER name the lesson, never moralize, never break the frame to address the child or parent.

9. EVERY PAGE A DISTINCT BEAT. Each page is a new action, discovery, complication, decision, or emotional shift. No two pages may hit the same beat, and no page may be decorative filler. Before finalizing, check: if you removed a page, would the story break? If not, replace it with a real beat. Anything you introduce (a squirrel, a prop, a friend) must either matter later or stay clearly incidental background, no dangling spotlights.

10. EARN THE EMOTIONAL TURN AND THE ENDING. Establish the want and feeling, hit a real (age-safe) snag and feel it, then let the feeling shift as a RESULT of what the child does. The last page resolves the exact problem from the opening, and we FEEL the change in a concrete final image rather than being told its meaning.

11. WRITE FOR THE ADULT'S MOUTH AND THE CHILD'S EAR. Vary sentence length and shape, build gentle rhythm, use strong concrete verbs and nouns a child can picture. Favor one true sensory image (rough bark under a palm, the squeak of a ball on a gym floor, the cool hush of shade) over generic sparkle. Use NO MORE THAN ONE glow/sparkle-type word per page ("glowing," "sparkly," "shiny," "magical," "shimmering"), and only when earned. Avoid clichéd filler ("a friendly squirrel with a sparkly tail chittered hello").

12. NO EM-DASHES. Never use an em-dash, en-dash, or double-hyphen anywhere in title, subtitle, dedication, style_notes, page_text, or any field. Use a period, a comma, or the word "and." Rewrite any sentence that wants a dash into shorter sentences.

================  OUTPUT FORMAT  ================

Output STRICT JSON only, no markdown, no commentary. The JSON must match the schema exactly:

{
  "title": "",
  "subtitle": "",
  "dedication": "",
  "style_notes": "",
  "story_spine": {
    "problem": "",
    "child_plan_or_skill": "",
    "magic_rule": "",
    "emotional_arc": ""
  },
  "pages": [
    {
      "page_number": 1,
      "page_text": "",
      "beat": "",
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
- Each "page_text" is ${t.sentencesPerPage}, age-appropriate for ages ${t.ageBand}.
- "story_spine" states the single problem, the child's planted plan/skill, the one magic rule (or "none" if the story has no magic), and the emotional arc. Every page must serve this spine.
- "beat" is a 2-6 word label for THIS page's distinct story beat (e.g. "setup: the want", "first attempt fails", "discovers the rule", "the brave choice", "earned resolution"). No two pages may share the same beat.
- NARRATIVE ARC (mandatory): the pages MUST form a clear arc, setup (first ~20%), inciting nudge, rising action with at least one small challenge or discovery, an emotional turning point, and a warm resolution on the final page. No filler pages, no random vignettes, every page advances the same single story along the cause-and-effect chain.
- CONTINUITY (mandatory): outfits, companions, props, time of day, setting, AND the STATE of the central problem introduced on one page must remain consistent on the next unless the text explicitly changes them and shows the cause of the change. Use "continuity_notes" to carry state forward, including the current state of the problem (e.g. "the little tree is still in shadow, not yet lit").
- "scene_description" MUST be richly visual and concrete (specific actions, poses, expressions, props, setting, time of day, weather, lighting) so the illustrator can render the page from this text alone. It must literally depict what "page_text" describes, the image and text must show the same moment. Do NOT embed any text in the image; all titles and page text are rendered by the app over the image. It must itself be age-safe for ages ${t.ageBand}.
- "visual_must_haves" lists key items/clothing/colors that must appear. ALWAYS state the character's clothing for THIS page as one of the entries (choose scene-appropriate clothing, e.g. pajamas for a bedtime scene, a costume or armor when the story calls for it, swimwear at the pool, falling back to the character's everyday outfit when the scene doesn't call for anything specific). Keep clothing consistent from page to page within the same continuous setting; when the scene/setting changes, change the clothing to fit and call that out.
- "visual_must_not_include" MUST always include items that would violate the age band (e.g. for 2-3: "no scary creatures, no weapons, no darkness/peril"; for 4-6: "no weapons, no injury, no scary monsters, no romantic framing"; for 7-10: "no weapons used to harm, no blood/gore, no mature themes") in addition to anything else to keep out (brands, text in image, logos).
- "continuity_notes" tracks anything the next page must respect (time of day, current outfit/clothing, companions, location, prop in hand, AND the current state of the central problem). Always carry the current page's clothing forward so the next page can keep it consistent until the scene changes.
- "style_notes" is a short note on the overall illustrative tone.
- Do NOT include a cover image description in pages, pages are story pages only.

================  SELF-CHECK BEFORE YOU RETURN  ================

Silently reread every page and fix any violation before returning JSON:
(1) Is anything physically impossible for its surface/material (ball on grass, tree drinking light)?
(2) Does any magic act without your stated rule, or break it?
(3) Does any page contradict the prior page's state (problem shown fixed then still broken, or vice versa)?
(4) Is any lesson, moral, or trait STATED instead of shown?
(5) Is the resolution driven by the child's own planted action, not luck or a found object?
(6) Are there any em-dashes, en-dashes, or double-hyphens anywhere?
(7) Is any page decorative filler, or do any two pages hit the same beat?
(8) Did you introduce anything (character/prop) that then dangles unused?
Return JSON only after all eight are clean.`;
}

const PAGE_KEYS = [
  "page_number",
  "page_text",
  "beat",
  "scene_description",
  "characters_present",
  "visual_must_haves",
  "visual_must_not_include",
  "continuity_notes",
];

const EM_DASH_RE = /[—–]|--/;

function validateStory(
  obj: any,
  expectedPages: number,
  maxSentences: number,
): { ok: true; data: any } | { ok: false; error: string } {
  if (!obj || typeof obj !== "object") return { ok: false, error: "Not an object" };
  for (const k of ["title", "subtitle", "dedication", "style_notes"]) {
    if (typeof obj[k] !== "string") return { ok: false, error: `Field ${k} must be a string` };
    if (EM_DASH_RE.test(obj[k])) {
      return { ok: false, error: `Field ${k} contains a forbidden em-dash/en-dash/double-hyphen; rewrite without dashes.` };
    }
  }
  if (!obj.story_spine || typeof obj.story_spine !== "object" || Array.isArray(obj.story_spine)) {
    return { ok: false, error: "story_spine must be an object" };
  }
  for (const k of ["problem", "child_plan_or_skill", "magic_rule", "emotional_arc"]) {
    if (typeof obj.story_spine[k] !== "string") {
      return { ok: false, error: `story_spine.${k} must be a string` };
    }
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
    if (typeof p.beat !== "string" || !p.beat.trim()) {
      return { ok: false, error: `Page ${i + 1} beat must be a non-empty string` };
    }
    if (EM_DASH_RE.test(p.page_text)) {
      return { ok: false, error: `Page ${i + 1} page_text contains a forbidden em-dash/en-dash/double-hyphen; rewrite without dashes.` };
    }
    if (EM_DASH_RE.test(p.beat)) {
      return { ok: false, error: `Page ${i + 1} beat contains a forbidden em-dash/en-dash/double-hyphen; rewrite without dashes.` };
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
  cast?: string[];
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
    "",
    "Write the storybook now. Return strict JSON only.",
  ].filter(Boolean).join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const { user, admin } = await requireUser(req);
    const body = await req.json();
    const { theme, child_details, favorites, avoid, bookId, reading_level, cast } = body ?? {};

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

    const userPrompt = buildUserPrompt({ theme, child_details, favorites, avoid, cast: Array.isArray(cast) ? cast : [] });
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
          model: "google/gemini-2.5-pro",
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
