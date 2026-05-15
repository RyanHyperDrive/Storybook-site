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

const PROMPT_TEMPLATE = (input: {
  styleKey: string;
  sceneDescription: string;
  charactersPresent: string[];
  visualMustHaves: string[];
  visualMustNotInclude: string[];
  ageBand: string;
}) => `Create a children's storybook illustration in the approved style: ${input.styleKey}.

Use the attached approved character sheet as the source of truth for the main character's appearance. Preserve the character's face shape, hair, outfit anchors, accessories, and overall childlike illustrated identity.

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

Composition:
- Full storybook page illustration.
- No page text embedded in the image.
- Keep the character clearly visible.
- Warm, safe, age-appropriate mood for ages ${input.ageBand}.
- Consistent color palette and line quality with the character sheet.`;

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
    } = body ?? {};

    if (!bookId) return errorResponse("bookId is required");
    if (!Number.isInteger(pageNumber) || pageNumber < 1) return errorResponse("pageNumber must be a positive integer");
    if (typeof styleKey !== "string" || !styleKey.trim()) return errorResponse("styleKey is required");
    if (typeof sceneDescription !== "string" || !sceneDescription.trim()) {
      return errorResponse("sceneDescription is required");
    }

    // Verify book ownership AND fetch reading_level/age so the visual safety
    // clause matches what the story was written for.
    const { data: book, error: bookErr } = await admin
      .from("books")
      .select("id, user_id, reading_level, child_age")
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return errorResponse("LOVABLE_API_KEY not configured", 500);

    // Map reading_level -> visual age band. Caller can override via readingLevel.
    const lvl = String(readingLevel ?? book.reading_level ?? "ages_4_6");
    const ageBand =
      lvl === "ages_2_3" || lvl === "ages_3_5" ? "2-3" :
      lvl === "ages_7_10" || lvl === "ages_6_8" ? "7-10" :
      "4-6";

    const prompt = PROMPT_TEMPLATE({
      styleKey,
      sceneDescription,
      charactersPresent: arr(charactersPresent),
      visualMustHaves: arr(visualMustHaves),
      visualMustNotInclude: arr(visualMustNotInclude),
      ageBand,
    });

    // Inline reference as data URL so the gateway always has access (private bucket signed URLs may be OK too).
    const refDataUrl = refUrl.startsWith("data:") ? refUrl : await fetchAsDataUrl(refUrl);

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        modalities: ["image", "text"],
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: refDataUrl } },
            ],
          },
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
    const storagePath = `${user.id}/${bookId}/page-${String(pageNumber).padStart(2, "0")}-${Date.now()}.${ext}`;

    const { error: upErr } = await admin.storage
      .from("generated-pages")
      .upload(storagePath, bin, { contentType: mime, upsert: false });
    if (upErr) return errorResponse(`Upload failed: ${upErr.message}`, 500);

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

    // Return a short-lived signed URL for immediate preview.
    const { data: signed } = await admin.storage
      .from("generated-pages")
      .createSignedUrl(storagePath, 60 * 10);

    return jsonResponse({
      ok: true,
      bookId,
      pageNumber,
      storagePath,
      previewUrl: signed?.signedUrl ?? null,
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("illustrate-page error", e);
    return errorResponse(e?.message ?? "Internal error", 500);
  }
});
