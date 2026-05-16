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
  Clock,
  Lock,
  Moon,
} from "lucide-react";
import sampleComic from "@/assets/sample-comic-nova.jpg";
import sampleCartoon from "@/assets/sample-cartoon-leo.jpg";
import sampleWatercolor from "@/assets/sample-watercolor-pip.jpg";
import sampleManga from "@/assets/sample-manga-yuki.jpg";
import howPhotos from "@/assets/howitworks-photos.jpg";
import howLoves from "@/assets/howitworks-loves.jpg";
import howCharacters from "@/assets/howitworks-characters.jpg";
import howReading from "@/assets/howitworks-reading.jpg";
import {
  VISIBLE_GALLERY_STYLES,
  type ArtStyleKey,
} from "@/lib/art-styles";
import { StyleArtwork } from "@/components/style-artwork";
import { SampleBookModal } from "@/components/sample-book-modal";
import { useSampleAssets, SAMPLE_KEY_BY_STYLE } from "@/hooks/use-sample-assets";

const SAMPLE_COVER_FALLBACK: Record<ArtStyleKey, string> = {
  comic_book: sampleComic,
  soft_cartoon: sampleCartoon,
  watercolor_adventure: sampleWatercolor,
  manga_inspired: sampleManga,
};

export const Route = createFileRoute("/")({
  component: Home,
});

