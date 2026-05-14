import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Check, Mail, Mic, RefreshCcw, Gift } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  component: Pricing,
  head: () => ({
    meta: [
      { title: "Pricing — StoryNest" },
      {
        name: "description",
        content:
          "$29.99 one-time per personalized illustrated storybook. Includes a custom cover, dedication, and at least 10 illustrated story pages, with pacing and length adapted to your child's age — ready in about 10–20 minutes.",
      },
    ],
  }),
});

const features = [
  "Custom cover, dedication, and at least 10 illustrated story pages",
  "Personalized for ages 2–10 — reading level adapts to your child",
  "Parent-approved illustrated character",
  "Free regeneration if it doesn't feel right",
  "Web reader + downloadable PDF",
  "Ready in about 10–20 minutes — we email you",
  "Stored privately in your library",
];

const addons = [
  {
    icon: Mic,
    title: "Read-aloud narration",
    price: "+$5",
    body: "A warm voice reads the book to your child, page by page.",
    badge: "Coming soon",
  },
  {
    icon: RefreshCcw,
    title: "Extra regeneration pack",
    price: "Included while in beta",
    body: "Re-roll any page illustration if a detail looks off.",
    badge: "Included",
  },
  {
    icon: Gift,
    title: "Grandparent gift copy",
    price: "+$9",
    body: "A second printable PDF + a personal gift note for a loved one.",
    badge: "Coming soon",
  },
];

const faqs = [
  {
    q: "What's included for $29.99?",
    a: "One personalized storybook: a custom cover, a dedication page, and at least 10 illustrated story pages (more for older kids). You can read it in any browser and download it as a printable PDF.",
  },
  {
    q: "How long does it take?",
    a: "About 10–20 minutes from approving the character to a finished book. We email you the moment it's ready.",
  },
  {
    q: "Are my child's photos private?",
    a: "Yes. Photos are private to your account, encrypted at rest, and used only to create your child's illustrated character. We never sell them and never use them to train models.",
  },
  {
    q: "What if the character doesn't look right?",
    a: "Regeneration is free until you approve the character. Nothing is generated for the full book until you say it's right.",
  },
  {
    q: "Can I get a refund?",
    a: "Yes. If free regeneration doesn't get the character right, email support and we'll fix it or refund you in full.",
  },
  {
    q: "Is it accessible?",
    a: "The web reader uses high-contrast text, generous spacing, and a dyslexia-friendly font option. Every illustration has descriptive alt text.",
  },
  {
    q: "Is this made with AI?",
    a: "Yes. Stories and illustrations are created with AI and reviewed through parent approval and quality checks before delivery.",
  },
];

function Pricing() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <h1 className="text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
        Simple pricing
      </h1>
      <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
        One book at a time. No subscription. You'll see your child's illustrated character before you ever pay.
      </p>
      <p className="mx-auto mt-3 flex max-w-lg items-center justify-center gap-2 text-center text-sm font-medium text-sage">
        <Check className="h-4 w-4 shrink-0" />
        No payment until you approve the character preview.
      </p>

      <div className="mt-10 rounded-lg border border-border bg-background p-6 shadow-sm sm:p-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-baseline">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">One book · pay after approval</div>
            <div className="mt-1 font-display text-4xl font-semibold sm:text-5xl">
              $29.99 <span className="text-base font-normal text-muted-foreground">one-time · no subscription</span>
            </div>
          </div>
          <Link to="/create" className="w-full sm:w-auto">
            <Button variant="ember" size="lg" className="w-full sm:w-auto">Start free character preview</Button>
          </Link>
        </div>
        <ul className="mt-8 grid gap-2 text-sm sm:grid-cols-2">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-sage" /> {f}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <h2 className="font-display text-xl font-semibold tracking-tight">Optional add-ons</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Make the book go further. Add-ons are optional — your $29.99 book is complete on its own.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {addons.map(({ icon: Icon, title, price, body, badge }) => (
            <div
              key={title}
              className="flex flex-col rounded-lg border border-border bg-background p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-md bg-ember/15 text-ember">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="rounded-full bg-paper/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {badge}
                </span>
              </div>
              <div className="mt-3 text-sm font-semibold">{title}</div>
              <div className="text-xs text-muted-foreground">{price}</div>
              <p className="mt-2 text-xs text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 rounded-md border border-border bg-paper/40 p-5 text-sm text-muted-foreground sm:p-6">
        <span className="font-semibold text-foreground">Refund promise:</span> If something looks off
        and our free regeneration doesn't get it right, just write to us — we'll make it right or
        refund you in full.
      </div>

      <h2 className="mt-14 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
        Questions parents ask
      </h2>
      <Accordion type="single" collapsible className="mt-4">
        {faqs.map((f, i) => (
          <AccordionItem key={i} value={`faq-${i}`}>
            <AccordionTrigger className="text-left text-base font-semibold">{f.q}</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <div className="mt-8 flex flex-wrap items-center gap-2 rounded-md border border-border bg-paper/40 p-4 text-sm text-muted-foreground">
        <Mail className="h-4 w-4 text-sage" />
        Questions? Email{" "}
        <a href="mailto:hello@storynest.app" className="font-medium text-foreground underline-offset-4 hover:underline">
          hello@storynest.app
        </a>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Stories and illustrations are created with AI and reviewed through parent approval and quality checks.
      </p>
    </div>
  );
}
