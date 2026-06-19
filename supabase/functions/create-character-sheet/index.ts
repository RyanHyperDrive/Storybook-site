// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { assertOwnership, requireUser } from "../_shared/auth.ts";

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
  let instruction: string | undefined;
  let adminForError: any = null;
  try {
    const { user, admin } = await requireUser(req);
    adminForError = admin;
    const body = await req.json();
    childSubjectId = body?.childSubjectId;
    const rawInstruction = typeof body?.instruction === "string" ? body.instruction.trim() : "";
    instruction = rawInstruction ? rawInstruction.slice(0, 500) : undefined;
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
      ? await admin.from("books").select("id, art_style, is_twins").eq("id", child.book_id).maybeSingle()
      : { data: null } as any;
    const styleKey = book?.art_style ?? "soft_cartoon";
    const styleAnchor = STYLE_ANCHORS[styleKey] ?? STYLE_ANCHORS.soft_cartoon;
    const analysis = subject.photo_analysis ?? {};

    // ── Twin mode: pull sibling subject (if any) + together photo (if any) ──
    // These become extra reference images for the model so:
    //   (a) the second twin's sheet inherits the EXACT art style/palette/
    //       lineweight of the first twin's already-approved sheet (no style
    //       drift between siblings), and
    //   (b) the model has explicit cues to keep the two twins visually
    //       distinguishable (different hair, outfit colors, accessories).
    let siblingSheetDataUrl: string | null = null;
    let togetherPhotoDataUrl: string | null = null;
    let siblingAnalysis: any = null;
    let siblingName: string | null = null;
    if (book?.is_twins && book?.id && child?.id) {
      const { data: siblings } = await admin
        .from("child_profiles")
        .select("id, name")
        .eq("book_id", book.id)
        .neq("id", child.id)
        .limit(1);
      const sibProfile = siblings?.[0];
      if (sibProfile?.id) {
        siblingName = sibProfile.name ?? null;
        const { data: sibSubj } = await admin
          .from("child_subjects")
          .select("character_image_url, photo_analysis")
          .eq("child_profile_id", sibProfile.id)
          .maybeSingle();
        siblingAnalysis = sibSubj?.photo_analysis ?? null;
        if (sibSubj?.character_image_url) {
          try {
            const { data: sigSib } = await admin.storage
              .from(CHARACTER_BUCKET)
              .createSignedUrl(sibSubj.character_image_url, 60 * 10);
            if (sigSib?.signedUrl) {
              const r = await fetch(sigSib.signedUrl);
              if (r.ok) {
                const buf = new Uint8Array(await r.arrayBuffer());
                let bin = "";
                for (let i = 0; i < buf.length; i += 0x8000) {
                  bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
                }
                siblingSheetDataUrl = `data:${r.headers.get("content-type") ?? "image/png"};base64,${btoa(bin)}`;
              }
            }
          } catch (_) { /* non-fatal */ }
        }
      }
      // Optional "both together" photo from the photo-upload step.
      const { data: together } = await admin
        .from("uploaded_photos")
        .select("storage_path")
        .eq("book_id", book.id)
        .eq("slot", "together")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (together?.storage_path) {
        try {
          const { data: sigTog } = await admin.storage
            .from(RAW_BUCKET)
            .createSignedUrl(together.storage_path, 60 * 10);
          if (sigTog?.signedUrl) {
            const r = await fetch(sigTog.signedUrl);
            if (r.ok) {
              const buf = new Uint8Array(await r.arrayBuffer());
              let bin = "";
              for (let i = 0; i < buf.length; i += 0x8000) {
                bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
              }
              togetherPhotoDataUrl = `data:${r.headers.get("content-type") ?? "image/jpeg"};base64,${btoa(bin)}`;
            }
          }
        } catch (_) { /* non-fatal */ }
      }
    }
    const hairDesc = [analysis?.hair_color, analysis?.hair_texture, analysis?.hair_length_and_style]
      .filter(Boolean).join(", ");
    const eyeDesc = [analysis?.eye_color, analysis?.eye_shape].filter(Boolean).join(", ");
    const distinct = Array.isArray(analysis?.distinctive_visual_details)
      ? analysis.distinctive_visual_details.filter(Boolean).join(", ") : "";
    // Build distinguishability cues from the sibling's analysis so the two twins
    // never end up identical. We point to literal differences (hair length/
    // texture, outfit colors, accessories) the model can lock onto.
    const sibV = (siblingAnalysis?.sheet_vision ?? siblingAnalysis ?? {}) as Record<string, any>;
    const myV = (analysis?.sheet_vision ?? analysis ?? {}) as Record<string, any>;
    const pickStr = (o: any, k: string) => (typeof o?.[k] === "string" ? o[k] : "");
    const sibCues: string[] = [];
    const sibHair = [pickStr(sibV, "hair_color"), pickStr(sibV, "hair_texture"), pickStr(sibV, "hair_length_and_style") || pickStr(sibV, "hair_style")].filter(Boolean).join(" ");
    const myHair = [pickStr(myV, "hair_color"), pickStr(myV, "hair_texture"), pickStr(myV, "hair_length_and_style") || pickStr(myV, "hair_style")].filter(Boolean).join(" ");
    if (sibHair) sibCues.push(`sibling hair: ${sibHair}`);
    if (myHair) sibCues.push(`THIS child's hair: ${myHair}`);
    const sibOutfit = pickStr(sibV, "outfit") || pickStr(sibV, "canonical_outfit");
    if (sibOutfit) sibCues.push(`sibling outfit (do NOT reuse): ${sibOutfit}`);
    const sibSkin = pickStr(sibV, "skin_tone_for_illustration") || pickStr(sibV, "skin_tone");
    const mySkin = pickStr(myV, "skin_tone_for_illustration") || pickStr(myV, "skin_tone");
    if (sibSkin && mySkin && sibSkin !== mySkin) sibCues.push(`sibling skin: ${sibSkin} / THIS child's skin: ${mySkin}`);

    // When a parent typed an adjustment AND we already have a previous
    // generated sheet for this child, feed that previous sheet in as an extra
    // reference so the model makes a TARGETED tweak instead of a full redraw.
    let prevSheetDataUrl: string | null = null;
    if (instruction && subject.character_image_url) {
      try {
        const { data: sigPrev } = await admin.storage
          .from(CHARACTER_BUCKET)
          .createSignedUrl(subject.character_image_url, 60 * 10);
        if (sigPrev?.signedUrl) {
          const r = await fetch(sigPrev.signedUrl);
          if (r.ok) {
            const buf = new Uint8Array(await r.arrayBuffer());
            let bin = "";
            for (let i = 0; i < buf.length; i += 0x8000) {
              bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
            }
            prevSheetDataUrl = `data:${r.headers.get("content-type") ?? "image/png"};base64,${btoa(bin)}`;
          }
        }
      } catch (_) { /* non-fatal */ }
    }

    const isTwins = !!book?.is_twins;
    let refIdx = 1;
    const refLegend: string[] = [`- Image ${refIdx++}: photo of THIS child — match likeness exactly.`];
    if (siblingSheetDataUrl) refLegend.push(`- Image ${refIdx++}: APPROVED illustrated sheet of the sibling${siblingName ? ` (${siblingName})` : ""} — match its art style, lineweight, palette, shading, and rendering technique EXACTLY so both twins read as drawn by the same illustrator. Do NOT copy the sibling's face, hair, or outfit.`);
    if (togetherPhotoDataUrl) refLegend.push(`- Image ${refIdx++}: photo of BOTH twins together — use it to understand their relative size, posture, and how they actually differ in real life. THIS sheet is for ${child?.name ?? "this child"} only (do not draw the sibling).`);
    if (prevSheetDataUrl) refLegend.push(`- Image ${refIdx++}: the previously generated character for this child — keep everything identical EXCEPT the parent's requested change.`);

    const prompt = [
      `Create a polished illustrated character sheet for ${child?.name ?? "the child"}${isTwins && siblingName ? ` (twin of ${siblingName})` : ""}.`,
      instruction
        ? `PARENT ADJUSTMENT (HIGHEST PRIORITY): apply this requested change to the character — "${instruction}". Apply ONLY this change; keep the child's identity and likeness faithful to the reference photo and keep everything else (pose, framing, outfit unless the change is about the outfit) the same as before.`
        : "",
      "Reference images:",
      refLegend.join("\n"),
      styleAnchor,
      "FIDELITY TO THE REFERENCE PHOTO (HARD GATE): the illustrated child must visually resemble the real child in the photo. Match skin tone and undertone EXACTLY — do not lighten, brighten, desaturate, or shift the skin toward beige/peach defaults. Preserve hair texture exactly (coily hair stays coily, curly stays curly, straight stays straight — never straighten or loosen textured hair). Preserve nose, lip, eye shape and facial proportions. Preserve any visible accessibility devices (glasses, hearing aids, cochlear implants). Do not Westernize or anglicize features. Do not infer race or ethnicity, but DO render what the photo literally shows.",
      isTwins && siblingSheetDataUrl
        ? `TWIN DISTINGUISHABILITY (HARD GATE): this child and the sibling are twins and MUST be unambiguously distinguishable in every illustration. Use clearly different outfit colors from the sibling's sheet, and emphasize each child's real hair length/style/texture and skin tone as captured in their own reference photo. Never duplicate the sibling's outfit, hairstyle, or accessories.${sibCues.length ? ` Concrete differentiation cues: ${sibCues.join("; ")}.` : ""}`
        : "",
      isTwins && !siblingSheetDataUrl
        ? "TWIN PRIMING: this is one of two twins. Choose a distinctive outfit color palette and hairstyle treatment that the sibling can be clearly contrasted against in the second sheet. Lock in a unique canonical outfit for this child."
        : "",
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
      "Single full-body child character on a plain warm off-white background, portrait orientation, friendly bedtime storybook mood, no UI, no text, no labels, no watermark.",
    ].filter(Boolean).join("\n");

    await admin
      .from("child_subjects")
      .update({ status: "generating", error_message: null })
      .eq("id", childSubjectId);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return errorResponse("LOVABLE_API_KEY is not configured", 500);

    // Inline the child's reference photo as a data URL (mirrors illustrate-page).
    async function fetchAsDataUrl(url: string, fallbackMime = "image/png"): Promise<string> {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Failed to fetch reference image: ${r.status}`);
      const ct = r.headers.get("content-type") ?? fallbackMime;
      const buf = new Uint8Array(await r.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) {
        bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      }
      return `data:${ct};base64,${btoa(bin)}`;
    }
    const childPhotoDataUrl = await fetchAsDataUrl(signed.signedUrl, "image/jpeg");

    const userContent: any[] = [{ type: "text", text: prompt }];
    userContent.push({ type: "image_url", image_url: { url: childPhotoDataUrl } });
    if (siblingSheetDataUrl) userContent.push({ type: "image_url", image_url: { url: siblingSheetDataUrl } });
    if (togetherPhotoDataUrl) userContent.push({ type: "image_url", image_url: { url: togetherPhotoDataUrl } });
    if (prevSheetDataUrl) userContent.push({ type: "image_url", image_url: { url: prevSheetDataUrl } });

    async function callImageModel(model: string) {
      return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          modalities: ["image", "text"],
          messages: [{ role: "user", content: userContent }],
        }),
      });
    }
    function extractImageUrl(payload: any): string | undefined {
      return (
        payload?.choices?.[0]?.message?.images?.[0]?.image_url?.url ??
        payload?.choices?.[0]?.message?.images?.[0]?.url
      );
    }
    function extractTextReply(payload: any): string {
      const msg = payload?.choices?.[0]?.message;
      if (!msg) return "";
      if (typeof msg.content === "string") return msg.content;
      if (Array.isArray(msg.content)) {
        return msg.content.map((c: any) => (typeof c?.text === "string" ? c.text : "")).filter(Boolean).join(" ");
      }
      return "";
    }

    const attempts: { model: string; label: string }[] = [
      { model: "google/gemini-3.1-flash-image-preview", label: "flash-1" },
      { model: "google/gemini-3.1-flash-image-preview", label: "flash-2" },
      { model: "google/gemini-3-pro-image-preview", label: "pro-fallback" },
    ];

    let imageDataUrl: string | undefined;
    let lastTextReply = "";
    let lastStatus = 0;
    let lastErrBody = "";
    for (const attempt of attempts) {
      const aiRes = await callImageModel(attempt.model);
      lastStatus = aiRes.status;
      if (!aiRes.ok) {
        lastErrBody = await aiRes.text();
        console.error(`create-character-sheet ${attempt.label} gateway error`, aiRes.status, lastErrBody);
        if (aiRes.status === 429) return errorResponse("Rate limit exceeded, try again shortly", 429);
        if (aiRes.status === 402) return errorResponse("AI credits exhausted", 402);
        continue;
      }
      const payload = await aiRes.json();
      const candidate = extractImageUrl(payload);
      if (candidate && candidate.startsWith("data:")) {
        imageDataUrl = candidate;
        break;
      }
      lastTextReply = extractTextReply(payload);
      console.warn(
        `create-character-sheet ${attempt.label} returned no image`,
        JSON.stringify({ textReply: lastTextReply.slice(0, 400), finishReason: payload?.choices?.[0]?.finish_reason }),
      );
    }
    if (!imageDataUrl) {
      const reason = lastTextReply
        ? `Image model refused: ${lastTextReply.slice(0, 240)}`
        : lastErrBody
          ? `Image gateway error (${lastStatus}): ${lastErrBody.slice(0, 240)}`
          : "Image generation returned no image after retries";
      throw new Error(reason);
    }

    const match = imageDataUrl.match(/^data:(.+?);base64,(.*)$/);
    if (!match) throw new Error("Malformed image data URL from gateway");
    const mime = match[1] || "image/png";
    const base64 = match[2];
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const ext = mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : "png";
    const imagePath = `${user.id}/${childSubjectId}-${Date.now()}.${ext}`;
    const { error: uploadErr } = await admin.storage
      .from(CHARACTER_BUCKET)
      .upload(imagePath, bytes, { contentType: mime, upsert: true });
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
              model: "google/gemini-2.5-pro",
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
