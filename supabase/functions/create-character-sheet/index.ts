// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { assertOwnership, requireUser } from "../_shared/auth.ts";

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
