// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";

/**
 * POST /process-page
 * Body: {
 *   bookId, pageNumber, styleKey, sceneDescription,
 *   charactersPresent?, visualMustHaves?, visualMustNotInclude?
 * }
 *
 * Orchestrates a single page end-to-end:
 *   1. illustrate-page -> generate
 *   2. validate-page   -> score against contract + character sheet + cover
 *   3. If needs_regeneration, re-illustrate with the validator's
 *      regeneration_instruction merged into visualMustHaves.
 *   4. Retry up to MAX_RETRIES (=2) total regenerations.
 *   5. If still failing, mark the page needs_review=true and store the
 *      attempt count + final report into book_pages.quality_metadata.
 *
 * The whole orchestration is gated on books.visual_consistency_contract
 * existing — if missing, returns 412 so the caller can build it first.
 *
 * Long-running: each illustrate call is 10-40s. Two retries can push past
 * 2 minutes. The job runner should call this per page, not the browser.
 */

const MAX_RETRIES = 2;

async function callFn(fn: string, auth: string, body: unknown): Promise<{ status: number; json: any }> {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/${fn}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, json };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);
  const authHeader = req.headers.get("Authorization") ?? "";

  try {
    const { user, admin } = await requireUser(req);
    const body = await req.json();
    const { bookId, pageNumber, styleKey, sceneDescription } = body ?? {};
    if (!bookId || !Number.isInteger(pageNumber) || !styleKey || !sceneDescription) {
      return errorResponse("bookId, pageNumber, styleKey, sceneDescription are required");
    }

    const { data: book } = await admin
      .from("books")
      .select("id, user_id, visual_consistency_contract, cover_validation")
      .eq("id", bookId)
      .maybeSingle();
    if (!book || book.user_id !== user.id) return errorResponse("Not found or forbidden", 403);

    if (!book.visual_consistency_contract) {
      return errorResponse(
        "Visual consistency contract missing — call /build-contract before generating pages.",
        412,
      );
    }
    if (book.cover_validation && (book.cover_validation as any).passes === false) {
      return errorResponse(
        "Cover validation has not passed — regenerate cover before story pages.",
        412,
      );
    }

    const charactersPresent: string[] = Array.isArray(body.charactersPresent) ? body.charactersPresent : [];
    let visualMustHaves: string[] = Array.isArray(body.visualMustHaves) ? body.visualMustHaves : [];
    const visualMustNotInclude: string[] = Array.isArray(body.visualMustNotInclude) ? body.visualMustNotInclude : [];

    const attempts: any[] = [];
    let lastReport: any = null;
    let lastStorage: string | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const ill = await callFn("illustrate-page", authHeader, {
        bookId, pageNumber, styleKey, sceneDescription,
        charactersPresent, visualMustHaves, visualMustNotInclude,
      });
      if (ill.status >= 400) {
        attempts.push({ attempt, phase: "illustrate", error: ill.json?.error });
        break;
      }
      lastStorage = ill.json?.storagePath ?? lastStorage;

      const val = await callFn("validate-page", authHeader, {
        bookId, pageNumber, sceneDescription,
        charactersPresent, visualMustHaves, visualMustNotInclude,
      });
      if (val.status >= 400) {
        attempts.push({ attempt, phase: "validate", error: val.json?.error });
        break;
      }
      lastReport = val.json?.report ?? null;
      attempts.push({
        attempt,
        needs_regeneration: !!lastReport?.needs_regeneration,
        instruction: lastReport?.regeneration_instruction ?? "",
        scores: {
          character_consistency: lastReport?.character_consistency_score,
          cover_match: lastReport?.cover_match_score,
          style: lastReport?.style_consistency_score,
          scene: lastReport?.scene_match_score,
          age: lastReport?.age_appropriateness_score,
        },
      });

      if (!lastReport?.needs_regeneration) break;
      if (attempt === MAX_RETRIES) break;

      // Merge the validator's instruction into the next attempt's must-haves.
      const instr = String(lastReport?.regeneration_instruction ?? "").trim();
      if (instr) visualMustHaves = [...visualMustHaves, instr];
    }

    const finalNeedsReview = !!lastReport?.needs_regeneration;

    // Persist orchestration audit trail.
    const { data: pageRow } = await admin
      .from("book_pages")
      .select("id, quality_metadata")
      .eq("book_id", bookId)
      .eq("page_number", pageNumber)
      .maybeSingle();
    if (pageRow) {
      const meta = { ...(pageRow.quality_metadata ?? {}), attempts, attempt_count: attempts.length };
      await admin
        .from("book_pages")
        .update({
          quality_metadata: meta,
          needs_review: finalNeedsReview,
          status: finalNeedsReview ? "needs_review" : "ready",
        })
        .eq("id", pageRow.id);
    }

    return jsonResponse({
      ok: true,
      bookId,
      pageNumber,
      attempts: attempts.length,
      needs_review: finalNeedsReview,
      final_report: lastReport,
      storagePath: lastStorage,
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("process-page error", e);
    return errorResponse(e?.message ?? "Internal error", 500);
  }
});
