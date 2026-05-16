import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Check,
  Mail,
  Mic,
  RefreshCcw,
  Gift,
  ShieldCheck,
  Lock,
  Sparkles,
  Clock,
  BookOpen,
  CreditCard,
  Star,
  Wand2,
  Heart,
  ArrowRight,
} from "lucide-react";
import sampleWatercolor from "@/assets/sample-watercolor-pip.jpg";
import sampleWatercolorPage1 from "@/assets/sample-watercolor-pip-page1.jpg";
import sampleWatercolorPage2 from "@/assets/sample-watercolor-pip-page2.jpg";
import sampleCartoon from "@/assets/sample-cartoon-leo.jpg";
import sampleComic from "@/assets/sample-comic-nova.jpg";
import sampleManga from "@/assets/sample-manga-yuki.jpg";

export const Route = createFileRoute("/pricing")({
  component: Pricing,
  head: () => ({
    meta: [
      { title: "Pricing — StoryNest" },
      {
        name: "description",
        content:
          "$29.99 one-time per personalized illustrated storybook. Custom cover + dedication + 10 story pages, designed for ages 4–7 — ready in about 10–20 minutes.",
      },
    ],
  }),
});

const features = [
  "Custom cover + dedication + 10 story pages",
  "Designed for ages 4–7 — reading level adapts to your child",
  "Choose from 4 art styles (watercolor, soft cartoon, comic, manga)",
  "Parent-approved illustrated character before payment",
  "Free regeneration if it doesn't feel right",
  "Web reader + downloadable printable PDF",
  "Ready in about 10–20 minutes — we email you",
  "Stored privately in your library",
];

const trustBullets = [
  { icon: ShieldCheck, text: "No payment until you approve the character" },
  { icon: Lock, text: "Photos private, encrypted, never used to train models" },
  { icon: RefreshCcw, text: "Free regeneration & full refund if it's not right" },
  { icon: CreditCard, text: "Secure checkout · one-time charge, no subscription" },
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
    a: "One personalized storybook: a custom cover, a dedication, and 10 illustrated story pages, designed for ages 4–7. You can read it in any browser and download it as a printable PDF, stored privately in your library.",
  },
  {
    q: "When am I actually charged?",
    a: "Only after you approve the illustrated character preview. You can upload a photo, see the character, and back out at zero cost. No subscription, no recurring charges — one-time $29.99 per book.",
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
    q: "How long does it take?",
    a: "About 10–20 minutes from approving the character to a finished book. We email you the moment it's ready.",
  },
  {
    q: "Can I get a refund?",
    a: "Yes. If free regeneration doesn't get the character right, email support and we'll fix it or refund you in full.",
  },
  {
    q: "Is it readable for kids with low vision or dyslexia?",
    a: "The web reader uses high-contrast text, generous spacing, and a dyslexia-friendly font option. Every illustration has descriptive alt text. Reading level adapts from board-book to early-reader so the page feels right for ages 2–10.",
  },
  {
    q: "Is this made with AI?",
    a: "Yes. Stories and illustrations are created with AI and reviewed through parent approval and quality checks before delivery.",
  },
];

