// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";

/**
 * POST /regenerate-story
 * Body: { bookId: string, themeOverride?: string, feedback?: string }
 *
 * Calls write-story to produce a brand-new story_json, then updates the
 * existing book_pages text_content per page. Images are NOT auto-regenerated
 * — the user can regenerate any image individually from the reader.
 */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);
  const authHeader = req.headers.get("Authorization") ?? "";

  try {
    const { user, admin } = await requireUser(req);
    const { bookId, themeOverride, feedback } = await req.json();
    if (!bookId) return errorResponse("bookId is required");

    const { data: book } = await admin
      .from("books")
      .select("id, user_id, story_theme, story_prompt, child_name, child_loves, details_include, details_avoid, reading_level, visual_consistency_contract")
      .eq("id", bookId)
      .maybeSingle();
    if (!book || book.user_id !== user.id) return errorResponse("Not found or forbidden", 403);

    const theme = (typeof themeOverride === "string" && themeOverride.trim())
      ? themeOverride.trim()
      : (book.story_theme ?? book.story_prompt ?? "a warm adventure");
    const child_details = `${book.child_name ?? "the child"}${book.details_include ? ` — ${book.details_include}` : ""}`;
    const favorites = book.child_loves ?? "";
    const baseAvoid = book.details_avoid ?? "";
    const avoid = feedback ? `${baseAvoid}${baseAvoid ? "; " : ""}USER FEEDBACK (must apply): ${feedback}` : baseAvoid;

    const contract = (book.visual_consistency_contract ?? {}) as any;
    const cast = Array.isArray(contract?.subjects)
      ? contract.subjects.map((s: any) => s.display_name).filter(Boolean)
      : [];

    const res = await fetch(`${SUPABASE_URL}/functions/v1/write-story`, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        bookId,
        theme,
        child_details,
        favorites,
        avoid,
        reading_level: book.reading_level ?? "ages_4_6",
        cast,
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return errorResponse(json?.error ?? "Story regeneration failed", res.status);

    // Sync text_content per page from the new story_json.
    const story = json?.story ?? json;
    const pages: any[] = Array.isArray(story?.pages) ? story.pages : [];
    for (const p of pages) {
      await admin.from("book_pages")
        .update({ text_content: p.page_text })
        .eq("book_id", bookId)
        .eq("page_number", p.page_number);
    }

    return jsonResponse({ ok: true, pages: pages.length });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("regenerate-story error", e);
    return errorResponse(e?.message ?? "Internal error", 500);
  }
});
