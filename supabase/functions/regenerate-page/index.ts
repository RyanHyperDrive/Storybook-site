// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { assertOwnership, requireUser } from "../_shared/auth.ts";

/**
 * POST /regenerate-page
 * Body: {
 *   pageId: string,
 *   feedback?: string,          // user's free-text correction
 *   sceneOverride?: string,     // optional new scene description (also saved to story_json)
 *   textOverride?: string,      // optional new text_content (saved to book_pages + story_json)
 * }
 *
 * Synchronous regeneration: validates ownership, optionally persists user
 * edits to text + scene, then invokes illustrate-page directly. Returns the
 * new preview URL so the reader can refresh in-place.
 */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const MAX_REGENS = 8;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  try {
    const { user, admin } = await requireUser(req);
    const { pageId, feedback, sceneOverride, textOverride } = await req.json();
    if (!pageId) return errorResponse("pageId is required");

    const page = await assertOwnership(admin, "book_pages", pageId, user.id);
    if ((page.regenerations ?? 0) >= MAX_REGENS) {
      return errorResponse("Regeneration limit reached for this page", 429);
    }

    const { data: book } = await admin
      .from("books")
      .select("id, art_style, story_json")
      .eq("id", page.book_id)
      .maybeSingle();
    if (!book) return errorResponse("Book not found", 404);

    const story = (book.story_json ?? {}) as any;
    const pages: any[] = Array.isArray(story.pages) ? story.pages : [];
    const idx = pages.findIndex((p: any) => Number(p.page_number) === Number(page.page_number));
    const scenePage = idx >= 0 ? pages[idx] : null;
    if (!scenePage) return errorResponse("Story metadata missing for this page", 412);

    // Persist edits before regenerating so the regen sees them.
    const newText = typeof textOverride === "string" ? textOverride : null;
    const newScene = typeof sceneOverride === "string" && sceneOverride.trim()
      ? sceneOverride.trim()
      : scenePage.scene_description;

    if (newText !== null || newScene !== scenePage.scene_description) {
      const nextPages = pages.slice();
      nextPages[idx] = {
        ...scenePage,
        scene_description: newScene,
        page_text: newText ?? scenePage.page_text,
      };
      await admin.from("books")
        .update({ story_json: { ...story, pages: nextPages } })
        .eq("id", book.id);
    }

    if (newText !== null) {
      await admin.from("book_pages")
        .update({ text_content: newText })
        .eq("id", pageId);
    }

    await admin.from("book_pages")
      .update({ status: "regenerating" })
      .eq("id", pageId);

    // Synchronously call illustrate-page.
    const res = await fetch(`${SUPABASE_URL}/functions/v1/illustrate-page`, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        bookId: book.id,
        pageNumber: page.page_number,
        styleKey: book.art_style ?? "soft_cartoon",
        sceneDescription: newScene,
        charactersPresent: scenePage.characters_present ?? [],
        visualMustHaves: scenePage.visual_must_haves ?? [],
        visualMustNotInclude: scenePage.visual_must_not_include ?? [],
        correctiveNote: typeof feedback === "string" ? feedback : "",
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      await admin.from("book_pages").update({ status: "ready" }).eq("id", pageId);
      return errorResponse(json?.error ?? "Regeneration failed", res.status);
    }

    // illustrate-page already set status='ready' and updated regenerations.
    return jsonResponse({ ok: true, previewUrl: json?.previewUrl ?? null });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("regenerate-page error", e);
    return errorResponse(e?.message ?? "Internal error", 500);
  }
});
