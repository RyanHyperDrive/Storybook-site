import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  component: Pricing,
  head: () => ({
    meta: [
      { title: "Pricing — StoryNest" },
      { name: "description", content: "Simple, one-time pricing — $29.99 per personalized illustrated storybook." },
    ],
  }),
});

const features = [
  "12 fully illustrated pages",
  "Parent-approved illustrated character",
  "Free regeneration if it doesn't feel right",
  "Printable PDF + readable ebook",
  "Stored privately in your library",
  "Custom story tuned to your child's age",
];

function Pricing() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-center font-display text-4xl font-semibold md:text-5xl">Simple pricing</h1>
      <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
        One book at a time, no subscription. Pay only when you're happy with the character.
      </p>

      <div className="mt-10 rounded-lg border border-border bg-background p-8 shadow-sm">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">One book</div>
            <div className="mt-1 font-display text-5xl font-semibold">$29.99</div>
          </div>
          <Link to="/create"><Button variant="ember" size="lg">Create a book</Button></Link>
        </div>
        <ul className="mt-8 grid gap-2 text-sm sm:grid-cols-2">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2"><Check className="h-4 w-4 text-sage" /> {f}</li>
          ))}
        </ul>
      </div>

      <div className="mt-10 rounded-md border border-border bg-paper/40 p-6 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">Refund promise:</span> If something looks off and our free regeneration
        doesn't get it right, just write to us — we'll make it right or refund you.
      </div>
    </div>
  );
}
