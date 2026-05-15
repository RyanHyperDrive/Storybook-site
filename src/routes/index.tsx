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
  Star,
  Clock,
  Check,
  Lock,
} from "lucide-react";
import sampleComic from "@/assets/sample-comic-nova.jpg";
import sampleCartoon from "@/assets/sample-cartoon-leo.jpg";
import sampleWatercolor from "@/assets/sample-watercolor-pip.jpg";
import sampleManga from "@/assets/sample-manga-yuki.jpg";
import samplePixel from "@/assets/sample-pixel-quinn.jpg";
import sampleWatercolorPage1 from "@/assets/sample-watercolor-pip-page1.jpg";
import sampleWatercolorPage2 from "@/assets/sample-watercolor-pip-page2.jpg";
import howPhotos from "@/assets/howitworks-photos.jpg";
import howLoves from "@/assets/howitworks-loves.jpg";
import howCharacters from "@/assets/howitworks-characters.jpg";
import howReading from "@/assets/howitworks-reading.jpg";
import { ART_STYLES, type ArtStyleKey } from "@/lib/art-styles";
import { StyleArtwork } from "@/components/style-artwork";
import { SampleBookModal } from "@/components/sample-book-modal";
import { useSampleAssets, SAMPLE_KEY_BY_STYLE } from "@/hooks/use-sample-assets";