function Pricing() {
  return (
    <div className="overflow-x-hidden">
      {/* HERO — offer + product proof composition */}
      <section
        data-testid="pricing-hero"
        className="relative overflow-hidden bg-warm-grad"
      >
        <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-ember/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 right-[-6rem] h-80 w-80 rounded-full bg-sage/15 blur-3xl" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 pb-12 sm:pt-14 md:grid-cols-[1.05fr_1fr] md:gap-12 md:pt-16 md:pb-16">
          {/* LEFT — pricing card */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-sage/15 text-sage hover:bg-sage/15" variant="secondary">
                <Sparkles className="mr-1 h-3.5 w-3.5" /> Simple, one-time pricing
              </Badge>
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/70 px-2.5 py-0.5 text-[11px] font-medium text-foreground/80 backdrop-blur">
                <Clock className="h-3 w-3 text-ember" /> Ready in 10–20 min
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/70 px-2.5 py-0.5 text-[11px] font-medium text-foreground/80 backdrop-blur">
                <BookOpen className="h-3 w-3 text-ember" /> 10+ illustrated pages
              </span>
            </div>

            <h1 className="mt-4 font-display text-[2rem] font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-[3.2rem]">
              One book.{" "}
              <span className="text-ember">$29.99.</span>{" "}
              <br className="hidden sm:block" />
              Pay only after you approve.
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground md:text-[1.05rem]">
              No subscription. No surprise upsells. You see your child's illustrated character before you ever pay — and only then do we build the full storybook.
            </p>

            {/* Pricing card */}
            <div
              data-testid="pricing-card"
              className="mt-6 rounded-xl border border-border bg-background/90 p-5 shadow-[0_18px_40px_-24px_oklch(0.22_0.03_260/0.45)] backdrop-blur sm:p-6"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <div className="font-display text-4xl font-semibold leading-none sm:text-5xl">$29.99</div>
                <div className="text-sm text-muted-foreground">one-time · per personalized book</div>
              </div>
              <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Web reader + downloadable PDF · stored privately in your library
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Link to="/create" className="w-full sm:w-auto">
                  <Button size="lg" variant="ember" className="w-full sm:w-auto">
                    Start free character preview
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
                <span className="text-center text-xs text-muted-foreground sm:text-left">
                  Takes ~2 minutes · no credit card to start
                </span>
              </div>

              <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-sage">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                You only pay after you approve the illustrated character.
              </p>

              <ul className="mt-4 grid gap-2 border-t border-border pt-4 text-sm text-foreground/85 sm:grid-cols-2">
                {trustBullets.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-2">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-sage" /> {text}
                  </li>
                ))}
              </ul>
            </div>

            {/* Sample style strip */}
            <a href="/examples" className="group mt-5 flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground">
              <div className="flex -space-x-2">
                {[sampleWatercolor, sampleCartoon, sampleComic, sampleManga].map((src, i) => (
                  <span
                    key={i}
                    className="grid h-9 w-9 place-items-center overflow-hidden rounded-md border-2 border-background bg-paper shadow-sm"
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </span>
                ))}
              </div>
              <span>
                <span className="font-medium text-foreground">4 art styles included</span> — see real samples
                <span className="ml-1 inline-block transition-transform group-hover:translate-x-0.5">→</span>
              </span>
            </a>
          </div>

          {/* RIGHT — layered product preview */}
          <div className="relative mx-auto w-full max-w-md md:max-w-none">
            <div className="relative aspect-[4/5] w-full">
              <div className="absolute left-0 top-6 w-[68%] -rotate-6 overflow-hidden rounded-md border border-border bg-background shadow-[0_28px_55px_-28px_oklch(0.22_0.03_260/0.55)]">
                <img
                  src={sampleWatercolorPage1}
                  alt="Sample illustrated storybook spread"
                  width={900}
                  height={900}
                  loading="eager"
                  className="block h-full w-full object-cover"
                />
              </div>

              <div className="absolute right-0 top-0 w-[62%] rotate-3">
                <span aria-hidden className="absolute inset-y-2 right-[-3px] w-[3px] rounded-r-sm bg-foreground/15" />
                <span aria-hidden className="absolute inset-y-4 right-[-6px] w-[2px] rounded-r-sm bg-foreground/10" />
                <div className="relative overflow-hidden rounded-md border border-border bg-background shadow-[0_30px_60px_-22px_oklch(0.22_0.03_260/0.55)]">
                  <span aria-hidden className="absolute inset-y-0 left-0 z-10 w-[6px] bg-gradient-to-b from-foreground/30 via-foreground/10 to-foreground/30" />
                  <img
                    src={sampleWatercolor}
                    alt="Sample StoryNest book cover"
                    width={900}
                    height={1200}
                    className="block aspect-[3/4] w-full object-cover"
                  />
                  <div className="absolute left-2 top-2 rounded-full bg-foreground/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-background backdrop-blur">
                    $29.99
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-2 left-2 w-[58%] rounded-lg border border-border bg-background p-2.5 shadow-[0_18px_40px_-18px_oklch(0.22_0.03_260/0.45)] sm:left-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border">
                    <img src={sampleWatercolorPage2} alt="Illustrated character preview" className="h-full w-full object-cover" loading="lazy" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Character preview</div>
                    <div className="truncate text-sm font-semibold text-foreground">Free until you approve</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1.5 rounded-md bg-sage/10 px-2 py-1 text-[11px] font-semibold text-sage">
                  <Check className="h-3.5 w-3.5" /> No charge before this step
                </div>
              </div>

              <div className="absolute -right-1 top-2 hidden rounded-md border border-border bg-background px-3 py-2 text-xs shadow-lg sm:block">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Star className="h-3.5 w-3.5 fill-ember text-ember" /> Real children's-book quality
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">Warm illustrations · adaptive reading level</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT'S INCLUDED */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:py-14">
        <div className="text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ember">What's included</div>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
            Everything in one $29.99 book
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            No tiers, no "pro" plan. Every book includes the full experience.
          </p>
        </div>
        <ul className="mx-auto mt-8 grid max-w-3xl gap-3 text-sm sm:grid-cols-2">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2 rounded-md border border-border bg-background/60 p-3">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-sage" /> <span>{f}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ADD-ONS */}
      <section data-testid="pricing-addons" className="mx-auto max-w-5xl px-4 pb-4">
        <div className="flex flex-col items-start gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ember">Optional</div>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
              Add-ons (totally optional)
            </h2>
          </div>
          <p className="text-sm text-muted-foreground md:max-w-sm md:text-right">
            Your $29.99 book is complete on its own. No upsell pressure.
          </p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {addons.map(({ icon: Icon, title, price, body, badge }) => (
            <div
              key={title}
              className="flex flex-col rounded-lg border border-border bg-background p-4 shadow-sm"
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
      </section>

      {/* GUARANTEES BAND */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:py-14">
        <div className="grid gap-4 rounded-xl border border-border bg-paper/50 p-5 sm:grid-cols-3 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-sage/15 text-sage">
              <Wand2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Approve before you pay</div>
              <p className="mt-1 text-xs text-muted-foreground">
                See the illustrated character first. Walk away at zero cost if it isn't right.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-sage/15 text-sage">
              <RefreshCcw className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Make-it-right promise</div>
              <p className="mt-1 text-xs text-muted-foreground">
                If a page looks off, regeneration is free. If we still can't fix it, full refund.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-sage/15 text-sage">
              <Heart className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Built for parents</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Private library, encrypted photos, never used to train AI models.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section data-testid="pricing-faq" className="mx-auto max-w-3xl px-4 pb-16">
        <div className="text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ember">FAQ</div>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Questions parents ask
          </h2>
        </div>
        <Accordion type="single" collapsible className="mt-6">
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

        {/* Final CTA */}
        <div className="mt-8 rounded-xl border border-border bg-background p-5 text-center shadow-sm sm:p-6">
          <div className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
            Ready to see your child as the hero?
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Free character preview · pay $29.99 only after you approve.
          </p>
          <Link to="/create" className="mt-4 inline-block">
            <Button size="lg" variant="ember">
              Start free character preview
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Stories and illustrations are created with AI and reviewed through parent approval and quality checks.
        </p>
      </section>
    </div>
  );
}
