// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";

/**
 * POST /validate-cover { bookId, coverImageUrl? }
 * Compares the book cover to the approved character sheet + visual contract.
 * Persists books.cover_validation { passes, scores, instruction, validated_at }.
 *
 * The page-generation pipeline must call this BEFORE generating story pages
 * and regenerate the cover if it fails (handled by start-book-generation /
 * the job runner — this function only scores and reports).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);
  try {
    const { user, admin } = await requireUser(req);
    const { bookId, coverImageUrl } = await req.json();
    if (!bookId) return errorResponse("bookId is required");

    const { data: book } = await admin
      .from("books")
      .select("id, user_id, art_style, visual_consistency_contract, cover_image_path, cover_url, is_twins")
      .eq("id", bookId)
      .maybeSingle();
    if (!book || book.user_id !== user.id) return errorResponse("Not found or forbidden", 403);

    const { data: sheet } = await admin
      .from("character_sheets")
      .select("image_url, approved")
      .eq("book_id", bookId)
      .eq("approved", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sheet?.image_url) return errorResponse("No approved character sheet", 412);
    let sheetUrl: string | undefined;
    if (/^https?:\/\//i.test(sheet.image_url) || sheet.image_url.startsWith("data:")) {
      sheetUrl = sheet.image_url;
    } else {
      const { data: sigSheet } = await admin.storage
        .from("character-sheets")
        .createSignedUrl(sheet.image_url, 60 * 5);
      sheetUrl = sigSheet?.signedUrl ?? undefined;
    }
    if (!sheetUrl) return errorResponse("Could not resolve character sheet image", 500);

    let coverUrl: string | undefined = coverImageUrl;
    if (!coverUrl && book.cover_image_path) {
      const { data: signed } = await admin.storage
        .from("generated-pages")
        .createSignedUrl(book.cover_image_path, 60 * 5);
      coverUrl = signed?.signedUrl ?? undefined;
    } else if (!coverUrl && book.cover_url) {
      coverUrl = book.cover_url;
    }
    if (!coverUrl) return errorResponse("No cover image to validate", 412);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return errorResponse("LOVABLE_API_KEY not configured", 500);

    const styleKey = String(book.art_style ?? "");
    const contractJson = book.visual_consistency_contract
      ? JSON.stringify(book.visual_consistency_contract)
      : "(none)";

    const sys = `You are validating a children's book COVER against the approved character sheet. Return STRICT JSON only:
{"character_consistency_score":0,"style_consistency_score":0,"safety_ok":true,"speech_bubble_detected":false,"text_inside_image_detected":false,"issues":[],"needs_regeneration":false,"regeneration_instruction":""}
- character_consistency_score: float 0-1 — does the cover character match the sheet (face, hair, skin, outfit, accessibility)?
- style_consistency_score: float 0-1 — does cover honor art style "${styleKey}"?
- needs_regeneration = true if character_consistency_score<0.88, style_consistency_score<0.85, safety_ok=false, text_inside_image_detected=true, or (style="comic_book" AND speech_bubble_detected=true).`;

    const userText = `Image 1 = approved character sheet. Image 2 = generated book cover.
Twins: ${book.is_twins ? "yes — both must remain distinguishable" : "no"}.
Visual consistency contract (JSON): ${contractJson}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sys },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: sheet.image_url } },
              { type: "image_url", image_url: { url: coverUrl } },
            ],
          },
        ],
      }),
    });
    if (!aiRes.ok) return errorResponse(`AI gateway error: ${await aiRes.text()}`, 502);
    const payload = await aiRes.json();
    const raw: string = payload?.choices?.[0]?.message?.content ?? "{}";
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { return errorResponse("Validator JSON parse failed", 502); }

    const cc = Number(parsed.character_consistency_score) || 0;
    const sc = Number(parsed.style_consistency_score) || 0;
    const speech = Boolean(parsed.speech_bubble_detected);
    const text = Boolean(parsed.text_inside_image_detected);
    const safety = parsed.safety_ok !== false;
    const needs = !!parsed.needs_regeneration ||
      cc < 0.88 || sc < 0.85 || !safety || text || (styleKey === "comic_book" && speech);

    const validation = {
      character_consistency_score: cc,
      style_consistency_score: sc,
      safety_ok: safety,
      speech_bubble_detected: speech,
      text_inside_image_detected: text,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      needs_regeneration: needs,
      passes: !needs,
      regeneration_instruction: typeof parsed.regeneration_instruction === "string"
        ? parsed.regeneration_instruction
        : "",
      validated_at: new Date().toISOString(),
    };

    await admin.from("books").update({ cover_validation: validation }).eq("id", bookId);
    return jsonResponse({ ok: true, bookId, validation });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("validate-cover error", e);
    return errorResponse(e?.message ?? "Internal error", 500);
  }
});
