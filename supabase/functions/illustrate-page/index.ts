// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import {
  CHARACTER_CONSISTENCY_CLAUSE,
  contractToPromptFragment,
  styleNegatives,
  type VisualConsistencyContract,
} from "../_shared/visual-contract.ts";

/**
 * POST /illustrate-page
 * Body: {
 *   bookId: string,
 *   pageNumber: number,           // 1..N (story page index)
 *   styleKey: string,             // approved art style key, e.g. "watercolor_classic"
 *   sceneDescription: string,
 *   charactersPresent?: string[],
 *   visualMustHaves?: string[],
 *   visualMustNotInclude?: string[],
 *   characterSheetUrl?: string,   // optional override; otherwise pulled from character_sheets
 * }
 *
 * Generates a single storybook page illustration consistent with the approved
 * character sheet, persists the image to the `generated-pages` storage bucket,
 * and upserts a row in `book_pages`.
 *
 * Long-running? Image gen can take 10-40s. The function is sync; the job
 * runner should call it per-page from the background pipeline.
 */

// Age-band visual safety clauses. Mirrors write-story's text safety so the
// illustration cannot drift past what's safe for the selected band.
const VISUAL_SAFETY: Record<string, string> = {
  "2-3":
    "Visual safety (ages 2-3): cozy and gentle. No scary creatures, no peril, no darkness, no weapons, no injury, no tears of distress, no chase. Child-safe clothing fully covering the body. Only soft, friendly faces.",
  "4-6":
    "Visual safety (ages 4-6): warm picture-book mood. No weapons, no blood/injury, no monsters or body-horror, no frightening faces, no romantic/suggestive poses, no shame or punishment imagery. Child-safe clothing only.",
  "7-10":
    "Visual safety (ages 7-10): light adventure okay, but still child-safe. No gore, no realistic violence, no weapons used to harm, no sexual or romantic framing, no suggestive poses, no self-harm imagery, no substance use, no unsafe activities depicted approvingly. Child-safe clothing only.",
};
function visualSafetyFor(ageBand: string | undefined): string {
  return VISUAL_SAFETY[String(ageBand ?? "4-6")] ?? VISUAL_SAFETY["4-6"];
}

// Age-band composition guidance. Drives camera, character size, background
// density, and emotional pacing so a 2-3 board-book page doesn't get the same
// composition as a 7-10 adventure page. Used in every illustrate-page prompt.
const COMPOSITION_GUIDANCE: Record<string, string> = {
  "2-3":
    "Composition (ages 2-3): one big, friendly subject filling 50-70% of the frame, eye-level, centered. Simple uncluttered background, 1-2 supporting props max. Bright, high-contrast, rounded shapes. Calm pose, soft smile. No tiny details requiring close inspection.",
  "4-6":
    "Composition (ages 4-6): classic picture-book staging. Character clearly readable at 30-50% of the frame, mid-shot or environmental. Background tells the scene with 3-5 supporting elements. Dynamic but stable pose. Clear focal point and gentle leading lines.",
  "7-10":
    "Composition (ages 7-10): richer cinematic framing allowed — wide environmental shots, over-the-shoulder, low/high angles when it serves the scene. Character can be 15-40% of the frame. Detailed background with depth layers, supporting cast in poses. Expressive but age-appropriate emotion.",
};
function compositionFor(ageBand: string | undefined): string {
  return COMPOSITION_GUIDANCE[String(ageBand ?? "4-6")] ?? COMPOSITION_GUIDANCE["4-6"];
}

