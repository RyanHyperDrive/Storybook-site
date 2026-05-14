import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowRight,
  Sparkles,
  Camera,
  BookOpen,
  ShieldCheck,
  Wand2,
  RefreshCcw,
  Heart,
  Mail,
  FileText,
} from "lucide-react";
import hero from "@/assets/hero-reading.jpg";
import { ART_STYLES, type ArtStyleKey } from "@/lib/art-styles";
import { StyleArtwork } from "@/components/style-artwork";
import { SampleBookModal } from "@/components/sample-book-modal";
import { useSampleAssets, SAMPLE_KEY_BY_STYLE } from "@/hooks/use-sample-assets";

export const Route = createFileRoute("/")({
  component: Home,
});

// Sample books: one per MVP art style so parents see the full range.
const samples = ART_STYLES.map((s) => ({
  key: s.key,
  title: s.sampleTitle,
  age: "Ages 4–7",
  styleName: s.name,
}));

const faqs = [
  {
    q: "Are my child's photos private?",
    a: "Yes. Photos you upload are private to your account, encrypted at rest, and used only to create your child's illustrated character. We never sell them and never use them to train models.",
  },
  {
    q: "How long does a book take?",
    a: "About 10–20 minutes from approving the character to a finished book. We email you the moment it's ready so you don't have to wait on the screen.",
  },
  {
    q: "What's actually in the book?",
    a: "A custom cover, a personal dedication page, and 10 fully illustrated story pages — read in your browser or download as a printable PDF.",
  },
  {
    q: "What if the character doesn't look right?",
    a: "You approve the illustrated character before the story is generated. If something looks off, regeneration is free until you're happy.",
  },
  {
    q: "Can I make a book for twins or siblings?",
    a: "The MVP supports one starring child per book. For twins or siblings, create a book per child — we're working on a multi-child story mode next.",
  },
  {
    q: "Is it readable for kids with low vision or dyslexia?",
    a: "The web reader uses high-contrast text, generous spacing, and a dyslexia-friendly font option. Image alt text describes every illustration.",
  },
  {
    q: "Refunds?",
    a: "If free regeneration doesn't get the character right, email support and we'll fix it or refund you in full.",
  },
  {
    q: "Is this made with AI?",
    a: "Yes. Stories and illustrations are created with AI and reviewed through parent approval and quality checks before delivery.",
  },
];

