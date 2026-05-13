import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, ShieldCheck, Wand2 } from "lucide-react";

export const Route = createFileRoute("/create/")({
  component: CreateLanding,
  head: () => ({ meta: [{ title: "Create your storybook — StoryNest" }] }),
});

function CreateLanding() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 text-center">
      <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">
        Let's make a book starring your child
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
        It takes about 5 minutes. You'll add a photo, share what they love, approve their
        illustrated character, and we'll generate the story.
      </p>
      <div className="mt-8 flex justify-center">
        <Link to="/create/profile">
          <Button size="lg" variant="ember">
            Start — Step 1 of 5
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      <div className="mx-auto mt-12 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
        <Pill icon={ShieldCheck} text="Photos stay private" />
        <Pill icon={Wand2} text="Free regeneration" />
        <Pill icon={BookOpen} text="Printable ebook" />
      </div>
    </div>
  );
}

function Pill({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
      <Icon className="h-4 w-4 text-sage" /> {text}
    </div>
  );
}
