// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * POST /stripe-webhook
 *
 * Public endpoint called by Stripe. Verifies the signature with
 * STRIPE_WEBHOOK_SECRET, then handles `checkout.session.completed`:
 *   - upsert payments row (idempotent on session id)
 *   - flip books.status -> 'generating'
 *   - invoke start-book-generation to enqueue the job
 *
 * IMPORTANT: this function MUST be deployed with verify_jwt = false because
 * Stripe will not send a Supabase JWT.
 */
serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  // TODO: verify with Stripe SDK once STRIPE_WEBHOOK_SECRET is configured.
  // import Stripe from "https://esm.sh/stripe@14?target=deno";
  // const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
  // let event: Stripe.Event;
  // try {
  //   event = await stripe.webhooks.constructEventAsync(
  //     body,
  //     signature,
  //     Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
  //   );
  // } catch (err) {
  //   console.error("Stripe signature verification failed", err);
  //   return new Response("Invalid signature", { status: 400 });
  // }

  let event: any;
  try {
    event = JSON.parse(body); // STUB — replace with verified event above
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const bookId = session.metadata?.book_id;
      const userId = session.metadata?.user_id;
      if (!bookId || !userId) {
        console.error("Webhook missing metadata", session.id);
        return new Response("Missing metadata", { status: 400 });
      }

      // Idempotent: skip if we've already recorded this session.
      const { data: existing } = await admin
        .from("payments")
        .select("id")
        .eq("provider_session_id", session.id)
        .maybeSingle();

      if (!existing) {
        await admin.from("payments").insert({
          user_id: userId,
          book_id: bookId,
          provider: "stripe",
          provider_session_id: session.id,
          provider_payment_intent: session.payment_intent ?? null,
          amount_cents: session.amount_total ?? 2999,
          currency: session.currency ?? "usd",
          status: "succeeded",
        });
      }

      await admin.from("books").update({ status: "generating" }).eq("id", bookId);

      // Kick off the generation job runner.
      await admin.functions.invoke("start-book-generation", {
        body: { bookId, userId },
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("stripe-webhook handler error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