function Home() {
  const [openKey, setOpenKey] = useState<ArtStyleKey | null>(null);
  const { assets } = useSampleAssets();
  return (
    <div className="overflow-x-hidden">
      <SampleBookModal
        styleKey={openKey}
        open={openKey !== null}
        onOpenChange={(v) => !v && setOpenKey(null)}
      />
      {/* HERO */}
      <section className="bg-warm-grad">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:py-16 md:grid-cols-2 md:py-24">
          <div className="min-w-0">
            <Badge className="bg-sage/15 text-sage hover:bg-sage/15" variant="secondary">
              <Sparkles className="mr-1 h-3.5 w-3.5" /> Built for ages 4–7
            </Badge>
            <h1 className="mt-4 font-display text-[2rem] font-semibold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
              A storybook starring{" "}
              <span className="text-ember">your child</span>.
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
              Create a personalized illustrated storybook starring your child. Upload a clear
              photo, share what they love, approve their illustrated character, and receive a
              custom ebook made for reading together.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link to="/create" className="w-full sm:w-auto">
                <Button size="lg" variant="ember" className="w-full sm:w-auto">
                  Create a storybook — $29.99
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
              <Link
                to="/pricing"
                className="text-center text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
              >
                See what's included
              </Link>
            </div>
            <ul className="mt-8 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sage" /> Photos stay private to you</li>
              <li className="flex items-start gap-2"><RefreshCcw className="mt-0.5 h-4 w-4 shrink-0 text-sage" /> Free regeneration if it looks off</li>
              <li className="flex items-start gap-2"><Wand2 className="mt-0.5 h-4 w-4 shrink-0 text-sage" /> Parent-approved illustrated character</li>
              <li className="flex items-start gap-2"><BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-sage" /> Web reader + downloadable PDF</li>
            </ul>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-lg border border-border shadow-[0_30px_60px_-30px_oklch(0.22_0.03_260/0.35)]">
              <img
                src={hero}
                alt="A parent and child reading a storybook together"
                width={1536}
                height={1152}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="absolute -bottom-4 left-4 hidden rounded-md border border-border bg-background p-3 shadow-lg sm:flex sm:items-center sm:gap-3 md:-bottom-6 md:-left-6 md:p-4">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-ember/15 text-ember">
                <Heart className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold">Made for reading together</div>
                <div className="text-xs text-muted-foreground">Parent-approved before checkout</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
        <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Four small steps. One book they'll never forget.
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 md:mt-10 md:grid-cols-4">
          {[
            { icon: Camera, title: "Add a photo", body: "One clear, well-lit photo so we can sketch the character." },
            { icon: Heart, title: "Share what they love", body: "Their name, age, and the things that make them light up." },
            { icon: Wand2, title: "Approve the character", body: "Review the illustrated version. Regenerate free until it feels right." },
            { icon: BookOpen, title: "Read together", body: "Cover, dedication, and 10 illustrated pages — ready in 10–20 minutes." },
          ].map(({ icon: Icon, title, body }, i) => (
            <div key={i} className="rounded-lg border border-border bg-background p-5">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-ember/15 text-ember">
                <Icon className="h-4 w-4" />
              </div>
              <div className="mt-4 text-sm font-semibold">{i + 1}. {title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SAMPLES — illustration-only placeholder cards, all text rendered as HTML */}
      <section id="examples" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              What a finished book looks like
            </h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Each book is a custom cover, a dedication, and 10 illustrated story pages. Real customer books appear here once parents opt in to share.
            </p>
          </div>
          <Link to="/create" className="text-sm font-medium text-ember underline-offset-4 hover:underline">
            Create yours →
          </Link>
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {samples.map((s) => (
            <button
              type="button"
              key={s.key}
              onClick={() => setOpenKey(s.key)}
              className="group overflow-hidden rounded-lg border border-border bg-background text-left transition-all hover:-translate-y-0.5 hover:border-ember/50 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ember"
              aria-label={`Preview sample book in ${s.styleName} style`}
            >
              <div className="relative aspect-[4/5] overflow-hidden">
                <StyleArtwork styleKey={s.key} variant="cover" />
                <div className="absolute left-3 top-3 rounded-full bg-background/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                  {s.styleName}
                </div>
                <div className="absolute right-3 top-3 rounded-full bg-foreground/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-background opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                  Preview →
                </div>
              </div>
              <div className="p-4">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Sample cover concept
                </div>
                <div className="mt-1 font-display text-base font-semibold leading-tight">
                  {s.title}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {s.styleName} · {s.age}
                </div>
              </div>
            </button>
          ))}
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Stories and illustrations are created with AI and reviewed through parent approval and quality checks.
        </p>
      </section>

      {/* PRICING + PROMISE */}
      <section className="bg-paper/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:py-16 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-background p-6 sm:p-8">
            <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">One book</div>
            <div className="mt-1 flex items-baseline gap-2">
              <div className="font-display text-4xl font-semibold sm:text-5xl">$29.99</div>
              <div className="text-sm text-muted-foreground">one-time</div>
            </div>
            <ul className="mt-6 space-y-2 text-sm text-foreground">
              <li>✓ Cover + dedication + 10 illustrated pages</li>
              <li>✓ Built for ages 4–7</li>
              <li>✓ Parent-approved illustrated character</li>
              <li>✓ Free regeneration if something looks off</li>
              <li>✓ Web reader + downloadable PDF</li>
              <li>✓ Ready in about 10–20 minutes — we email you</li>
            </ul>
            <Link to="/create" className="mt-7 inline-block w-full sm:w-auto">
              <Button variant="ember" size="lg" className="w-full sm:w-auto">Start your book</Button>
            </Link>
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Our promise to parents</h2>
            <div className="mt-6 grid gap-4">
              <Promise title="Privacy first" body="Your photos are private to your account. We never sell them and never use them to train models." icon={ShieldCheck} />
              <Promise title="Parent-approved character" body="You always review the illustrated character before the story is generated. Free regeneration if it doesn't feel right." icon={RefreshCcw} />
              <Promise title="Real children's-book quality" body="Warm illustrations, thoughtful pacing, and language tuned for ages 4–7." icon={BookOpen} />
              <Promise title="Web + PDF" body="Read in any browser or download a print-ready PDF — yours to keep." icon={FileText} />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-14 sm:py-16">
        <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Questions parents ask
        </h2>
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
          Still have a question? Email{" "}
          <a href="mailto:hello@storynest.app" className="font-medium text-foreground underline-offset-4 hover:underline">
            hello@storynest.app
          </a>
        </div>
      </section>
    </div>
  );
}

function Promise({ title, body, icon: Icon }: { title: string; body: string; icon: any }) {
  return (
    <div className="flex gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-sage/15 text-sage">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
