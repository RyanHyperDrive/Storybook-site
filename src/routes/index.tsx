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
import sampleClassic from "@/assets/sample-classic-mira.jpg";
import sampleCartoon from "@/assets/sample-cartoon-leo.jpg";
import sampleWatercolor from "@/assets/sample-watercolor-pip.jpg";
import sampleManga from "@/assets/sample-manga-yuki.jpg";
import { ART_STYLES, type ArtStyleKey } from "@/lib/art-styles";
import { StyleArtwork } from "@/components/style-artwork";
import { SampleBookModal } from "@/components/sample-book-modal";
import { useSampleAssets, SAMPLE_KEY_BY_STYLE } from "@/hooks/use-sample-assets";

const SAMPLE_COVER_FALLBACK: Record<ArtStyleKey, string> = {
  classic_storybook: sampleClassic,
  soft_cartoon: sampleCartoon,
  watercolor_adventure: sampleWatercolor,
  manga_inspired: sampleManga,
};

export const Route = createFileRoute("/")({
  component: Home,
});

// Sample books: one per MVP art style so parents see the full range.
const samples = ART_STYLES.map((s) => ({
  key: s.key,
  title: s.sampleTitle,
  age: "Personalized for ages 2–10",
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
    a: "A custom cover, a personal dedication page, and at least 10 fully illustrated story pages (more for older kids) — read in your browser or download as a printable PDF.",
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
    a: "The web reader uses high-contrast text, generous spacing, and a dyslexia-friendly font option. Image alt text describes every illustration. Reading level adapts from board-book to early-reader so the page feels right for ages 2–10.",
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
              <Sparkles className="mr-1 h-3.5 w-3.5" /> Personalized for ages 2–10
            </Badge>
            <h1 className="mt-4 font-display text-[2rem] font-semibold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
              A bedtime story starring<span className="text-ember"> your child</span>.
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
              Turn their favorite things into a personalized illustrated storybook you can read together tonight — with your child as the hero, in an art style you choose.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link to="/create" className="w-full sm:w-auto">
                <Button size="lg" variant="ember" className="w-full sm:w-auto">
                  Start free character preview
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
              <Link
                to="/pricing"
                className="text-center text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
              >
                See what's included · $29.99
              </Link>
            </div>
            <p className="mt-3 flex items-center gap-2 text-xs font-medium text-sage">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              No payment until you approve the character preview.
            </p>
            <ul className="mt-6 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sage" /> Private child photos</li>
              <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sage" /> Not used to train models</li>
              <li className="flex items-start gap-2"><Wand2 className="mt-0.5 h-4 w-4 shrink-0 text-sage" /> Parent-approved character before payment</li>
              <li className="flex items-start gap-2"><RefreshCcw className="mt-0.5 h-4 w-4 shrink-0 text-sage" /> Free regeneration if it looks off</li>
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
            { icon: Heart, title: "Share what they love", body: "Their name, age (2–10), and the things that make them light up." },
            { icon: Wand2, title: "Approve the character", body: "Review the illustrated version. Regenerate free until it feels right." },
            { icon: BookOpen, title: "Read together", body: "Cover, dedication, and at least 10 illustrated pages — ready in 10–20 minutes." },
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
              Sample style previews
            </h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Four sample books — one per supported art style — to show what a finished StoryNest ebook looks like. These are concept previews, not real customer books.
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
              className="group relative overflow-hidden rounded-md border border-border bg-background text-left shadow-[0_10px_30px_-15px_oklch(0.22_0.03_260/0.45)] transition-all hover:-translate-y-0.5 hover:border-ember/50 hover:shadow-[0_18px_40px_-15px_oklch(0.22_0.03_260/0.55)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ember"
              aria-label={`Preview sample book in ${s.styleName} style`}
            >
              {/* book spine */}
              <span aria-hidden className="absolute inset-y-0 left-0 w-[6px] bg-gradient-to-b from-foreground/15 via-foreground/5 to-foreground/15" />
              <div className="relative aspect-[4/5] overflow-hidden bg-paper">
                {(() => {
                  const dbCover = assets[SAMPLE_KEY_BY_STYLE[s.key]]?.cover;
                  const cover = dbCover ?? SAMPLE_COVER_FALLBACK[s.key];
                  return cover ? (
                    <img
                      src={cover}
                      alt={`${s.title} sample cover in ${s.styleName} style`}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      loading="lazy"
                      width={1024}
                      height={1280}
                    />
                  ) : (
                    <StyleArtwork styleKey={s.key} variant="cover" />
                  );
                })()}
                {/* gentle vignette to make HTML title block legible */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-background/95 via-background/30 to-transparent" />
                <div className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                  Style shown · {s.styleName}
                </div>
                <div className="absolute right-3 top-3 rounded-full bg-foreground/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-background opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                  Preview →
                </div>
                {/* HTML title block layered on the cover, so the image stays text-free */}
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-background/80 drop-shadow">
                    A StoryNest book
                  </div>
                  <div className="mt-1 font-display text-base font-semibold leading-tight text-background drop-shadow sm:text-lg">
                    {s.title}
                  </div>
                </div>
              </div>
              <div className="border-t border-border p-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Sample cover concept · {s.age}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Tap to preview cover, dedication & sample pages
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
              <li>✓ Custom cover, dedication, and at least 10 illustrated story pages</li>
              <li>✓ Personalized for ages 2–10 — reading level adapts to your child</li>
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
              <Promise title="Real children's-book quality" body="Warm illustrations, thoughtful pacing, and reading level that adapts for ages 2–10." icon={BookOpen} />
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