const PROMPT_TEMPLATE = (input: {
  styleKey: string;
  sceneDescription: string;
  charactersPresent: string[];
  visualMustHaves: string[];
  visualMustNotInclude: string[];
  ageBand: string;
  contractFragment: string;
  hasCoverRef: boolean;
  hasPrevPageRef: boolean;
  isTwins: boolean;
  twinDifferentiator?: string;
  twinSheetNames?: string[]; // names corresponding to the per-twin sheets, in order
  hasTogetherRef?: boolean;
}) => {
  const refs: string[] = [];
  const twinNames = input.twinSheetNames ?? [];
  if (input.isTwins && twinNames.length >= 2) {
    twinNames.forEach((name, i) => {
      refs.push(`- Image ${i + 1}: APPROVED character sheet for ${name} — canonical look for this twin. Match face, hair, skin tone, and outfit exactly when ${name} appears on the page.`);
    });
  } else {
    refs.push(`- Image 1: the approved character sheet (canonical look of the main character${input.isTwins ? "s — twins must remain visually distinguishable" : ""}).`);
  }
  let n = refs.length + 1;
  if (input.hasCoverRef) { refs.push(`- Image ${n}: the approved book cover (secondary canonical look — match its character rendering exactly).`); n++; }
  if (input.hasPrevPageRef) { refs.push(`- Image ${n}: the most recently approved page from THIS book (continuity reference — match its character rendering, clothing, line weight, palette, and style exactly so the book reads as one continuous illustrated work).`); n++; }
  if (input.hasTogetherRef) { refs.push(`- Image ${n}: photo of the two real twins together — use it to ground their relative size, posture, and how they actually differ in real life when both appear in the scene.`); n++; }
  return `Create a children's storybook illustration in the approved style: ${input.styleKey}.

You are given reference images:
${refs.join("\n")}

${input.contractFragment ? input.contractFragment + "\n" : ""}
${CHARACTER_CONSISTENCY_CLAUSE}

Style negatives for ${input.styleKey}: ${styleNegatives(input.styleKey)}

Scene:
${input.sceneDescription}

Characters present:
${input.charactersPresent.length ? input.charactersPresent.map((c) => `- ${c}`).join("\n") : "- (main character only)"}

Must include:
${input.visualMustHaves.length ? input.visualMustHaves.map((v) => `- ${v}`).join("\n") : "- (none specified)"}

Must avoid:
${input.visualMustNotInclude.length ? input.visualMustNotInclude.map((v) => `- ${v}`).join("\n") : "- (none specified)"}

AGE-APPROPRIATENESS (HARD GATE — image is for ages ${input.ageBand}):
${visualSafetyFor(input.ageBand)}
If the scene description would push the image past this safety rule, soften it visually (reframe, off-screen, friendly substitute) — never produce unsafe imagery.

${compositionFor(input.ageBand)}
${input.twinDifferentiator ? `\nTWIN DIFFERENTIATION (HARD GATE): ${input.twinDifferentiator}\n` : ""}
Composition:
- Full storybook page illustration.
- No page text embedded in the image. All titles and page text are rendered by the app over the image.
- Keep the character clearly visible and on-model with the character sheet${input.hasCoverRef ? ", cover" : ""}${input.hasPrevPageRef ? ", and previous page" : ""}.
- SAFE FRAMING HARD GATE (non-negotiable): the child's full head, hair, and face MUST be inside the frame with comfortable padding above the top of the head — NEVER let the scalp, hair, forehead, ears, chin, or cheeks touch or cross any image edge. In any standing, walking, running, jumping, or dancing scene, BOTH FEET (including shoes) must be fully visible above the bottom edge — do not crop at the ankles or shins. The only exception is when the scene description explicitly requests an extreme close-up portrait, and even then the head and face must remain the deliberate, fully-contained subject. For seated, lying-down, bedtime, or behind-an-object scenes, the head and upper body must be fully inside the frame with padding. A correct, on-model image with bad framing will be REJECTED and regenerated.
- CONTINUITY HARD GATE: the child's IDENTITY (face, hair color/texture/style, skin tone & undertone, eye/nose/lip shape, build, distinguishing features, accessibility devices) must lock across pages — never drift from the character sheet, cover, or previous page. CLOTHING is NOT locked: it must match what THIS page's scene and "must include" list call for (e.g. pajamas for a bedtime scene, a costume or armor when the story calls for it), and stay consistent with the previous page only when the setting is unchanged. The page scene and its must-include list are the authority on clothing; the contract's "default everyday outfit" is only a fallback when the scene doesn't specify clothing. Treat the previous page reference primarily as an identity, palette, and style anchor — copy its clothing only when the current scene hasn't called for something different.
- Warm, safe, age-appropriate mood for ages ${input.ageBand}.
- Consistent color palette, line weight, shading, and rendering quality with the reference images. Do not change art technique between pages.`;
};

function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map(String) : [];
}

async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch reference image: ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "image/png";
  const buf = new Uint8Array(await res.arrayBuffer());
  // Base64 encode in chunks (Deno-safe)
  let binary = "";
  for (let i = 0; i < buf.length; i += 0x8000) {
    binary += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}

