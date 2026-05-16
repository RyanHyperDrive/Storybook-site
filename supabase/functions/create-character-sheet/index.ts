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
    analysis?.hair ? `hair: ${analysis.hair}` : null,
    analysis?.eyes ? `eyes: ${analysis.eyes}` : null,
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

  try {
    const { user, admin } = await requireUser(req);
    const { childSubjectId } = await req.json();
    if (!childSubjectId) return errorResponse("childSubjectId is required");

    const subject = await assertOwnership(admin, "child_subjects", childSubjectId, user.id);

    await admin
      .from("child_subjects")
      .update({ status: "generating", error_message: null })
      .eq("id", childSubjectId);

    // TODO: call Kie.ai. Pseudocode:
    // const KIE_API_KEY = Deno.env.get("KIE_API_KEY")!;
    // const res = await fetch("https://api.kie.ai/v1/images/generate", {
    //   method: "POST",
    //   headers: { Authorization: `Bearer ${KIE_API_KEY}`, "Content-Type": "application/json" },
    //   body: JSON.stringify({
    //     prompt: buildCharacterPrompt(subject),
    //     reference_image_url: await signRefPhoto(admin, subject.reference_storage_path),
    //   }),
    // });
    // const { image_url } = await res.json();
    const image_url: string | null = null; // STUB

    await admin
      .from("child_subjects")
      .update({ status: image_url ? "ready" : "pending", character_image_url: image_url })
      .eq("id", childSubjectId);

    return jsonResponse({ ok: true, childSubjectId, character_image_url: image_url, stub: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("create-character-sheet error", e);
    return errorResponse(e?.message ?? "Internal error", 500);
  }
});
