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

// Story length, tone, age safety, prompt construction, and validator live in
// ../_shared/story.ts so the second-pass editor can reuse them without
// importing this file's serve() and accidentally starting a second server.
import {
  READING_LEVEL_TARGETS,
  buildSystemPrompt,
  validateStory,
} from "../_shared/story.ts";

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
