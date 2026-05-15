// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { buildContract } from "../_shared/visual-contract.ts";

/**
 * POST /build-contract { bookId }
 * Builds a visual_consistency_contract from approved character sheet, child
 * profiles, and child_subjects. Persists onto books.visual_consistency_contract.
 *
 * Idempotent: safe to call multiple times. Used (a) right after parent
 * approves the character sheet and (b) as a fallback inside
 * start-book-generation if the contract is missing on an older book.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);
  try {
    const { user, admin } = await requireUser(req);
    const { bookId } = await req.json();
    if (!bookId) return errorResponse("bookId is required");

    const { data: book } = await admin.from("books").select("*").eq("id", bookId).maybeSingle();
    if (!book || book.user_id !== user.id) return errorResponse("Not found or forbidden", 403);

    const [{ data: profiles }, { data: subjects }, { data: sheet }] = await Promise.all([
      admin.from("child_profiles").select("*").eq("book_id", bookId).order("slot"),
      admin
        .from("child_subjects")
        .select("*")
        .eq("user_id", user.id)
        .eq("approved", true),
      admin
        .from("character_sheets")
        .select("image_url, approved")
        .eq("book_id", bookId)
        .eq("approved", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const profileIds = new Set((profiles ?? []).map((p: any) => p.id));
    const bookSubjects = (subjects ?? []).filter((s: any) => profileIds.has(s.child_profile_id));

    if (!bookSubjects.length || !sheet?.image_url) {
      return errorResponse("Cannot build contract: approved character sheet/subjects missing", 412);
    }
    if (book.is_twins) {
      const allConfirmed = bookSubjects.every((s: any) => s.twins_distinguishable_confirmed);
      if (!allConfirmed) {
        return errorResponse("Twins must be confirmed visually distinguishable", 412);
      }
    }

    const lvl = String(book.reading_level ?? "ages_4_6");
    const ageBand =
      lvl === "ages_2_3" || lvl === "ages_3_5" ? "2-3" :
      lvl === "ages_7_10" || lvl === "ages_6_8" ? "7-10" :
      "4-6";

    const contract = buildContract({
      book,
      childProfiles: profiles ?? [],
      childSubjects: bookSubjects,
      characterSheet: sheet,
      ageBand,
    });

    const { error: upErr } = await admin
      .from("books")
      .update({ visual_consistency_contract: contract })
      .eq("id", bookId);
    if (upErr) return errorResponse(upErr.message, 500);

    return jsonResponse({ ok: true, bookId, contract });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("build-contract error", e);
    return errorResponse(e?.message ?? "Internal error", 500);
  }
});
