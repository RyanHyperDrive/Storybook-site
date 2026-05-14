// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";

/**
 * POST /start-book-generation
 * Body: { bookId: string, userId?: string }
 *
 * Enqueues the long-running book generation pipeline on an external
 * background job runner (e.g. Trigger.dev, Inngest, QStash). Edge Functions
 * have a hard timeout, so we MUST NOT generate the whole book here.
 *
 * Callable two ways:
 *   1) From stripe-webhook with the service role (no user JWT) — uses userId
 *      from the body and skips ownership check.
 *   2) From the authenticated frontend — validates the JWT and ownership.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { bookId, userId: bodyUserId } = await req.json();
    if (!bookId) return errorResponse("bookId is required");

    // Identify caller. If a JWT is present, validate it and use that user.
    // Otherwise trust the service-role caller (e.g. stripe-webhook).
    let userId = bodyUserId as string | undefined;
    const auth = req.headers.get("Authorization");
    if (auth) {
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: auth } },
      });
      const { data, error } = await userClient.auth.getUser();
      if (error || !data.user) return errorResponse("Invalid session", 401);
      userId = data.user.id;
    }
    if (!userId) return errorResponse("Cannot determine caller", 401);

    // Ownership check.
    const { data: book } = await admin
      .from("books")
      .select("id, user_id, status, reading_level, theme, favorites, avoid")
      .eq("id", bookId)
      .maybeSingle();
    if (!book || book.user_id !== userId) return errorResponse("Not found or forbidden", 403);
    const reading_level = (book as any).reading_level ?? "ages_4_6";

    // Reuse an in-flight job if one already exists.
    const { data: existing } = await admin
      .from("jobs")
      .select("id, status")
      .eq("book_id", bookId)
      .in("status", ["queued", "running"])
      .maybeSingle();

    let jobId = existing?.id;
    if (!jobId) {
      const { data: job, error: jobErr } = await admin
        .from("jobs")
        .insert({
          book_id: bookId,
          user_id: userId,
          kind: "book",
          status: "queued",
          progress: 5,
          current_step: "photo_check",
        })
        .select("id")
        .single();
      if (jobErr) throw jobErr;
      jobId = job.id;
    }

    const TRIGGER_API_KEY = Deno.env.get("TRIGGER_API_KEY")!;
    await fetch("https://api.trigger.dev/api/v1/tasks/generate-book/trigger", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TRIGGER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ payload: { bookId, jobId, userId } }),
    });

    return jsonResponse({ ok: true, jobId, stub: false });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("start-book-generation error", e);
    return errorResponse(e?.message ?? "Internal error", 500);
  }
});
