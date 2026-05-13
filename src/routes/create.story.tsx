import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { WizardLayout } from "@/components/wizard-layout";
import { getDraftId } from "@/lib/draft";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/create/story")({
  component: () => <AuthGate><Inner /></AuthGate>,
  head: () => ({ meta: [{ title: "Story — Create — StoryNest" }] }),
});

const themes = [
  "Bedtime adventure", "First day of school", "Big sibling", "Brave explorer", "Animal friends", "Outer space",
];

function Inner() {
  const navigate = useNavigate();
  const id = getDraftId();
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState(themes[0]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase.from("books").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      if (!data) return;
      setTitle(data.title ?? "");
      setTheme(data.story_theme ?? themes[0]);
      setPrompt(data.story_prompt ?? "");
    });
  }, [id]);

  async function next(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setBusy(true);
    const { error } = await supabase.from("books").update({
      title, story_theme: theme, story_prompt: prompt,
    }).eq("id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/create/style" });
  }

  return (
    <WizardLayout>
      <h1 className="font-display text-3xl font-semibold">Shape the story</h1>
      <p className="mt-2 text-sm text-muted-foreground">A theme and a few sentences are enough — we'll handle the rest.</p>

      <form onSubmit={next} className="mt-8 space-y-5">
        <div>
          <Label htmlFor="title">Working title (optional)</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The Brave Little Explorer" />
        </div>
        <div>
          <Label>Theme</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {themes.map((t) => (
              <button type="button" key={t} onClick={() => setTheme(t)}
                className={[
                  "rounded-md border px-3 py-1.5 text-sm transition-colors",
                  theme === t ? "border-ember bg-ember/10 text-foreground" : "border-border bg-background text-muted-foreground hover:bg-muted",
                ].join(" ")}>{t}</button>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="prompt">Anything specific to include?</Label>
          <Textarea id="prompt" rows={5} value={prompt} onChange={(e) => setPrompt(e.target.value)}
            placeholder="They've been nervous about starting kindergarten. We'd love a story where they discover a kind classmate." />
        </div>
        <div className="flex items-center justify-between">
          <Link to="/create/photos"><Button variant="ghost"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
          <Button type="submit" variant="ember" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Continue <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </WizardLayout>
  );
}
