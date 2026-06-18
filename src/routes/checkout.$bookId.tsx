import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Lock, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { WizardLayout } from "@/components/wizard-layout";
import { createCheckoutSession } from "@/lib/checkout.functions";

const PRICE_USD = 29.99;

export const Route = createFileRoute("/checkout/$bookId")({
  head: () => ({
    meta: [
      { title: "Checkout — StoryNest" },
      { name: "description", content: "Complete your personalized ebook purchase." },
    ],
  }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { bookId } = Route.useParams();
  const navigate = useNavigate();
  const checkout = useServerFn(createCheckoutSession);

  const [book, setBook] = useState<{ title: string | null; child_name: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  // The internal HYPERDRIVETEST coupon field is intentionally hidden from
  // regular parents. It appears only when (a) the signed-in user has the
  // 'admin' role or (b) the URL carries ?testcoupon=1 (QA affordance).
  const [showCouponField, setShowCouponField] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("books")
        .select("title, child_name")
        .eq("id", bookId)
        .maybeSingle();
      const { data: userData } = await supabase.auth.getUser();
      let isAdmin = false;
      if (userData.user) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userData.user.id);
        isAdmin = (roles ?? []).some((r) => r.role === "admin");
      }
      const urlFlag =
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("testcoupon") === "1";
      if (!cancelled) {
        setBook(data ?? null);
        setShowCouponField(isAdmin || urlFlag);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  async function startCheckout() {
    setPaying(true);
    try {
      const { url, internalTestOrder } = await checkout({
        data: { bookId, origin: window.location.origin, couponCode: couponCode || undefined },
      });
      if (internalTestOrder) toast.success("Internal test coupon applied — book queued without payment.");
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start checkout");
      setPaying(false);
    }
  }

  return (
    <WizardLayout>
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h1 className="font-display text-3xl font-semibold">Create my book</h1>
          <p className="mt-2 text-muted-foreground">
            One-time purchase. Your personalized ebook is generated as soon as payment clears.
          </p>
        </div>

        <div data-testid="checkout-price-card" className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="font-medium">Personalized StoryNest ebook</div>
              <div className="text-sm text-muted-foreground">
                {loading
                  ? "Loading…"
                  : book?.title || (book?.child_name ? `A story for ${book.child_name}` : "Your custom storybook")}
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-2xl font-semibold">${PRICE_USD.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">USD · one-time</div>
            </div>
          </div>

          <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
            <li>• Custom cover + dedication + 10 story pages</li>
            <li>• Designed for ages 2–10</li>
            <li>• Your approved character on every page</li>
            <li>• Web reader + downloadable PDF</li>
            <li>• Free regenerations of any single page</li>
          </ul>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="font-medium">Optional add-ons</div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Coming soon</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Previewing what will be available at checkout. Nothing extra is charged today.</p>
          <ul className="mt-4 space-y-3 text-sm">
            {[
              { name: "Read-aloud narration", price: "+$9", note: "Beta" },
              { name: "Printed hardcover copy", price: "+$24", note: "Coming soon" },
              { name: "Grandparent gift copy (PDF)", price: "+$5", note: "Coming soon" },
            ].map((a) => (
              <li key={a.name} className="flex items-center justify-between rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 opacity-70">
                <div>
                  <div className="text-foreground">{a.name}</div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{a.note}</div>
                </div>
                <div className="text-sm text-muted-foreground">{a.price}</div>
              </li>
            ))}
          </ul>
        </div>

        {showCouponField && (
          <div className="rounded-2xl border border-dashed bg-muted/30 p-4 shadow-sm">
            <label htmlFor="coupon" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Internal test coupon (admin only)
            </label>
            <input
              id="coupon"
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="Enter test code"
              className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm"
              autoComplete="off"
            />
          </div>
        )}

        <Button
          data-testid="checkout-cta"
          variant="ember"
          className="w-full"
          size="lg"
          onClick={startCheckout}
          disabled={paying || loading}
        >
          {paying ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
          {paying ? "Redirecting to checkout…" : `Create my book — $${PRICE_USD.toFixed(2)}`}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Payments are processed securely. We never store card details.
        </p>

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate({ to: "/create/character-sheet" })}
          >
            <ArrowLeft className="h-4 w-4" /> Back to character
          </Button>
          <Link to="/library" className="text-sm text-muted-foreground hover:text-foreground">
            Cancel
          </Link>
        </div>
      </div>
    </WizardLayout>
  );
}
