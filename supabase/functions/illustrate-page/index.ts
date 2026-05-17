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
}) => {
  const refs: string[] = [];
  refs.push(`- Image 1: the approved character sheet (canonical look of the main character${input.isTwins ? "s — twins must remain visually distinguishable" : ""}).`);
  let n = 2;
  if (input.hasCoverRef) { refs.push(`- Image ${n}: the approved book cover (secondary canonical look — match its character rendering exactly).`); n++; }
  if (input.hasPrevPageRef) { refs.push(`- Image ${n}: the most recently approved page from THIS book (tertiary canonical look — match its character rendering, line weight, palette, and style exactly so the book reads as one continuous illustrated work).`); n++; }
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

    // Resolve character sheet reference image.
    let refUrl = characterSheetUrl as string | undefined;
    if (!refUrl) {
      const { data: sheet } = await admin
        .from("character_sheets")
        .select("image_url, approved")
        .eq("book_id", bookId)
        .eq("approved", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      refUrl = sheet?.image_url ?? undefined;
    }
    if (!refUrl) return errorResponse("No approved character sheet found for this book", 412);

    // Resolve cover reference (secondary canonical look). Optional — first
    // page generation may not have a cover yet.
    let coverUrl: string | undefined;
    if (book.cover_image_path) {
      const { data: signed } = await admin.storage
        .from("generated-pages")
        .createSignedUrl(book.cover_image_path, 60 * 10);
      coverUrl = signed?.signedUrl ?? undefined;
    } else if (book.cover_url) {
      coverUrl = book.cover_url;
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
        const { data: signedPrev } = await admin.storage
          .from("generated-pages")
          .createSignedUrl(prevPath, 60 * 10);
        prevPageUrl = signedPrev?.signedUrl ?? undefined;
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
    });

    // Inline reference as data URL so the gateway always has access.
    const refDataUrl = refUrl.startsWith("data:") ? refUrl : await fetchAsDataUrl(refUrl);
    const coverDataUrl = coverUrl
      ? (coverUrl.startsWith("data:") ? coverUrl : await fetchAsDataUrl(coverUrl))
      : null;
    const prevPageDataUrl = prevPageUrl
      ? (prevPageUrl.startsWith("data:") ? prevPageUrl : await fetchAsDataUrl(prevPageUrl))
      : null;

    const userContent: any[] = [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: refDataUrl } },
    ];
    if (coverDataUrl) {
      userContent.push({ type: "image_url", image_url: { url: coverDataUrl } });
    }
    if (prevPageDataUrl) {
      userContent.push({ type: "image_url", image_url: { url: prevPageDataUrl } });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        modalities: ["image", "text"],
        messages: [
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      if (aiRes.status === 429) return errorResponse("Rate limit exceeded, try again shortly", 429);
      if (aiRes.status === 402) return errorResponse("AI credits exhausted", 402);
      return errorResponse(`Image gateway error: ${text}`, 502);
    }

    const payload = await aiRes.json();
    const imageUrl: string | undefined =
      payload?.choices?.[0]?.message?.images?.[0]?.image_url?.url ??
      payload?.choices?.[0]?.message?.images?.[0]?.url;

    if (!imageUrl || !imageUrl.startsWith("data:")) {
      return errorResponse("Image generation returned no image", 502);
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
