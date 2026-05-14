import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, Camera, Heart, ShieldCheck, Wand2 } from "lucide-react";


export const Route = createFileRoute("/create/")({
  component: CreateLanding,
  head: () => ({ meta: [{ title: "Create your storybook — StoryNest" }] }),
});

function CreateLanding() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 text-center">
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
        Let's make a book starring your child
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
        Five quick steps, about 5 minutes of your time. You'll set up the character, approve how
        they look, and we'll generate a custom cover, a dedication, and at least 10 illustrated
        story pages — ready in about 10–20 minutes. We'll email you when it's done.
      </p>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Link to="/create/profile">
          <Button size="lg" variant="ember">
            Start free character preview
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <p className="flex items-center gap-2 text-xs font-medium text-sage">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          No payment until you approve the character preview.
        </p>
      </div>

      <ol className="mx-auto mt-12 grid max-w-2xl gap-3 text-left sm:grid-cols-2">
        <Step n={1} icon={Heart} title="About your child" body="Name, age, pronouns, what they love." />
        <Step n={2} icon={Camera} title="Photos" body="Upload one clear, well-lit photo. We ask you to sign in here." />
        <Step n={3} icon={BookOpen} title="Story" body="Pick a theme — adventure, bedtime, friendship." />
        <Step n={4} icon={Wand2} title="Style" body="Choose an illustration style." />
        <Step n={5} icon={ShieldCheck} title="Approve character" body="Review the illustrated character. Free regeneration if it looks off." />
      </ol>

      <p className="mt-10 text-xs text-muted-foreground">
        $29.99 one-time per book · Personalized for ages 2–10 · Web reader + downloadable PDF
      </p>
    </div>
  );
}

function Step({
  n,
  icon: Icon,
  title,
  body,
}: { n: number; icon: any; title: string; body: string }) {
  return (
    <li className="flex items-start gap-3 rounded-md border border-border bg-background p-4">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-ember/15 text-ember">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold">Step {n}. {title}</div>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
    </li>
  );
}
