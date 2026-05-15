import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WizardLayout } from "@/components/wizard-layout";

const searchSchema = z.object({
  book_id: z.string().uuid().optional(),
});

export const Route = createFileRoute("/checkout/cancel")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Checkout cancelled — StoryNest" },
      { name: "description", content: "Your purchase was cancelled. No charges were made." },
    ],
  }),
  component: CancelPage,
});

function CancelPage() {
  const { book_id } = Route.useSearch();
  const navigate = useNavigate();

  return (
    <WizardLayout>
      <div data-testid="checkout-cancel" className="mx-auto max-w-xl space-y-6 text-center">
        <XCircle className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="font-display text-3xl font-semibold">Checkout cancelled</h1>
        <p className="text-muted-foreground">
          No worries — your character is saved and we didn't charge you. You can finish checkout
          whenever you're ready.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          {book_id && (
            <Button
              variant="ember"
              onClick={() => navigate({ to: "/checkout/$bookId", params: { bookId: book_id } })}
            >
              Try again
            </Button>
          )}
          <Link to="/library">
            <Button variant="ghost">Go to my library</Button>
          </Link>
        </div>
      </div>
    </WizardLayout>
  );
}
