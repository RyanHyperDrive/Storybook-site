// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { assertOwnership, requireUser } from "../_shared/auth.ts";

/**
 * POST /regenerate-page
 * Body: { pageId: string, feedback?: string }
 *
 * - Validates caller and ownership of the page.
 * - Increments regenerations counter.
 * - Marks page as 'regenerating'.
 * - Hands off to the background runner (do NOT generate here — image gen can
 *   take 30-60s and edge functions have a hard timeout).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const { user, admin } = await requireUser(req);
    const { pageId, feedback } = await req.json();
    if (!pageId) return errorResponse("pageId is required");

    const page = await assertOwnership(admin, "book_pages", pageId, user.id);

    // Soft cap to prevent abuse.
    if ((page.regenerations ?? 0) >= 5) {
      return errorResponse("Regeneration limit reached for this page", 429);
    }

    await admin
      .from("book_pages")
      .update({
        status: "regenerating",
        regenerations: (page.regenerations ?? 0) + 1,
      })
      .eq("id", pageId);

    // TODO: enqueue regeneration on the background runner with payload:
    //   { pageId, bookId: page.book_id, userId: user.id, feedback }
    console.log("STUB: would enqueue page regeneration", { pageId, feedback });

    return jsonResponse({ ok: true, pageId, status: "regenerating", stub: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("regenerate-page error", e);
    return errorResponse(e?.message ?? "Internal error", 500);
  }
});
