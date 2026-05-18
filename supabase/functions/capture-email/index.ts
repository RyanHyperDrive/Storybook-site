// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";

/**
 * POST /capture-email
 * Body: { email: string, source?: 'exit_intent' | 'hardcover' | 'gift_edition' }
 *
 * Inserts into waitlist_signups. No auth required.
 * TODO: wire Resend send (sample preview) once RESEND_API_KEY is configured.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const { email, source = "exit_intent" } = await req.json();

    if (
      typeof email !== "string" ||
      email.length < 5 ||
      email.length > 320 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return errorResponse("Valid email required");
    }
    const allowed = ["exit_intent", "hardcover", "gift_edition"];
    if (!allowed.includes(source)) return errorResponse("Invalid source");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error } = await admin
      .from("waitlist_signups")
      .insert({ email: email.toLowerCase().trim(), source });

    if (error) {
      console.error("waitlist insert failed", error);
      return errorResponse("Could not save email", 500);
    }

    // TODO: send sample preview via Resend.
    console.log(`[capture-email] would email sample to ${email} (source=${source})`);

    return jsonResponse({ ok: true });
  } catch (e: any) {
    console.error("capture-email error", e);
    return errorResponse(e?.message ?? "Internal error", 500);
  }
});
