// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { assertOwnership, requireUser } from "../_shared/auth.ts";

/**
 * POST /create-checkout-session
 * Body: { bookId: string, origin: string }
 *
 * - Validates caller + ownership of the book.
 * - Verifies the book has been approved (character_sheets.approved = true).
 * - Creates a Stripe Checkout Session for $29.99 USD one-time.
 * - Returns { url } for the frontend to redirect to.
 *
 * Stripe secret is read from STRIPE_SECRET_KEY (set via secrets, never shipped to client).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const { user, admin } = await requireUser(req);
    const { bookId, origin } = await req.json();
    if (!bookId || !origin) return errorResponse("bookId and origin are required");

    const book = await assertOwnership(admin, "books", bookId, user.id);

    const { data: sheet } = await admin
      .from("character_sheets")
      .select("approved")
      .eq("book_id", bookId)
      .maybeSingle();
    if (!sheet?.approved) return errorResponse("Character sheet must be approved first", 400);

    // TODO: real Stripe call once STRIPE_SECRET_KEY is configured.
    // import Stripe from "https://esm.sh/stripe@14?target=deno";
    // const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
    // const session = await stripe.checkout.sessions.create({
    //   mode: "payment",
    //   line_items: [{
    //     price_data: {
    //       currency: "usd",
    //       unit_amount: 2999,
    //       product_data: { name: "Personalized StoryNest ebook" },
    //     },
    //     quantity: 1,
    //   }],
    //   success_url: `${origin}/checkout/success?book_id=${bookId}&session_id={CHECKOUT_SESSION_ID}`,
    //   cancel_url: `${origin}/checkout/cancel?book_id=${bookId}`,
    //   customer_email: user.email,
    //   metadata: { book_id: bookId, user_id: user.id },
    // });
    // return jsonResponse({ url: session.url, sessionId: session.id });

    // Stub: pretend payment succeeded.
    const fakeSessionId = `stub_${crypto.randomUUID()}`;
    const url = `${origin}/checkout/success?book_id=${bookId}&session_id=${fakeSessionId}&stub=1`;

    await admin.from("books").update({ status: "awaiting_payment" }).eq("id", bookId);

    return jsonResponse({ url, sessionId: fakeSessionId, stub: true });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("create-checkout-session error", e);
    return errorResponse(e?.message ?? "Internal error", 500);
  }
});
