import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Stub Stripe Checkout session creator.
 *
 * TODO: When the Stripe API key is provided, replace the body of this handler
 * with a real Stripe call:
 *
 *   import Stripe from "stripe";
 *   const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
 *   const session = await stripe.checkout.sessions.create({
 *     mode: "payment",
 *     line_items: [{ price_data: {
 *       currency: "usd",
 *       unit_amount: 2999,
 *       product_data: { name: "Personalized StoryNest ebook" },
 *     }, quantity: 1 }],
 *     success_url: `${origin}/checkout/success?book_id=${data.bookId}&session_id={CHECKOUT_SESSION_ID}`,
 *     cancel_url: `${origin}/checkout/cancel?book_id=${data.bookId}`,
 *     metadata: { book_id: data.bookId, user_id: context.userId },
 *   });
 *   return { url: session.url!, sessionId: session.id };
 *
 * The frontend just needs `{ url }` to redirect to.
 */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        bookId: z.string().uuid(),
        origin: z.string().url(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    // Stub: skip Stripe entirely and pretend the customer paid immediately.
    const fakeSessionId = `stub_${crypto.randomUUID()}`;
    const url = `${data.origin}/checkout/success?book_id=${data.bookId}&session_id=${fakeSessionId}&stub=1`;
    return { url, sessionId: fakeSessionId, stub: true as const };
  });