const SAMPLE_COVER_FALLBACK: Record<ArtStyleKey, string> = {
  comic_book: sampleComic,
  soft_cartoon: sampleCartoon,
  watercolor_adventure: sampleWatercolor,
  manga_inspired: sampleManga,
  pixel_art: samplePixel,
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
  parentTag: s.parentTag,
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
      {/* HERO — premium product preview composition */}
      <section data-testid="hero" className="relative overflow-hidden bg-warm-grad">
        {/* soft decorative blobs to break up the cream */}
        <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-ember/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 right-[-6rem] h-80 w-80 rounded-full bg-sage/15 blur-3xl" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 pb-14 sm:pt-14 md:grid-cols-[1.05fr_1fr] md:gap-12 md:pt-16 md:pb-20">
          {/* LEFT — copy + conversion card */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-sage/15 text-sage hover:bg-sage/15" variant="secondary">
                <Sparkles className="mr-1 h-3.5 w-3.5" /> Personalized for ages 2–10
              </Badge>
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/70 px-2.5 py-0.5 text-[11px] font-medium text-foreground/80 backdrop-blur">
                <Clock className="h-3 w-3 text-ember" /> Ready in 10–20 min
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/70 px-2.5 py-0.5 text-[11px] font-medium text-foreground/80 backdrop-blur">
                <BookOpen className="h-3 w-3 text-ember" /> 10+ illustrated pages
              </span>
            </div>

            <h1 className="mt-4 font-display text-[2rem] font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-[3.4rem]">
              A bedtime story{" "}
              <br className="hidden sm:block" />
              starring<span className="text-ember"> your child</span>.
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground md:text-[1.05rem]">
              Upload one photo. We design an illustrated character of your child, you approve it, then we build a custom 10+ page storybook in the art style you choose — read it together tonight.
            </p>

            {/* Conversion card: price + CTA + approval line + trust bullets, grouped */}
            <div className="mt-6 rounded-xl border border-border bg-background/85 p-4 shadow-[0_18px_40px_-24px_oklch(0.22_0.03_260/0.45)] backdrop-blur sm:p-5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <div className="font-display text-3xl font-semibold leading-none">$29.99</div>
                <div className="text-sm text-muted-foreground">one-time · web reader + printable PDF</div>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Link to="/create" className="w-full sm:w-auto">
                  <Button size="lg" variant="ember" className="w-full sm:w-auto">
                    Start free character preview
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
                <Link
                  to="/pricing"
                  className="text-center text-sm font-medium text-muted-foreground underline-offset-4 hover:underline sm:text-left"
                >
                  See what's included
                </Link>
              </div>
              <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-sage">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                No payment until you approve the character preview.
              </p>
              <ul className="mt-4 grid gap-2 border-t border-border pt-4 text-sm text-foreground/85 sm:grid-cols-2">
                <li className="flex items-start gap-2"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-sage" /> Private child photos</li>
                <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sage" /> Not used to train models</li>
                <li className="flex items-start gap-2"><Wand2 className="mt-0.5 h-4 w-4 shrink-0 text-sage" /> Parent-approved character</li>
                <li className="flex items-start gap-2"><RefreshCcw className="mt-0.5 h-4 w-4 shrink-0 text-sage" /> Free regeneration</li>
              </ul>
            </div>

            {/* Sample style strip — proof + visual variety, doubles as a CTA to /#examples */}
            <a href="#examples" className="group mt-5 flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground">
              <div className="flex -space-x-2">
                {[sampleWatercolor, sampleCartoon, sampleComic, sampleManga, samplePixel].map((src, i) => (
                  <span
                    key={i}
                    className="grid h-9 w-9 place-items-center overflow-hidden rounded-md border-2 border-background bg-paper shadow-sm"
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </span>
                ))}
              </div>
              <span>
                <span className="font-medium text-foreground">5 art styles</span> —
                tap a sample to flip through it
                <span className="ml-1 inline-block transition-transform group-hover:translate-x-0.5">→</span>
              </span>
            </a>
          </div>

          {/* RIGHT — layered product preview */}
          <div className="relative mx-auto w-full max-w-md md:max-w-none">
            <div className="relative aspect-[4/5] w-full">
              {/* Open spread (back-most), tilted slightly left */}
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

              {/* Cover (front, hero), slight right tilt with page-edge depth */}
              <div className="absolute right-0 top-0 w-[62%] rotate-3">
                <span aria-hidden className="absolute inset-y-2 right-[-3px] w-[3px] rounded-r-sm bg-foreground/15" />
                <span aria-hidden className="absolute inset-y-4 right-[-6px] w-[2px] rounded-r-sm bg-foreground/10" />
                <div className="relative overflow-hidden rounded-md border border-border bg-background shadow-[0_30px_60px_-22px_oklch(0.22_0.03_260/0.55)]">
                  <span aria-hidden className="absolute inset-y-0 left-0 z-10 w-[6px] bg-gradient-to-b from-foreground/30 via-foreground/10 to-foreground/30" />
                  <img
                    src={sampleWatercolor}
                    alt="Sample StoryNest book cover starring the child as the hero"
                    width={900}
                    height={1200}
                    className="block aspect-[3/4] w-full object-cover"
                  />
                  <div className="absolute left-2 top-2 rounded-full bg-foreground/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-background backdrop-blur">
                    Watercolor
                  </div>
                </div>
              </div>

              {/* Character chip — bottom-left */}
              <div className="absolute -bottom-2 left-2 w-[58%] rounded-lg border border-border bg-background p-2.5 shadow-[0_18px_40px_-18px_oklch(0.22_0.03_260/0.45)] sm:left-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border">
                    <img src={sampleWatercolorPage2} alt="Illustrated character preview of the child" className="h-full w-full object-cover" loading="lazy" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Character preview</div>
                    <div className="truncate text-sm font-semibold text-foreground">Looks like your child</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1.5 rounded-md bg-sage/10 px-2 py-1 text-[11px] font-semibold text-sage">
                  <Check className="h-3.5 w-3.5" /> Approved by parent before payment
                </div>
              </div>

              {/* Floating trust badge — top right */}
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

      {/* HOW IT WORKS — connected visual journey, not generic cards */}
      <section data-testid="how-it-works" className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
        <div className="flex flex-col items-start gap-3 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ember">How it works</div>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Four small steps. One book they'll never forget.
            </h2>
            <p className="mt-3 text-sm text-muted-foreground md:text-base">
              See exactly how a real photo becomes a personalized illustrated character — and then a finished book you read together.
            </p>
          </div>
          <Link to="/create" className="text-sm font-medium text-ember underline-offset-4 hover:underline">
            Start free preview →
          </Link>
        </div>

        {/* Connected timeline */}
        <ol className="relative mt-10 grid gap-6 md:grid-cols-4 md:gap-4">
          {/* desktop connector line */}
          <span
            aria-hidden
            className="absolute left-0 right-0 top-[42px] hidden h-px bg-gradient-to-r from-transparent via-ember/30 to-transparent md:block"
          />
          {[
            {
              n: 1,
              icon: Camera,
              title: "Add a photo",
              body: "One clear, well-lit photo so we can sketch the character.",
              note: "Private to your account",
              img: howPhotos,
              alt: "Two example uploaded photos: a young boy in a yellow shirt and a young girl in a pink dress",
            },
            {
              n: 2,
              icon: Heart,
              title: "Share what they love",
              body: "Their name, age (2–10), and the things that light them up.",
              note: "Rockets, dinosaurs, princesses — you choose",
              img: howLoves,
              alt: "Playful storybook illustrations of a rocket, dinosaur, crown, pony, and ringed planet",
            },
            {
              n: 3,
              icon: Wand2,
              title: "Approve the character",
              body: "Review the illustrated version of your child. Regenerate free until it feels right.",
              note: "No payment until you say yes",
              img: howCharacters,
              alt: "Illustrated storybook versions of the same boy and girl, matching hair, skin tone, and outfits",
            },
            {
              n: 4,
              icon: BookOpen,
              title: "Read together",
              body: "Cover, dedication, and 10+ illustrated pages — ready in 10–20 minutes.",
              note: "Web reader + downloadable PDF",
              img: howReading,
              alt: "A father reading a personalized illustrated ebook to his young daughter on a cozy couch",
            },
          ].map((step) => (
            <li key={step.n} className="relative">
              {/* Numbered node sits ON the connector line */}
              <div className="relative z-10 flex items-center gap-3 md:flex-col md:items-start">
                <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full border-2 border-ember bg-background font-display text-base font-semibold text-ember shadow-[0_6px_18px_-8px_oklch(0.65_0.18_30/0.5)]">
                  {step.n}
                </span>
                <div className="md:hidden">
                  <div className="font-display text-lg font-semibold leading-tight">{step.title}</div>
                </div>
              </div>

              <article className="mt-3 overflow-hidden rounded-lg border border-border bg-background shadow-[0_10px_30px_-18px_oklch(0.22_0.03_260/0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-18px_oklch(0.22_0.03_260/0.55)]">
                <div className="relative aspect-[5/4] overflow-hidden bg-paper">
                  <img
                    src={step.img}
                    alt={step.alt}
                    loading="lazy"
                    width={1024}
                    height={820}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur">
                    <step.icon className="h-3.5 w-3.5 text-ember" />
                  </div>
                </div>
                <div className="flex flex-col gap-2 p-4">
                  <div className="hidden font-display text-base font-semibold leading-tight md:block">
                    {step.title}
                  </div>
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                  <p className="mt-1 flex items-start gap-1.5 text-xs font-semibold text-sage">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {step.note}
                  </p>
                </div>
              </article>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-col items-start gap-3 rounded-lg border border-border bg-paper/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground/85">
            <span className="font-semibold">No surprises:</span> you only pay $29.99 after you approve the illustrated character.
          </p>
          <Link to="/create" className="w-full sm:w-auto">
            <Button variant="ember" className="w-full sm:w-auto">
              Start free character preview <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Example children shown are fictional, generated previews — not real customer photos. Your child's photo is private to your account and never used to train models.
        </p>
      </section>

      {/* SAMPLES — premium storefront feel: book covers with spine + page edges */}
      <section id="examples" data-testid="samples" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Five art styles. One starring child.
            </h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Tap any cover to flip through a sample. Pick the style your child will love — you approve their illustrated character before we build the full book.
            </p>
          </div>
          <Link to="/create" className="text-sm font-medium text-ember underline-offset-4 hover:underline">
            Start free preview →
          </Link>
        </div>

        {/* What's in every book — set expectations next to the samples */}
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-border bg-paper/50 px-4 py-3 text-xs text-foreground/80 sm:text-sm">
          <span className="inline-flex items-center gap-1.5"><BookOpen className="h-4 w-4 text-ember" /> Custom cover + dedication + 10+ illustrated pages</span>
          <span className="hidden h-4 w-px bg-border sm:inline-block" />
          <span className="inline-flex items-center gap-1.5"><Heart className="h-4 w-4 text-ember" /> Ages 2–10, reading level adapts</span>
          <span className="hidden h-4 w-px bg-border sm:inline-block" />
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-sage" /> You approve the character before checkout</span>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {samples.map((s) => (
            <button
              type="button"
              key={s.key}
              data-testid={`sample-card-${s.key}`}
              onClick={() => setOpenKey(s.key)}
              className="group relative flex flex-col text-left focus:outline-none"
              aria-label={`Preview sample book in ${s.styleName} style`}
            >
              {/* Book wrapper — page-edge layers create depth, spine sits flush left */}
              <div className="relative">
                {/* page edges peeking from right — gives "real book" depth */}
                <span aria-hidden className="absolute inset-y-1.5 right-[-3px] w-[3px] rounded-r-sm bg-foreground/10" />
                <span aria-hidden className="absolute inset-y-3 right-[-6px] w-[2px] rounded-r-sm bg-foreground/5" />

                <div className="relative overflow-hidden rounded-md border border-border bg-background shadow-[0_14px_30px_-18px_oklch(0.22_0.03_260/0.55)] transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_22px_45px_-18px_oklch(0.22_0.03_260/0.6)] group-focus-visible:ring-2 group-focus-visible:ring-ember">
                  {/* spine */}
                  <span aria-hidden className="absolute inset-y-0 left-0 z-10 w-[6px] bg-gradient-to-b from-foreground/25 via-foreground/10 to-foreground/25" />
                  {/* spine highlight */}
                  <span aria-hidden className="absolute inset-y-0 left-[6px] z-10 w-px bg-background/60" />

                  <div className="relative aspect-[3/4] overflow-hidden bg-paper">
                    {(() => {
                      const dbCover = assets[SAMPLE_KEY_BY_STYLE[s.key]]?.cover;
                      const cover = dbCover ?? SAMPLE_COVER_FALLBACK[s.key];
                      return cover ? (
                        <img
                          src={cover}
                          alt={`${s.title} sample cover in ${s.styleName} style`}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                          loading="lazy"
                          width={1024}
                          height={1280}
                        />
                      ) : (
                        <StyleArtwork styleKey={s.key} variant="cover" />
                      );
                    })()}

                    {/* style chip top-left */}
                    <div className="absolute left-2 top-2 rounded-full bg-foreground/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-background backdrop-blur">
                      {s.styleName}
                    </div>

                    {/* persistent Preview affordance — visible without hover */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-center bg-gradient-to-t from-foreground/65 via-foreground/15 to-transparent p-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-background/95 px-3 py-1.5 text-[11px] font-semibold text-foreground shadow-md transition-transform group-hover:scale-105">
                        <BookOpen className="h-3.5 w-3.5 text-ember" />
                        Preview sample
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Caption block — outside the cover so it stays clean and readable on mobile */}
              <div className="mt-3 px-0.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  A StoryNest book
                </div>
                <div className="mt-0.5 line-clamp-2 font-display text-[15px] font-semibold leading-snug text-foreground">
                  {s.title}
                </div>
                <div className="mt-1.5 inline-flex items-center rounded-full bg-sage/15 px-2 py-0.5 text-[10px] font-medium text-sage">
                  {s.parentTag}
                </div>
              </div>
            </button>
          ))}
        </div>

        <p className="mt-6 max-w-3xl text-xs text-muted-foreground">
          These sample covers are fictional generated previews — not real customer children. Your own book stars your child as an illustrated character that you approve before we generate any story pages.
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
              <Button variant="ember" size="lg" className="w-full sm:w-auto">Start free character preview</Button>
            </Link>
            <p className="mt-3 flex items-center gap-2 text-xs font-medium text-sage">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              No payment until you approve the character preview.
            </p>
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
