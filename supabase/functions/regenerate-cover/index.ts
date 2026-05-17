// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";

/**
 * POST /regenerate-cover
 * Body: { bookId: string, feedback?: string, sceneOverride?: string }
 *
 * Synchronously regenerates the cover via illustrate-page (isCover=true).
 */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);
  const authHeader = req.headers.get("Authorization") ?? "";

  try {
    const { user, admin } = await requireUser(req);
    const { bookId, feedback, sceneOverride } = await req.json();
    if (!bookId) return errorResponse("bookId is required");

    const { data: book } = await admin
      .from("books")
      .select("id, user_id, art_style, story_json, title, child_name")
      .eq("id", bookId)
      .maybeSingle();
    if (!book || book.user_id !== user.id) return errorResponse("Not found or forbidden", 403);

    const story = (book.story_json ?? {}) as any;
    const baseScene = story?.cover?.scene_description
      ?? `Book cover for "${book.title ?? "a children's storybook"}" starring ${book.child_name ?? "the main character"}. Warm, inviting, single hero image with clear focal point.`;
    const scene = typeof sceneOverride === "string" && sceneOverride.trim() ? sceneOverride.trim() : baseScene;

    const res = await fetch(`${SUPABASE_URL}/functions/v1/illustrate-page`, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        bookId,
        styleKey: book.art_style ?? "soft_cartoon",
        sceneDescription: scene,
        charactersPresent: story?.cover?.characters_present ?? [],
        visualMustHaves: story?.cover?.visual_must_haves ?? [],
        visualMustNotInclude: story?.cover?.visual_must_not_include ?? [],
        isCover: true,
        correctiveNote: typeof feedback === "string" ? feedback : "",
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return errorResponse(json?.error ?? "Cover regeneration failed", res.status);

    return jsonResponse({ ok: true, previewUrl: json?.previewUrl ?? null });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("regenerate-cover error", e);
    return errorResponse(e?.message ?? "Internal error", 500);
  }
});
