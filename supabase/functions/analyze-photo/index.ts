// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { assertOwnership, requireUser } from "../_shared/auth.ts";

/**
 * POST /analyze-photo
 * Body: { childSubjectId: string }
 *
 * Runs a strict, safety-bounded vision analysis over the child_subject's
 * uploaded reference photo. Only visible appearance details needed for
 * illustration consistency are extracted. The model is explicitly told NOT
 * to infer race, ethnicity, health, personality, gender, or background.
 *
 * Output is persisted to child_subjects.photo_analysis (jsonb) for later
 * use by the character-sheet and page-illustration prompts.
 */

const SYSTEM_PROMPT = `You are helping create a safe, parent-approved illustrated storybook character from a child photo. The character must visually resemble THIS specific child — so a child with dark brown skin, tight coily hair, and a wide nose stays that way in the illustration, and a child with pale skin, freckles, and straight blonde hair stays that way. Faithful representation IS the safety requirement here; whitewashing, lightening skin, straightening textured hair, or shrinking ethnic facial features is a failure.

Analyze only visible, illustration-relevant appearance details. Do not name race, ethnicity, nationality, or health conditions. Do not guess personality, gender identity, or background. DO describe what you literally see in concrete visual terms an illustrator can match.

Return strict JSON:

{
  "skin_tone_for_illustration": "",
  "skin_undertone": "",
  "hair_color": "",
  "hair_texture": "",
  "hair_length_and_style": "",
  "eye_color": "",
  "eye_shape": "",
  "eyebrows": "",
  "nose_shape": "",
  "lip_shape": "",
  "face_shape": "",
  "visible_accessories": [],
  "expression": "",
  "outfit": "",
  "distinctive_visual_details": [],
  "uncertain_details": [],
  "photo_quality_notes": "",
  "do_not_infer": []
}

Guidance for each field:
- skin_tone_for_illustration: concrete illustrator-ready description (e.g., "deep cool brown", "warm medium tan", "fair with pink undertone", "rich dark brown with red highlights"). Never default to "light" or "tan" if the photo shows otherwise.
- skin_undertone: warm / cool / neutral / olive / golden / red — whichever the photo actually shows.
- hair_texture: literal pattern — "tight coils (4b/4c)", "springy curls (3b)", "loose waves (2a)", "pin-straight", "wavy with frizz", "locs", "braids", "twists", "buzzed", etc. Be specific. Textured hair MUST be recorded as textured, never softened to "wavy" when it is coily.
- hair_length_and_style: e.g., "shoulder-length two-strand twists", "short afro", "chin-length bob", "long ponytail".
- eye_shape / nose_shape / lip_shape: short literal shape descriptors only (e.g., "almond", "round", "wide", "narrow bridge", "full", "thin"). Do NOT use racialized or stereotyping language.
- distinctive_visual_details: freckles, dimples, glasses, hearing aid, cochlear implant, gap teeth, beauty mark, scar — anything an illustrator should preserve.
- uncertain_details: list anything you could not confidently read from the photo.

Empty string or empty array for fields you cannot safely answer.`;

const REQUIRED_KEYS = [
  "skin_tone_for_illustration",
  "skin_undertone",
  "hair_color",
  "hair_texture",
  "hair_length_and_style",
  "eye_color",
  "eye_shape",
  "eyebrows",
  "nose_shape",
  "lip_shape",
  "face_shape",
  "visible_accessories",
  "expression",
  "outfit",
  "distinctive_visual_details",
  "uncertain_details",
  "photo_quality_notes",
  "do_not_infer",
];

function validateAnalysis(obj: any): { ok: true; data: any } | { ok: false; error: string } {
  if (!obj || typeof obj !== "object") return { ok: false, error: "Not an object" };
  for (const k of REQUIRED_KEYS) {
    if (!(k in obj)) return { ok: false, error: `Missing key: ${k}` };
  }
  const arrayKeys = ["visible_accessories", "distinctive_visual_details", "uncertain_details", "do_not_infer"];
  for (const k of arrayKeys) {
    if (!Array.isArray(obj[k])) return { ok: false, error: `Key ${k} must be an array` };
  }
  return { ok: true, data: obj };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const { user, admin } = await requireUser(req);
    const { childSubjectId } = await req.json();
    if (!childSubjectId) return errorResponse("childSubjectId is required");

    const subject = await assertOwnership(admin, "child_subjects", childSubjectId, user.id);
    if (!subject.reference_storage_path) {
      return errorResponse("No reference photo uploaded for this subject");
    }

    // Sign the private reference photo so the model can fetch it.
    const { data: signed, error: signErr } = await admin.storage
      .from("raw-uploads")
      .createSignedUrl(subject.reference_storage_path, 60 * 5);

    if (signErr || !signed?.signedUrl) {
      return errorResponse(`Could not sign reference photo: ${signErr?.message ?? "unknown"}`, 500);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return errorResponse("LOVABLE_API_KEY not configured", 500);

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
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this child photo for illustration-only details. Return strict JSON matching the schema exactly. Use empty strings or empty arrays for fields you cannot safely answer, and list anything you are unsure about under uncertain_details.",
              },
              { type: "image_url", image_url: { url: signed.signedUrl } },
            ],
          },
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
      // Some models wrap JSON in code fences — strip and retry.
      const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch (e) {
        return errorResponse(`Model did not return valid JSON: ${(e as Error).message}`, 502);
      }
    }

    const check = validateAnalysis(parsed);
    if (!check.ok) {
      return errorResponse(`Analysis failed schema validation: ${check.error}`, 502);
    }

    const { error: updateErr } = await admin
      .from("child_subjects")
      .update({
        photo_analysis: check.data,
        photo_analyzed_at: new Date().toISOString(),
      })
      .eq("id", childSubjectId);

    if (updateErr) return errorResponse(`Failed to persist analysis: ${updateErr.message}`, 500);

    return jsonResponse({ ok: true, childSubjectId, analysis: check.data });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("analyze-photo error", e);
    return errorResponse(e?.message ?? "Internal error", 500);
  }
});