async function resolveImageRef(admin: any, bucket: string, value: unknown, ttl = 60 * 10): Promise<string | undefined> {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw) || raw.startsWith("data:")) return raw;
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(raw, ttl);
  if (error) throw new Error(`Could not resolve ${bucket} image: ${error.message}`);
  return data?.signedUrl ?? undefined;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const { user, admin } = await requireUser(req);
    const body = await req.json();
    const {
      bookId,
      pageNumber,
      styleKey,
      sceneDescription,
      charactersPresent,
      visualMustHaves,
      visualMustNotInclude,
      characterSheetUrl,
      readingLevel,
      isCover,
      correctiveNote,
      previousPageImagePath,
    } = body ?? {};

    if (!bookId) return errorResponse("bookId is required");
    if (!isCover && (!Number.isInteger(pageNumber) || pageNumber < 1)) {
      return errorResponse("pageNumber must be a positive integer");
    }
    if (typeof styleKey !== "string" || !styleKey.trim()) return errorResponse("styleKey is required");
    if (typeof sceneDescription !== "string" || !sceneDescription.trim()) {
      return errorResponse("sceneDescription is required");
    }

    // Verify book ownership AND fetch reading_level/age + contract + cover so the
    // visual safety clause + character consistency contract are honored on every page.
    const { data: book, error: bookErr } = await admin
      .from("books")
      .select("id, user_id, reading_level, child_age, is_twins, art_style, details_avoid, visual_consistency_contract, cover_image_path, cover_url")
      .eq("id", bookId)
      .maybeSingle();
    if (bookErr) return errorResponse(bookErr.message, 500);
    if (!book || book.user_id !== user.id) return errorResponse("Book not found or forbidden", 403);

    // Resolve character sheet reference image(s).
    // For twins we ALWAYS pull both per-child sheets from child_subjects so
    // the model has a canonical reference for each twin on every page (not
    // just the primary sheet stored on character_sheets).
    let refUrl = await resolveImageRef(admin, "character-sheets", characterSheetUrl);
    const twinSheetUrls: { name: string; url: string }[] = [];
    if (book.is_twins) {
      const { data: profiles } = await admin
        .from("child_profiles")
        .select("id, name, slot")
        .eq("book_id", bookId)
        .order("slot");
      const profileIds = (profiles ?? []).map((p: any) => p.id);
      if (profileIds.length) {
        const { data: subs } = await admin
          .from("child_subjects")
          .select("child_profile_id, character_image_url, approved")
          .in("child_profile_id", profileIds);
        for (const p of profiles ?? []) {
          const s = (subs ?? []).find((x: any) => x.child_profile_id === p.id);
          if (s?.character_image_url) {
            const signed = await resolveImageRef(admin, "character-sheets", s.character_image_url);
            if (signed) twinSheetUrls.push({ name: p.name ?? "twin", url: signed });
          }
        }
      }
      if (!refUrl && twinSheetUrls[0]) refUrl = twinSheetUrls[0].url;
    }
    if (!refUrl) {
      const { data: sheet } = await admin
        .from("character_sheets")
        .select("image_url, approved")
        .eq("book_id", bookId)
        .eq("approved", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const sheetVal = sheet?.image_url ?? undefined;
      if (sheetVal) {
        refUrl = await resolveImageRef(admin, "character-sheets", sheetVal);
      }
    }
    if (!refUrl) return errorResponse("No approved character sheet found for this book", 412);

    // Optional "together" reference photo (raw upload), only used for twin scenes.
    let togetherUrl: string | undefined;
    if (book.is_twins) {
      const { data: together } = await admin
        .from("uploaded_photos")
        .select("storage_path")
        .eq("book_id", bookId)
        .eq("slot", "together")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (together?.storage_path) {
        togetherUrl = await resolveImageRef(admin, "raw-uploads", together.storage_path);
      }
    }

    // Resolve cover reference (secondary canonical look). Optional — first
    // page generation may not have a cover yet.
    let coverUrl: string | undefined;
    if (book.cover_image_path) {
      coverUrl = await resolveImageRef(admin, "generated-pages", book.cover_image_path);
    } else if (book.cover_url) {
      coverUrl = await resolveImageRef(admin, "generated-pages", book.cover_url);
    }

    // Rolling visual anchor: pull the most recently approved page image (the
    // caller passes it, or we auto-pick the highest-numbered ready page below
    // the current one). Feeding the previous frame as an extra reference is
    // the single biggest lever against character/style drift across pages.
    let prevPageUrl: string | undefined;
    if (!isCover) {
      let prevPath: string | undefined = typeof previousPageImagePath === "string" && previousPageImagePath.trim()
        ? previousPageImagePath
        : undefined;
      if (!prevPath && Number.isInteger(pageNumber) && pageNumber > 1) {
        const { data: prev } = await admin
          .from("book_pages")
          .select("page_number, image_storage_path, status, needs_review")
          .eq("book_id", bookId)
          .lt("page_number", pageNumber)
          .eq("status", "ready")
          .not("image_storage_path", "is", null)
          .order("page_number", { ascending: false })
          .limit(1)
          .maybeSingle();
        prevPath = prev?.image_storage_path ?? undefined;
      }
      if (prevPath) {
        prevPageUrl = await resolveImageRef(admin, "generated-pages", prevPath);
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return errorResponse("LOVABLE_API_KEY not configured", 500);

    // Map reading_level -> visual age band. Caller can override via readingLevel.
    const lvl = String(readingLevel ?? book.reading_level ?? "ages_4_6");
    const ageBand =
      lvl === "ages_2_3" || lvl === "ages_3_5" ? "2-3" :
      lvl === "ages_7_10" || lvl === "ages_6_8" ? "7-10" :
      "4-6";

    const contract = (book.visual_consistency_contract ?? null) as VisualConsistencyContract | null;
    const contractFragment = contractToPromptFragment(contract);

    // #4 — fold parent's details_avoid into the page's must-not-include list
    // so the illustrator sees a single combined ban list.
    const parentAvoid = typeof book.details_avoid === "string" && book.details_avoid.trim()
      ? book.details_avoid.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)
      : [];
    const combinedAvoid = Array.from(new Set([...arr(visualMustNotInclude), ...parentAvoid]));

    // #6 — when both twins are present on this page, surface the canonical
    // differentiator (outfit/accessory difference) so they read as two
    // distinct kids, not as duplicates.
    let twinDifferentiator = "";
    if (book.is_twins && contract && Array.isArray(contract.subjects) && contract.subjects.length >= 2) {
      const named = arr(charactersPresent).map((s) => s.toLowerCase());
      const twinsPresent = contract.subjects.filter(
        (s) => named.length === 0 || named.some((n) => n.includes(String(s.display_name).toLowerCase())),
      );
      if (twinsPresent.length >= 2) {
        twinDifferentiator = twinsPresent
          .map((s) => `${s.display_name} = ${s.canonical_outfit ?? "canonical outfit"}${s.distinguishing_features ? ` (${s.distinguishing_features})` : ""}`)
          .join("; ") + ". Each twin must be unambiguously identifiable by these cues — never render them as identical or with swapped cues.";
      }
    }

    const useTwinSheets = !!book.is_twins && twinSheetUrls.length >= 2;
    const prompt = PROMPT_TEMPLATE({
      styleKey,
      sceneDescription: (correctiveNote && typeof correctiveNote === "string")
        ? `${sceneDescription}\n\nCORRECTIVE FEEDBACK from previous attempt (must be applied — the previous attempt was rejected for these exact reasons): ${correctiveNote}`
        : sceneDescription,
      charactersPresent: arr(charactersPresent),
      visualMustHaves: arr(visualMustHaves),
      visualMustNotInclude: combinedAvoid,
      ageBand,
      contractFragment,
      hasCoverRef: !!coverUrl && !isCover,
      hasPrevPageRef: !!prevPageUrl,
      isTwins: !!book.is_twins,
      twinDifferentiator,
      twinSheetNames: useTwinSheets ? twinSheetUrls.map((t) => t.name) : undefined,
      hasTogetherRef: !!togetherUrl,
    });

    // Inline references as data URLs so the gateway always has access.
    const twinSheetDataUrls: string[] = useTwinSheets
      ? await Promise.all(twinSheetUrls.map((t) => fetchAsDataUrl(t.url)))
      : [];
    const primaryRefDataUrl = useTwinSheets
      ? null
      : (refUrl.startsWith("data:") ? refUrl : await fetchAsDataUrl(refUrl));
    const coverDataUrl = coverUrl
      ? (coverUrl.startsWith("data:") ? coverUrl : await fetchAsDataUrl(coverUrl))
      : null;
    const prevPageDataUrl = prevPageUrl
      ? (prevPageUrl.startsWith("data:") ? prevPageUrl : await fetchAsDataUrl(prevPageUrl))
      : null;
    const togetherDataUrl = togetherUrl
      ? (togetherUrl.startsWith("data:") ? togetherUrl : await fetchAsDataUrl(togetherUrl))
      : null;

    const userContent: any[] = [{ type: "text", text: prompt }];
    if (useTwinSheets) {
      for (const u of twinSheetDataUrls) userContent.push({ type: "image_url", image_url: { url: u } });
    } else if (primaryRefDataUrl) {
      userContent.push({ type: "image_url", image_url: { url: primaryRefDataUrl } });
    }
    if (coverDataUrl) userContent.push({ type: "image_url", image_url: { url: coverDataUrl } });
    if (prevPageDataUrl) userContent.push({ type: "image_url", image_url: { url: prevPageDataUrl } });
    if (togetherDataUrl) userContent.push({ type: "image_url", image_url: { url: togetherDataUrl } });

    // Call the gateway with a model + retry/fallback strategy. Some Gemini
    // image-preview responses come back as text-only refusals or empty image
    // arrays — when that happens we retry once on the same model, then fall
    // back to the pro image model before giving up. We also surface the
    // text reply in logs so we can see *why* it refused.
    async function callImageModel(model: string) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
      return res;
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
        return msg.content
          .map((c: any) => (typeof c?.text === "string" ? c.text : ""))
          .filter(Boolean)
          .join(" ");
      }
      return "";
    }

    const attempts: { model: string; label: string }[] = [
      { model: "google/gemini-3.1-flash-image-preview", label: "flash-1" },
      { model: "google/gemini-3.1-flash-image-preview", label: "flash-2" },
      { model: "google/gemini-3-pro-image-preview", label: "pro-fallback" },
    ];

    let imageUrl: string | undefined;
    let lastTextReply = "";
    let lastStatus = 0;
    let lastErrBody = "";

    for (const attempt of attempts) {
      const aiRes = await callImageModel(attempt.model);
      lastStatus = aiRes.status;
      if (!aiRes.ok) {
        lastErrBody = await aiRes.text();
        console.error(`illustrate-page ${attempt.label} gateway error`, aiRes.status, lastErrBody);
        if (aiRes.status === 429) return errorResponse("Rate limit exceeded, try again shortly", 429);
        if (aiRes.status === 402) return errorResponse("AI credits exhausted", 402);
        // Non-2xx other than rate/credits: try next attempt
        continue;
      }
      const payload = await aiRes.json();
      const candidate = extractImageUrl(payload);
      if (candidate && candidate.startsWith("data:")) {
        imageUrl = candidate;
        break;
      }
      lastTextReply = extractTextReply(payload);
      console.warn(
        `illustrate-page ${attempt.label} returned no image`,
        JSON.stringify({ textReply: lastTextReply.slice(0, 400), finishReason: payload?.choices?.[0]?.finish_reason }),
      );
    }

    if (!imageUrl) {
      const reason = lastTextReply
        ? `Image model refused: ${lastTextReply.slice(0, 240)}`
        : lastErrBody
          ? `Image gateway error (${lastStatus}): ${lastErrBody.slice(0, 240)}`
          : "Image generation returned no image after retries";
      return errorResponse(reason, 502);
    }

    // Decode the base64 data URL and upload to private storage.
    const match = imageUrl.match(/^data:(.+?);base64,(.*)$/);
    if (!match) return errorResponse("Malformed image data URL", 502);
    const mime = match[1] || "image/png";
    const base64 = match[2];
    const bin = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    const ext = mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : "png";
    const pathSeg = isCover ? `cover-${Date.now()}` : `page-${String(pageNumber).padStart(2, "0")}-${Date.now()}`;
    const storagePath = `${user.id}/${bookId}/${pathSeg}.${ext}`;

    const { error: upErr } = await admin.storage
      .from("generated-pages")
      .upload(storagePath, bin, { contentType: mime, upsert: false });
    if (upErr) return errorResponse(`Upload failed: ${upErr.message}`, 500);

    if (isCover) {
      // Cover lives on books, not book_pages.
      await admin.from("books").update({
        cover_image_path: storagePath,
        cover_url: storagePath,
      }).eq("id", bookId);
    } else {
      // Upsert the book_pages row (one per page_number per book).
      const { data: existing } = await admin
        .from("book_pages")
        .select("id, regenerations")
        .eq("book_id", bookId)
        .eq("page_number", pageNumber)
        .maybeSingle();

      if (existing) {
        const { error: updErr } = await admin
          .from("book_pages")
          .update({
            image_storage_path: storagePath,
            status: "ready",
            regenerations: (existing.regenerations ?? 0) + 1,
          })
          .eq("id", existing.id);
        if (updErr) return errorResponse(`DB update failed: ${updErr.message}`, 500);
      } else {
        const { error: insErr } = await admin.from("book_pages").insert({
          user_id: user.id,
          book_id: bookId,
          page_number: pageNumber,
          image_storage_path: storagePath,
          status: "ready",
        });
        if (insErr) return errorResponse(`DB insert failed: ${insErr.message}`, 500);
      }
    }

    // Return a short-lived signed URL for immediate preview.
    const { data: signed } = await admin.storage
      .from("generated-pages")
      .createSignedUrl(storagePath, 60 * 10);

    return jsonResponse({
      ok: true,
      bookId,
      pageNumber: isCover ? 0 : pageNumber,
      isCover: !!isCover,
      storagePath,
      previewUrl: signed?.signedUrl ?? null,
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("illustrate-page error", e);
    return errorResponse(e?.message ?? "Internal error", 500);
  }
});
