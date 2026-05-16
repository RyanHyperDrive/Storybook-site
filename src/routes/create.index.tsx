import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BookOpen,
  Camera,
  Check,
  Clock,
  Heart,
  Lock,
  Palette,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import howitworksPhotos from "@/assets/howitworks-photos.jpg";
import howitworksCharacters from "@/assets/howitworks-characters.jpg";
import sampleCover from "@/assets/sample-watercolor-pip.jpg";
import sampleSpread from "@/assets/sample-watercolor-pip-page1.jpg";

export const Route = createFileRoute("/create/")({
  component: CreateLanding,
  head: () => ({
    meta: [
      { title: "Create your storybook — StoryNest" },
      {
        name: "description",
        content:
          "Start a personalized illustrated storybook starring your child. Approve the character before you pay. $29.99 one-time.",
      },
    ],
  }),
});

function CreateLanding() {
  return (
    <div className="bg-warm-grad" data-testid="create-landing">
      {/* TOP: workspace-style hero */}
      <section className="mx-auto max-w-6xl px-4 pb-10 pt-8 sm:pt-12 lg:pb-14 lg:pt-16">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-start lg:gap-10">
          {/* LEFT — guided start */}
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-medium text-foreground/80 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-ember" />
              Start your child's book · about 5 minutes of setup
            </div>
            <h1 className="mt-4 font-display text-[2rem] font-semibold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl">
              Let's make a book starring{" "}
              <span className="text-ember">your child</span>.
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground">
              Tell us about them, upload one clear photo, and pick a story + art
              style. You'll approve their illustrated character before anything
              is generated or paid for.
            </p>

            {/* CTA + immediate trust */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link to="/create/profile" className="w-full sm:w-auto">
                <Button size="lg" variant="ember" className="w-full sm:w-auto">
                  Start free character preview
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
              <div className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">$29.99</span>{" "}
                one-time · pay only after you approve the character
              </div>
            </div>

            {/* Trust grid — visible without scroll on desktop */}
            <ul data-testid="trust-grid" className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
              <TrustItem icon={Lock}>Private child photos</TrustItem>
              <TrustItem icon={ShieldCheck}>Not used to train models</TrustItem>
              <TrustItem icon={Wand2}>
                Parent-approved character before payment
              </TrustItem>
              <TrustItem icon={RefreshCcw}>
                Free regeneration if it looks off
              </TrustItem>
            </ul>

            {/* "What happens after you start" compact strip */}
            <div className="mt-6 rounded-lg border border-border bg-background/80 p-4 backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                What happens after you start
              </div>
              <ol className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px] text-foreground/85">
                <Mini>About child</Mini>
                <Sep />
                <Mini>Photo upload</Mini>
                <Sep />
                <Mini>Story + style</Mini>
                <Sep />
                <Mini>Approve character</Mini>
                <Sep />
                <Mini>Pay (only now)</Mini>
                <Sep />
                <Mini>
                  <Clock className="mr-1 inline h-3 w-3" />
                  Ready in 10–20 min
                </Mini>
              </ol>
            </div>
          </div>

          {/* RIGHT — visual "photo → character → book" journey */}
          <div className="lg:col-span-6">
            <JourneyPreview />
          </div>
        </div>
      </section>

      {/* STEP CARDS */}
      <section className="border-t border-border/60 bg-background/60 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-12 lg:py-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
                Five small steps. One book they'll never forget.
              </h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Every step is reviewable. You can tweak details right up to the
                character approval — nothing is locked in until you say so.
              </p>
            </div>
            <Link to="/create/profile" className="hidden sm:block">
              <Button variant="outline" size="sm">
                Begin step 1
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StepCard
              n={1}
              icon={Heart}
              title="About your child"
              body="Name, age, pronouns, and the things they love."
              example="“Mira, 5, loves dinosaurs + tea parties.”"
            />
            <StepCard
              n={2}
              icon={Camera}
              title="Photo + sign in"
              body="One clear, well-lit photo. We ask you to sign in here so the photo stays linked to your private account."
              example="Photos are encrypted at rest and never used to train models."
              trust
            />
            <StepCard
              n={3}
              icon={BookOpen}
              title="Story"
              body="Pick a theme — adventure, bedtime, friendship, curiosity."
              example="“A bedtime story about courage.”"
            />
            <StepCard
              n={4}
              icon={Palette}
              title="Art style"
              body="Choose from four illustration styles, each with a finished sample."
              example="Watercolor · Soft cartoon · Comic · Manga"
            />
            <StepCard
              n={5}
              icon={ShieldCheck}
              title="Approve character"
              body="Review the illustrated version of your child. Free regeneration until it feels right — only then do you pay."
              example="$29.99 one-time, after approval."
              trust
            />
          </ol>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <p className="text-center text-xs text-muted-foreground sm:text-left">
              Designed for ages 4–7 · Custom cover + dedication + 10 story pages · Web reader + PDF
            </p>
            <Link to="/create/profile" className="w-full sm:w-auto">
              <Button variant="ember" size="lg" className="w-full sm:w-auto">
                Start free character preview
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function TrustItem({
  icon: Icon,
  children,
}: {
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2 text-foreground/85">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
      <span>{children}</span>
    </li>
  );
}

function Mini({ children }: { children: React.ReactNode }) {
  return (
    <li className="inline-flex items-center rounded-full bg-paper/70 px-2.5 py-1 text-xs font-medium">
      {children}
    </li>
  );
}

function Sep() {
  return (
    <span aria-hidden className="text-muted-foreground/50">
      →
    </span>
  );
}

function StepCard({
  n,
  icon: Icon,
  title,
  body,
  example,
  trust,
}: {
  n: number;
  icon: any;
  title: string;
  body: string;
  example: string;
  trust?: boolean;
}) {
  return (
    <li className="relative flex flex-col gap-3 rounded-lg border border-border bg-background p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-ember/15 text-ember">
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Step {n}
        </div>
      </div>
      <div>
        <div className="font-display text-base font-semibold leading-tight">
          {title}
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
      </div>
      <div
        className={`mt-auto rounded-md border border-dashed px-3 py-2 text-xs ${
          trust
            ? "border-sage/40 bg-sage/5 text-sage"
            : "border-border bg-paper/60 text-foreground/75"
        }`}
      >
        {trust ? (
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            {example}
          </span>
        ) : (
          example
        )}
      </div>
    </li>
  );
}

function JourneyPreview() {
  return (
    <div className="relative" data-testid="journey-preview">
      {/* soft decorative blur */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-ember/10 via-transparent to-sage/10 blur-2xl"
      />

      <div className="rounded-2xl border border-border bg-background/90 p-4 shadow-[0_30px_60px_-30px_oklch(0.22_0.03_260/0.35)] backdrop-blur sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            From a photo to their book
          </div>
          <span className="rounded-full bg-paper/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            Sample preview
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 items-stretch gap-3">
          <JourneyStep
            label="1. Photo"
            note="Private to you"
            image={howitworksPhotos}
            alt="Parent uploading a clear child photo"
          />
          <JourneyStep
            label="2. Character"
            note="You approve it"
            image={howitworksCharacters}
            alt="Illustrated character preview generated from the photo"
            highlight
          />
          <JourneyStep
            label="3. Book"
            note="Read + PDF"
            image={sampleCover}
            alt="Finished sample storybook cover"
            book
          />
        </div>

        {/* finished spread teaser */}
        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-5 items-stretch">
            <div className="col-span-3 aspect-[4/3] sm:aspect-auto">
              <img
                src={sampleSpread}
                alt="A finished illustrated story page from a sample StoryNest book"
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="col-span-2 flex flex-col justify-center gap-2 bg-paper/50 p-3 sm:p-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                A real sample page
              </div>
              <p className="font-display text-sm leading-snug text-foreground sm:text-base">
                “Pip set out four small cups under the wisteria tree…”
              </p>
              <ul className="mt-1 space-y-1 text-[11px] text-foreground/80">
                <li className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-sage" /> Custom cover + dedication
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-sage" /> 10 story pages · ages 4–7
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-sage" /> Web reader + PDF
                </li>
              </ul>
            </div>
          </div>
        </div>

        <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
          Sample children are fictional. Your child's photo stays private, and you approve the illustrated character before checkout.
        </p>
      </div>
    </div>
  );
}

function JourneyStep({
  label,
  note,
  image,
  alt,
  highlight,
  book,
}: {
  label: string;
  note: string;
  image: string;
  alt: string;
  highlight?: boolean;
  book?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <div
        className={`relative overflow-hidden rounded-md border bg-paper ${
          highlight ? "border-ember/50 ring-2 ring-ember/20" : "border-border"
        } ${book ? "aspect-[3/4]" : "aspect-square"}`}
      >
        <img
          src={image}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        {book && (
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-[5px] bg-gradient-to-b from-foreground/25 via-foreground/10 to-foreground/25"
          />
        )}
      </div>
      <div className="mt-2 text-[11px] font-semibold text-foreground">
        {label}
      </div>
      <div className="text-[10px] text-muted-foreground">{note}</div>
    </div>
  );
}
