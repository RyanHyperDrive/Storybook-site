import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Sparkles, Camera, BookOpen, ShieldCheck, Wand2, RefreshCcw, Heart } from "lucide-react";
import hero from "@/assets/hero-reading.jpg";
import s1 from "@/assets/sample-1.jpg";
import s2 from "@/assets/sample-2.jpg";
import s3 from "@/assets/sample-3.jpg";

export const Route = createFileRoute("/")({
  component: Home,
});

const samples = [
  { src: s1, title: "Mira and the Whispering Woods", age: "Ages 4–7" },
  { src: s2, title: "Leo Visits the Stars", age: "Ages 3–6" },
  { src: s3, title: "The Tea Party with Pip", age: "Ages 2–5" },
];

function Home() {
  return (
    <>
      {/* HERO */}
      <section className="bg-warm-grad">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <Badge className="bg-sage/15 text-sage hover:bg-sage/15" variant="secondary">
              <Sparkles className="mr-1 h-3.5 w-3.5" /> Made with care for ages 2–9
            </Badge>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
              A storybook starring{" "}
              <span className="text-ember">your child</span>.
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
              Create a personalized illustrated storybook starring your child. Upload a clear
              photo, share what they love, approve their illustrated character, and receive a
              custom ebook made for reading together.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link to="/create">
                <Button size="lg" variant="ember">
                  Create a storybook — $29.99
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/pricing" className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline">
                See what's included
              </Link>
            </div>
            <ul className="mt-8 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-sage" /> Photos stay private to you</li>
              <li className="flex items-center gap-2"><RefreshCcw className="h-4 w-4 text-sage" /> Free regeneration if it looks off</li>
              <li className="flex items-center gap-2"><Wand2 className="h-4 w-4 text-sage" /> Parent-approved illustrated character</li>
              <li className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-sage" /> Delivered as a printable ebook</li>
            </ul>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-lg border border-border shadow-[0_30px_60px_-30px_oklch(0.22_0.03_260/0.35)]">
              <img src={hero} alt="A parent and child reading a storybook together"
                width={1536} height={1152} className="h-full w-full object-cover" />
            </div>
            <div className="absolute -bottom-6 -left-6 hidden rounded-md border border-border bg-background p-4 shadow-lg sm:block">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-ember/15 text-ember"><Heart className="h-5 w-5" /></div>
                <div>
                  <div className="text-sm font-semibold">10,000+ bedtime stories</div>
                  <div className="text-xs text-muted-foreground">read with families this month</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-3xl font-semibold md:text-4xl">Four small steps. One book they'll never forget.</h2>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {[
            { icon: Camera, title: "Add a photo", body: "One clear, well-lit photo so we can sketch the character." },
            { icon: Heart, title: "Share what they love", body: "Their name, age, and the things that make them light up." },
            { icon: Wand2, title: "Approve the character", body: "Review the illustrated version. Regenerate if it doesn't feel right." },
            { icon: BookOpen, title: "Read together", body: "Receive a custom ebook within minutes — read on any device." },
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

      {/* SAMPLES */}
      <section id="examples" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-3xl font-semibold md:text-4xl">Recently created stories</h2>
          <Link to="/create" className="text-sm font-medium text-ember underline-offset-4 hover:underline">
            Create yours →
          </Link>
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {samples.map((s) => (
            <article key={s.title} className="rounded-lg border border-border bg-background overflow-hidden">
              <div className="aspect-[4/5] overflow-hidden bg-muted">
                <img src={s.src} alt={s.title} loading="lazy" width={1024} height={1280}
                  className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.03]" />
              </div>
              <div className="p-4">
                <div className="text-sm font-semibold">{s.title}</div>
                <div className="text-xs text-muted-foreground">{s.age} · 12 illustrated pages</div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* PRICING + PROMISE */}
      <section className="bg-paper/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-background p-8">
            <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">One book</div>
            <div className="mt-1 flex items-baseline gap-2">
              <div className="font-display text-5xl font-semibold">$29.99</div>
              <div className="text-sm text-muted-foreground">one-time</div>
            </div>
            <ul className="mt-6 space-y-2 text-sm text-foreground">
              <li>✓ 12 illustrated pages, custom story</li>
              <li>✓ Parent-approved illustrated character</li>
              <li>✓ Free regeneration if something looks off</li>
              <li>✓ Printable PDF + readable ebook</li>
              <li>✓ Stored in your private library</li>
            </ul>
            <Link to="/create" className="mt-8 inline-block">
              <Button variant="ember" size="lg">Start your book</Button>
            </Link>
          </div>
          <div>
            <h2 className="font-display text-3xl font-semibold md:text-4xl">Our promise to parents</h2>
            <div className="mt-6 grid gap-4">
              <Promise title="Privacy first" body="Your photos are private to your account. We never sell them and never use them to train models." icon={ShieldCheck} />
              <Promise title="Parent-approved character" body="You always review the illustrated character before the story is generated. Free regeneration if it doesn't feel right." icon={RefreshCcw} />
              <Promise title="Real children's-book quality" body="Warm illustrations, thoughtful pacing, and language tuned to your child's age." icon={BookOpen} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Promise({ title, body, icon: Icon }: { title: string; body: string; icon: any }) {
  return (
    <div className="flex gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-sage/15 text-sage">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
