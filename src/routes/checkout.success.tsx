import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { WizardLayout } from "@/components/wizard-layout";
import { clearDraftId } from "@/lib/draft";

const searchSchema = z.object({
  book_id: z.string().uuid().optional(),
  session_id: z.string().optional(),
  stub: z.coerce.number().optional(),
});

export const Route = createFileRoute("/checkout/success")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Payment received — StoryNest" },
      { name: "description", content: "Your storybook is being generated." },
    ],
  }),
  component: SuccessPage,
});

function SuccessPage() {
  const { book_id, session_id } = Route.useSearch();
  const navigate = useNavigate();
  const ranRef = useRef(false);
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      try {
        if (!book_id) throw new Error("Missing book reference.");
        const { data: auth } = await supabase.auth.getUser();
        const user = auth.user;
        if (!user) throw new Error("Please sign in to continue.");

        // 1. Record the payment (idempotent on session id).
        const { data: existing } = await supabase
          .from("payments")
          .select("id")
          .eq("provider_session_id", session_id ?? "")
          .maybeSingle();
        if (!existing) {
          await supabase.from("payments").insert({
            user_id: user.id,
            book_id,
            provider: "stripe",
            provider_session_id: session_id ?? null,
            amount_cents: 2999,
            currency: "usd",
            status: "succeeded",
          });
        }

        // 2. Mark book as generating.
        await supabase.from("books").update({ status: "generating" }).eq("id", book_id);

        // 3. Kick off (or reuse) the generation job.
        const { data: existingJob } = await supabase
          .from("jobs")
          .select("id")
          .eq("book_id", book_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let id = existingJob?.id ?? null;
        if (!id) {
          const { data: job, error: jobErr } = await supabase
            .from("jobs")
            .insert({
              book_id,
              user_id: user.id,
              kind: "book",
              status: "queued",
              progress: 5,
            })
            .select("id")
            .single();
          if (jobErr) throw jobErr;
          id = job.id;
        }

        setJobId(id);
        setState("done");
      } catch (e: any) {
        setError(e?.message ?? "Something went wrong finalizing your order.");
        setState("error");
      }
    })();
  }, [book_id, session_id]);

  return (
    <WizardLayout>
      <div className="mx-auto max-w-xl space-y-6 text-center">
        {state === "working" && (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <h1 className="font-display text-3xl font-semibold">Confirming your payment…</h1>
            <p className="text-muted-foreground">Hang tight, this only takes a second.</p>
          </>
        )}

        {state === "done" && (
          <div data-testid="checkout-success-done">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <h1 className="font-display text-3xl font-semibold">Payment received</h1>
            <p className="text-muted-foreground">
              We're generating your storybook now. Keep this page open while we create your book. You can also find it anytime in your Library.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              {jobId && (
                <Button
                  variant="ember"
                  onClick={() => navigate({ to: "/jobs/$jobId", params: { jobId } })}
                >
                  Watch progress
                </Button>
              )}
              <Link to="/library">
                <Button variant="ghost">Go to my library</Button>
              </Link>
            </div>
          </div>
        )}

        {state === "error" && (
          <>
            <h1 className="font-display text-3xl font-semibold">We hit a snag</h1>
            <p className="text-muted-foreground">{error}</p>
            <Link to="/library">
              <Button variant="ghost">Back to library</Button>
            </Link>
          </>
        )}
      </div>
    </WizardLayout>
  );
}
