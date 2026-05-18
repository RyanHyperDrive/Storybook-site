// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";

/**
 * POST /create-gift-checkout
 * Body: {
 *   gifter_name, gifter_email,
 *   parent_name, parent_email,
 *   child_first_name, child_age,
 *   dedication_message?, hardcover_interest?,
 *   origin
 * }
 *
 * No auth required — gifters may be brand new visitors.
 * Creates a gift_orders row and returns a Stripe checkout URL (stubbed
 * until STRIPE_SECRET_KEY is wired).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const body = await req.json();
    const {
      gifter_name,
      gifter_email,
      parent_name,
      parent_email,
      child_first_name,
      child_age,
      dedication_message,
      hardcover_interest,
      origin,
    } = body ?? {};

    const isEmail = (e: unknown) =>
      typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 320;

    if (!isEmail(gifter_email)) return errorResponse("Valid gifter_email required");
    if (!isEmail(parent_email)) return errorResponse("Valid parent_email required");
    if (typeof gifter_name !== "string" || gifter_name.trim().length === 0)
      return errorResponse("gifter_name required");
    if (typeof parent_name !== "string" || parent_name.trim().length === 0)
      return errorResponse("parent_name required");
    if (typeof child_first_name !== "string" || child_first_name.trim().length === 0)
      return errorResponse("child_first_name required");
    const age = Number(child_age);
    if (!Number.isInteger(age) || age < 3 || age > 10)
      return errorResponse("child_age must be between 3 and 10");
    if (dedication_message && String(dedication_message).length > 200)
      return errorResponse("dedication_message too long");
    if (!origin || typeof origin !== "string") return errorResponse("origin required");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: order, error: insertErr } = await admin
      .from("gift_orders")
      .insert({
        gifter_name: gifter_name.trim().slice(0, 120),
        gifter_email: gifter_email.toLowerCase().trim(),
        parent_name: parent_name.trim().slice(0, 120),
        parent_email: parent_email.toLowerCase().trim(),
        child_first_name: child_first_name.trim().slice(0, 60),
        child_age: age,
        dedication_message: dedication_message
          ? String(dedication_message).slice(0, 200)
          : null,
        hardcover_interest: Boolean(hardcover_interest),
        status: "awaiting_payment",
      })
      .select("id, upload_token")
      .single();

    if (insertErr || !order) {
      console.error("gift_orders insert failed", insertErr);
      return errorResponse("Could not create gift order", 500);
    }

    // --- Stripe checkout (stubbed) ---
    // TODO: real Stripe call once STRIPE_SECRET_KEY is configured.
    // import Stripe from "https://esm.sh/stripe@14?target=deno";
    // const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
    // const session = await stripe.checkout.sessions.create({
    //   mode: "payment",
    //   line_items: [{
    //     price_data: {
    //       currency: "usd",
    //       unit_amount: 2999,
    //       product_data: { name: "StoryNest gift book" },
    //     },
    //     quantity: 1,
    //   }],
    //   success_url: `${origin}/gift?success=1&order_id=${order.id}`,
    //   cancel_url: `${origin}/gift?canceled=1`,
    //   customer_email: gifter_email,
    //   metadata: { gift_order_id: order.id },
    // });
    // await admin.from("gift_orders").update({ stripe_session_id: session.id }).eq("id", order.id);
    // return jsonResponse({ url: session.url, sessionId: session.id });

    const fakeSessionId = `stub_${crypto.randomUUID()}`;
    await admin
      .from("gift_orders")
      .update({
        stripe_session_id: fakeSessionId,
        status: "awaiting_parent_upload",
      })
      .eq("id", order.id);

    // --- Email sends (stubbed) ---
    // TODO: wire Resend once RESEND_API_KEY is configured.
    console.log("[gift] would email gifter", gifter_email, "confirmation for order", order.id);
    console.log(
      "[gift] would email parent",
      parent_email,
      "upload invite",
      `${origin}/claim/${order.upload_token}`,
    );

    return jsonResponse({
      url: `${origin}/gift?success=1&order_id=${order.id}&stub=1`,
      sessionId: fakeSessionId,
      stub: true,
    });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("create-gift-checkout error", e);
    return errorResponse(e?.message ?? "Internal error", 500);
  }
});
