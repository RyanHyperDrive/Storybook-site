// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { assertOwnership, requireUser } from "../_shared/auth.ts";

const KIE_CREATE_URL = "https://api.kie.ai/api/v1/jobs/createTask";
const KIE_INFO_URL = "https://api.kie.ai/api/v1/jobs/recordInfo";
const KIE_MODEL = "gpt-image-2-image-to-image";
const RAW_BUCKET = "raw-uploads";
const CHARACTER_BUCKET = "character-sheets";

const STYLE_ANCHORS: Record<string, string> = {
  watercolor_adventure:
    "Children's book watercolor illustration, soft pastel washes, visible warm paper texture, gentle ink accents, premium bedtime story feel, no readable text in image.",
  soft_cartoon:
    "Soft modern cartoon illustration for a children's storybook, clean rounded shapes, large expressive eyes, friendly proportions, bright balanced colors, smooth gradients, premium preschool animation feel, no readable text in image.",
  comic_book:
    "Kid-friendly adventure comic illustration, bold ink outlines, cozy vivid colors, expressive pose, no speech bubbles, no captions, no readable text, no weapons, no scary peril.",
  manga_inspired:
    "Manga-inspired children's storybook illustration, expressive large eyes, clean precise linework, dynamic but gentle composition, age-appropriate soft mood, no readable text in image.",
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function buildDescription(child: any, analysis: any) {
  return [
    child?.personality_traits,
    child?.favorite_color ? `favorite color: ${child.favorite_color}` : null,
    analysis?.skin_tone_for_illustration ? `skin: ${analysis.skin_tone_for_illustration}` : null,
    analysis?.skin_undertone ? `skin undertone: ${analysis.skin_undertone}` : null,
    analysis?.hair_color || analysis?.hair_texture || analysis?.hair_length_and_style
      ? `hair: ${[analysis.hair_color, analysis.hair_texture, analysis.hair_length_and_style].filter(Boolean).join(", ")}`
      : null,
    analysis?.eye_color || analysis?.eye_shape
      ? `eyes: ${[analysis.eye_color, analysis.eye_shape].filter(Boolean).join(", ")}`
      : null,
    analysis?.nose_shape ? `nose: ${analysis.nose_shape}` : null,
    analysis?.lip_shape ? `lips: ${analysis.lip_shape}` : null,
    analysis?.face_shape ? `face: ${analysis.face_shape}` : null,
    analysis?.visible_accessories?.length ? `accessories: ${analysis.visible_accessories.join(", ")}` : null,
    analysis?.distinctive_visual_details?.length
      ? `visual details: ${analysis.distinctive_visual_details.join(", ")}`
      : null,
    "warm friendly expression, consistent across scenes",
  ]
    .filter(Boolean)
    .join("; ");
}

function resultUrlsFrom(data: any): string[] {
  const raw = data?.resultJson ?? data?.result_json ?? data?.result;
  if (!raw) return data?.resultUrls ?? data?.result_urls ?? [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return parsed?.resultUrls ?? parsed?.result_urls ?? [];
  } catch {
    return [];
  }
}

/**
 * POST /create-character-sheet
 * Body: { childSubjectId: string }
 *
 * - Validates the caller and ownership of the child_subject row.
 * - Marks the row as "generating".
 * - Calls Kie.ai to render the character sheet (TODO: wire actual prompt + photo).
 * - Persists the resulting image URL onto the row.
 *
 * Long-running? No — this should resolve in under ~60s. If Kie.ai polling
 * exceeds that, move the polling loop into start-book-generation's job runner.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  let childSubjectId: string | undefined;
  let adminForError: any = null;
  try {
    const { user, admin } = await requireUser(req);
    adminForError = admin;
    ({ childSubjectId } = await req.json());
    if (!childSubjectId) return errorResponse("childSubjectId is required");

    const subject = await assertOwnership(admin, "child_subjects", childSubjectId, user.id);
    if (!subject.reference_storage_path) {
      return errorResponse("No reference photo uploaded for this child", 400);
    }

    const { data: signed, error: signErr } = await admin.storage
      .from(RAW_BUCKET)
      .createSignedUrl(subject.reference_storage_path, 60 * 10);
    if (signErr || !signed?.signedUrl) {
      return errorResponse(`Could not prepare reference photo: ${signErr?.message ?? "unknown"}`, 500);
    }

    const { data: child } = subject.child_profile_id
      ? await admin.from("child_profiles").select("*").eq("id", subject.child_profile_id).maybeSingle()
      : { data: null } as any;
    const { data: book } = child?.book_id
      ? await admin.from("books").select("art_style, is_twins").eq("id", child.book_id).maybeSingle()
      : { data: null } as any;
    const styleKey = book?.art_style ?? "soft_cartoon";
    const styleAnchor = STYLE_ANCHORS[styleKey] ?? STYLE_ANCHORS.soft_cartoon;
    const analysis = subject.photo_analysis ?? {};
    const hairDesc = [analysis?.hair_color, analysis?.hair_texture, analysis?.hair_length_and_style]
      .filter(Boolean).join(", ");
    const eyeDesc = [analysis?.eye_color, analysis?.eye_shape].filter(Boolean).join(", ");
    const distinct = Array.isArray(analysis?.distinctive_visual_details)
      ? analysis.distinctive_visual_details.filter(Boolean).join(", ") : "";
    const prompt = [
      `Create a polished illustrated character sheet for ${child?.name ?? "the child"}.`,
      styleAnchor,
      "FIDELITY TO THE REFERENCE PHOTO (HARD GATE): the illustrated child must visually resemble the real child in the photo. Match skin tone and undertone EXACTLY — do not lighten, brighten, desaturate, or shift the skin toward beige/peach defaults. Preserve hair texture exactly (coily hair stays coily, curly stays curly, straight stays straight — never straighten or loosen textured hair). Preserve nose, lip, eye shape and facial proportions. Preserve any visible accessibility devices (glasses, hearing aids, cochlear implants). Do not Westernize or anglicize features. Do not infer race or ethnicity, but DO render what the photo literally shows.",
      analysis?.skin_tone_for_illustration ? `Skin tone (match exactly): ${analysis.skin_tone_for_illustration}${analysis?.skin_undertone ? `, ${analysis.skin_undertone} undertone` : ""}.` : "",
      hairDesc ? `Hair (match exactly): ${hairDesc}.` : "",
      eyeDesc ? `Eyes: ${eyeDesc}.` : "",
      analysis?.nose_shape ? `Nose shape: ${analysis.nose_shape}.` : "",
      analysis?.lip_shape ? `Lip shape: ${analysis.lip_shape}.` : "",
      analysis?.face_shape ? `Face shape: ${analysis.face_shape}.` : "",
      analysis?.eyebrows ? `Eyebrows: ${analysis.eyebrows}.` : "",
      distinct ? `Preserve these distinctive details: ${distinct}.` : "",
      analysis?.outfit ? `Reference outfit: ${analysis.outfit}.` : "",
      child?.favorite_color ? `Include a tasteful outfit accent in ${child.favorite_color}.` : "",
      child?.accessibility_details ? `Include these parent-provided details: ${child.accessibility_details}.` : "",
      "Single full-body child character, plain warm off-white background, friendly bedtime storybook mood, no UI, no text, no labels, no watermark.",
    ].filter(Boolean).join("\n");

    await admin
      .from("child_subjects")
      .update({ status: "generating", error_message: null })
      .eq("id", childSubjectId);

    const KIE_API_KEY = Deno.env.get("KIE_API_KEY");
    if (!KIE_API_KEY) return errorResponse("KIE_API_KEY is not configured", 500);

    const createRes = await fetch(KIE_CREATE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: KIE_MODEL,
        input: {
          prompt,
          input_urls: [signed.signedUrl],
          aspect_ratio: "3:4",
          resolution: "1K",
        },
      }),
    });
    const createJson: any = await createRes.json().catch(() => ({}));
    const taskId = createJson?.data?.taskId ?? createJson?.data?.task_id ?? createJson?.taskId;
    if (!createRes.ok || !taskId) {
      throw new Error(`Image generation did not start: ${JSON.stringify(createJson).slice(0, 300)}`);
    }

    let sourceUrl: string | null = null;
    for (let attempt = 0; attempt < 18; attempt++) {
      await sleep(5000);
      const infoRes = await fetch(`${KIE_INFO_URL}?taskId=${encodeURIComponent(taskId)}`, {
        headers: { Authorization: `Bearer ${KIE_API_KEY}` },
      });
      const infoJson: any = await infoRes.json().catch(() => ({}));
      const data = infoJson?.data ?? {};
      const state = data.state ?? data.status;
      if (state === "success" || state === "completed") {
        sourceUrl = resultUrlsFrom(data)[0] ?? null;
        break;
      }
      if (state === "fail" || state === "failed") {
        throw new Error(data.failMsg || data.errorMessage || "Image generation failed");
      }
    }
    if (!sourceUrl) throw new Error("Image generation is taking longer than expected. Please try again.");

    const imgRes = await fetch(sourceUrl);
    if (!imgRes.ok) throw new Error(`Generated image download failed (${imgRes.status})`);
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    const imagePath = `${user.id}/${childSubjectId}-${Date.now()}.png`;
    const { error: uploadErr } = await admin.storage
      .from(CHARACTER_BUCKET)
      .upload(imagePath, bytes, { contentType: "image/png", upsert: true });
    if (uploadErr) throw new Error(`Could not save generated character: ${uploadErr.message}`);

    const image_url = imagePath;
    const description = buildDescription(child, analysis);

    // ── Vision-derived structured analysis of the generated sheet itself ──
    // Replaces brittle regex extraction in buildContract. We re-read the image
    // we just produced and ask Gemini for a strict JSON breakdown of the
    // canonical look. Stored on child_subjects.photo_analysis (merged with
    // any existing analysis from the raw photo). Best-effort: failures here
    // never block sheet creation.
    let mergedAnalysis: any = analysis ?? {};
    try {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        const { data: sheetSigned } = await admin.storage
          .from(CHARACTER_BUCKET)
          .createSignedUrl(imagePath, 60 * 5);
        const sheetUrlForVision = sheetSigned?.signedUrl;
        if (sheetUrlForVision) {
          const sys = `You are extracting the canonical visual identity of a children's storybook character from the APPROVED CHARACTER SHEET image. Be faithful: record textured hair as textured, deep skin tones as deep, wide noses as wide. Do not soften, lighten, or anglicize what you see. Return STRICT JSON only:
{"face_shape":"","hair_color":"","hair_style":"","hair_texture":"","eye_color":"","eye_shape":"","nose_shape":"","lip_shape":"","skin_tone":"","skin_undertone":"","build":"","canonical_outfit":"","outfit_colors":[],"distinguishing_features":[],"accessibility_devices":[]}
Use short concrete phrases. Empty string / empty array when not visible. No commentary.`;
          const visionRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: sys },
                { role: "user", content: [
                  { type: "text", text: "Extract canonical visual traits from this character sheet." },
                  { type: "image_url", image_url: { url: sheetUrlForVision } },
                ]},
              ],
            }),
          });
          if (visionRes.ok) {
            const vp = await visionRes.json();
            const raw = vp?.choices?.[0]?.message?.content ?? "{}";
            const parsed = JSON.parse(raw);
            mergedAnalysis = {
              ...mergedAnalysis,
              sheet_vision: parsed,
              sheet_vision_at: new Date().toISOString(),
            };
          }
        }
      }
    } catch (visionErr) {
      console.warn("character-sheet vision extraction failed (non-fatal)", visionErr);
    }

    await admin
      .from("child_subjects")
      .update({
        status: "ready",
        character_image_url: image_url,
        description,
        photo_analysis: mergedAnalysis,
        photo_analyzed_at: new Date().toISOString(),
        regenerations: (subject.regenerations ?? 0) + 1,
        approved: false,
        error_message: null,
      })
      .eq("id", childSubjectId);

    return jsonResponse({ ok: true, childSubjectId, character_image_url: image_url, stub: false });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("create-character-sheet error", e);
    try {
      if (childSubjectId && adminForError) {
        await adminForError
          .from("child_subjects")
          .update({ status: "error", error_message: e?.message ?? "Internal error" })
          .eq("id", childSubjectId);
      }
    } catch {
      // Keep the original error response.
    }
    return errorResponse(e?.message ?? "Internal error", 500);
  }
});
