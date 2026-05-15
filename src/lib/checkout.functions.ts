import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const INTERNAL_TEST_COUPON = "HYPERDRIVETEST";

/**
 * Stripe Checkout session creator (currently stubbed).
 *
 * Supports an internal 100% off testing coupon: HYPERDRIVETEST.
 * Restricted to admins (user_roles.role = 'admin'). When applied, the book
 * is marked as paid + generating WITHOUT charging anything, and a payments
 * row is inserted with metadata { coupon_code, internal_test_order: true }
 * so the rest of the pipeline runs end-to-end as if Stripe had cleared.
 *
 * Stripe dashboard manual step (when Stripe is wired up later): create a
 * 100% off Promotion Code with code "HYPERDRIVETEST" restricted to internal
 * use, OR keep this server-side bypass and skip Stripe entirely for it.
 */
export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        bookId: z.string().uuid(),
        origin: z.string().url(),
        couponCode: z.string().trim().min(1).max(64).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const couponCode = data.couponCode?.toUpperCase();

    if (couponCode === INTERNAL_TEST_COUPON) {
      // Admin-only path. RLS on user_roles already lets a user read their own row.
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
      if (!isAdmin) {
        throw new Error("This coupon is for internal testing only.");
      }

      // Mark the book paid + start generation, no Stripe call.
      const fakeSessionId = `internal_test_${crypto.randomUUID()}`;
      await supabase.from("payments").insert({
        user_id: userId,
        book_id: data.bookId,
        provider: "internal",
        provider_session_id: fakeSessionId,
        amount_cents: 0,
        currency: "usd",
        status: "succeeded",
        metadata: {
          coupon_code: INTERNAL_TEST_COUPON,
          internal_test_order: true,
        },
      });
      await supabase.from("books").update({ status: "generating" }).eq("id", data.bookId);

      const url = `${data.origin}/checkout/success?book_id=${data.bookId}&session_id=${fakeSessionId}&coupon=${INTERNAL_TEST_COUPON}`;
      return { url, sessionId: fakeSessionId, stub: true as const, internalTestOrder: true };
    }

    // Default stub path (replace with real Stripe call when keys are wired).
    const fakeSessionId = `stub_${crypto.randomUUID()}`;
    const url = `${data.origin}/checkout/success?book_id=${data.bookId}&session_id=${fakeSessionId}&stub=1`;
    return { url, sessionId: fakeSessionId, stub: true as const, internalTestOrder: false };
  });