// Sample books for the home gallery — hidden/unfinished samples filtered out
// in art-styles.ts (VISIBLE_GALLERY_STYLES).
const samples = VISIBLE_GALLERY_STYLES.map((s) => ({
  key: s.key,
  title: s.sampleTitle,
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
    a: "The web reader uses high-contrast text, generous spacing, and a dyslexia-friendly font option. Image alt text describes every illustration. Personalized for ages 4–7 so the reading level lands right for early readers.",
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
      {/* HERO — calm, single product proof, conversion-focused */}
      <section data-testid="hero" className="relative overflow-hidden bg-warm-grad">
        <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-ember/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 right-[-6rem] h-80 w-80 rounded-full bg-sage/15 blur-3xl" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 pb-14 sm:pt-14 md:grid-cols-[1.05fr_1fr] md:gap-12 md:pt-16 md:pb-20">
          {/* LEFT — copy + conversion card */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-sage/15 text-sage hover:bg-sage/15" variant="secondary">
                <Sparkles className="mr-1 h-3.5 w-3.5" /> Personalized for ages 4–7
              </Badge>
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/70 px-2.5 py-0.5 text-[11px] font-medium text-foreground/80 backdrop-blur">
                <Clock className="h-3 w-3 text-ember" /> Ready in 10–20 min
              </span>
            </div>

            <h1 className="mt-4 font-display text-[2rem] font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-[3.4rem]">
              A bedtime story starring{" "}
              <br className="hidden sm:block" />
              <span className="text-ember">your child</span>.
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground md:text-[1.05rem]">
              Upload one photo. We create an illustrated version of your child for you to approve, then write and illustrate a custom storybook in the style you choose.
            </p>

            {/* Conversion card: price + CTA + approval line + trust bullets, grouped */}
            <div className="mt-6 rounded-xl border border-border bg-background/85 p-4 shadow-[0_18px_40px_-24px_oklch(0.22_0.03_260/0.45)] backdrop-blur sm:p-5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <div className="font-display text-3xl font-semibold leading-none">$29.99</div>
                <div className="text-sm text-muted-foreground">one-time · web reader + printable PDF</div>
              </div>
              <div data-testid="page-count-line" className="mt-1 text-xs font-medium text-foreground/80">
                Custom cover + dedication + 10 story pages
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
              <p data-testid="hero-urgency" className="mt-3 flex items-center gap-2 text-xs font-semibold text-ember">
                <Moon className="h-4 w-4 shrink-0" />
                Start tonight. Read it together tomorrow.
              </p>
              <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-sage">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                No payment until you approve their illustrated character.
              </p>
              <ul className="mt-4 grid gap-2 border-t border-border pt-4 text-sm text-foreground/85 sm:grid-cols-2">
                <li className="flex items-start gap-2"><Lock className="mt-0.5 h-4 w-4 shrink-0 text-sage" /> Private child photos</li>
                <li className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sage" /> Not used to train models</li>
                <li className="flex items-start gap-2"><Wand2 className="mt-0.5 h-4 w-4 shrink-0 text-sage" /> Parent-approved character</li>
                <li className="flex items-start gap-2"><RefreshCcw className="mt-0.5 h-4 w-4 shrink-0 text-sage" /> Free regeneration</li>
              </ul>
            </div>
          </div>

          {/* RIGHT — finished book cover, typeset like a real ebook */}
          <div className="relative mx-auto w-full max-w-sm md:max-w-md">
            <div className="relative">
              {/* page edges peeking from right for "real book" depth */}
              <span aria-hidden className="absolute inset-y-2 right-[-3px] w-[3px] rounded-r-sm bg-foreground/15" />
              <span aria-hidden className="absolute inset-y-4 right-[-6px] w-[2px] rounded-r-sm bg-foreground/10" />
              <div
                data-testid="hero-cover"
                className="relative overflow-hidden rounded-md border border-border bg-background shadow-[0_30px_60px_-22px_oklch(0.22_0.03_260/0.55)]"
              >
                {/* spine */}
                <span aria-hidden className="absolute inset-y-0 left-0 z-20 w-[6px] bg-gradient-to-b from-foreground/30 via-foreground/10 to-foreground/30" />
                <span aria-hidden className="absolute inset-y-0 left-[6px] z-20 w-px bg-background/60" />

                <div className="relative aspect-[3/4] w-full">
                  <img
                    src={sampleWatercolor}
                    alt="Finished StoryNest storybook cover: The Tea Party with Pip, watercolor illustration"
                    width={900}
                    height={1200}
                    loading="eager"
                    className="absolute inset-0 h-full w-full object-cover"
                  />

                  {/* top wordmark band */}
                  <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-foreground/55 via-foreground/15 to-transparent px-5 pb-8 pt-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-background/95">
                      A StoryNest Book
                    </div>
                  </div>

                  {/* bottom title block */}
                  <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-foreground/85 via-foreground/55 to-transparent px-5 pb-5 pt-14">
                    <div className="font-display text-[1.55rem] font-semibold leading-[1.05] tracking-tight text-background drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)] sm:text-3xl">
                      The Tea Party<br />with Pip
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-background/85">
                      <span className="h-px w-6 bg-background/70" />
                      Featuring your little one
                    </div>
                  </div>
                </div>
              </div>

              {/* subtle caption outside the jacket */}
              <div className="mt-3 flex items-center justify-between px-1 text-[11px] text-muted-foreground">
                <span>Sample book · Watercolor · Cover + 10 pages</span>
                <span className="inline-flex items-center gap-1 text-foreground/70">
                  <BookOpen className="h-3 w-3 text-ember" />
                  Cover + 10 pages
                </span>
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

        {/* Connected timeline. Cards render full content immediately — stable
            dimensions, no skeleton flicker between empty numbered boxes and
            populated cards. Min-heights match mobile + desktop so layout
            never pops. */}
        <ol data-testid="steps" className="relative mt-10 grid gap-6 md:grid-cols-4 md:gap-4">
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
              body: "Their name, age (4–7), and the things that light them up.",
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
              body: "Custom cover + dedication + 10 story pages — ready in 10–20 minutes.",
              note: "Web reader + downloadable PDF",
              img: howReading,
              alt: "A father reading a personalized illustrated ebook to his young daughter on a cozy couch",
            },
          ].map((step) => (
            <li
              key={step.n}
              data-testid={`step-${step.n}`}
              className="relative flex min-h-[22rem] flex-col md:min-h-[28rem]"
            >
              {/* Numbered node sits ON the connector line */}
              <div className="relative z-10 flex items-center gap-3 md:flex-col md:items-start">
                <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full border-2 border-ember bg-background font-display text-base font-semibold text-ember shadow-[0_6px_18px_-8px_oklch(0.65_0.18_30/0.5)]">
                  {step.n}
                </span>
                <div className="md:hidden">
                  <div className="font-display text-lg font-semibold leading-tight">{step.title}</div>
                </div>
              </div>

              <article className="mt-3 flex flex-1 flex-col overflow-hidden rounded-lg border border-border bg-background shadow-[0_10px_30px_-18px_oklch(0.22_0.03_260/0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-18px_oklch(0.22_0.03_260/0.55)]">
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
                <div className="flex flex-1 flex-col gap-2 p-4">
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

      {/* SAMPLES — compact strip on home; full gallery lives on /examples */}
      <section id="examples" data-testid="samples" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              A peek at the art styles
            </h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Tap any cover to flip through a sample book. Want more? See the full gallery.
            </p>
          </div>
          <Link to="/examples" className="text-sm font-medium text-ember underline-offset-4 hover:underline">
            See all examples →
          </Link>
        </div>

        {/* What's in every book — set expectations next to the samples */}
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-border bg-paper/50 px-4 py-3 text-xs text-foreground/80 sm:text-sm">
          <span className="inline-flex items-center gap-1.5"><BookOpen className="h-4 w-4 text-ember" /> Custom cover + dedication + 10 story pages</span>
          <span className="hidden h-4 w-px bg-border sm:inline-block" />
          <span className="inline-flex items-center gap-1.5"><Heart className="h-4 w-4 text-ember" /> Personalized for ages 4–7</span>
          <span className="hidden h-4 w-px bg-border sm:inline-block" />
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-sage" /> You approve the character before checkout</span>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {samples.map((s) => (
            <button
              type="button"
              key={s.key}
              data-testid={`sample-card-${s.key}`}
              onClick={() => setOpenKey(s.key)}
              className="group relative flex flex-col text-left focus:outline-none"
              aria-label={`Preview sample book in ${s.styleName} style`}
            >
              <div className="relative">
                <span aria-hidden className="absolute inset-y-1.5 right-[-3px] w-[3px] rounded-r-sm bg-foreground/10" />
                <span aria-hidden className="absolute inset-y-3 right-[-6px] w-[2px] rounded-r-sm bg-foreground/5" />

                <div className="relative overflow-hidden rounded-md border border-border bg-background shadow-[0_14px_30px_-18px_oklch(0.22_0.03_260/0.55)] transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_22px_45px_-18px_oklch(0.22_0.03_260/0.6)] group-focus-visible:ring-2 group-focus-visible:ring-ember">
                  <span aria-hidden className="absolute inset-y-0 left-0 z-10 w-[6px] bg-gradient-to-b from-foreground/25 via-foreground/10 to-foreground/25" />
                  <span aria-hidden className="absolute inset-y-0 left-[6px] z-10 w-px bg-background/60" />

                  <div className="relative aspect-[3/4] overflow-hidden bg-paper">
                    {(() => {
                      const dbCover = assets[SAMPLE_KEY_BY_STYLE[s.key]]?.cover;
                      const cover = dbCover ?? SAMPLE_COVER_FALLBACK[s.key];
                      return cover ? (
                        <img
                          src={cover}
                          alt={`${s.title} — finished StoryNest sample cover in ${s.styleName} style`}
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                          loading="lazy"
                          width={1024}
                          height={1280}
                        />
                      ) : (
                        <StyleArtwork styleKey={s.key} variant="cover" />
                      );
                    })()}

                    {/* top wordmark band */}
                    <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-foreground/55 via-foreground/15 to-transparent px-3 pb-6 pt-2">
                      <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-background/95">
                        A StoryNest Book
                      </div>
                    </div>

                    {/* bottom title block — typeset like a real cover */}
                    <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-foreground/85 via-foreground/55 to-transparent px-3 pb-10 pt-12">
                      <div className="font-display text-[1.05rem] font-semibold leading-[1.1] tracking-tight text-background drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)] sm:text-[1.15rem]">
                        {s.title}
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-background/85">
                        <span className="h-px w-4 bg-background/70" />
                        Featuring your child
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 px-0.5">
                <div className="font-display text-[13px] font-medium text-foreground/80">
                  {s.styleName} edition
                </div>
                <div className="inline-flex items-center rounded-full bg-sage/15 px-2 py-0.5 text-[10px] font-medium text-sage">
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
              <li>✓ Custom cover + dedication + 10 story pages</li>
              <li>✓ Personalized for ages 4–7</li>
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
              <Promise title="Real children's-book quality" body="Warm illustrations and thoughtful pacing, designed for ages 4–7." icon={BookOpen} />
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
