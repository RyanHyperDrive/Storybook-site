import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AuthGate } from "@/components/auth-gate";
import { WizardLayout } from "@/components/wizard-layout";
import { getDraftId, STORY_LOCAL_KEY } from "@/lib/draft";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, ArrowRight, ChevronDown, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { storySchema, readingLevelForAge, THEMES } from "@/lib/create-schema";

export const Route = createFileRoute("/create/story")({
  component: () => (
    <AuthGate title="Sign in to continue">
      <StoryStep />
    </AuthGate>
  ),
  head: () => ({ meta: [{ title: "Story — Create — StoryNest" }] }),
});

function StoryStep() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const id = getDraftId();
  const [theme, setTheme] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [detailsInclude, setDetailsInclude] = useState("");
  const [dedication, setDedication] = useState("");
  const [lesson, setLesson] = useState("");
  const [rhyme, setRhyme] = useState(false);
  const [childAge, setChildAge] = useState<number | null>(null);
  const [consent, setConsent] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  // Redirect if missing prerequisites from earlier steps.
  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    if (!id) {
      setRedirecting(true);
      toast.info("Let's start with your child's photo.");
      navigate({ to: "/create/photos" });
      return;
    }
    (async () => {
      const { data: kids } = await supabase
        .from("child_profiles")
        .select("id")
        .eq("book_id", id)
        .limit(1);
      if (!kids || kids.length === 0) {
        setRedirecting(true);
        toast.info("Let's add your child's details first.");
        navigate({ to: "/create/profile" });
      }
    })();
  }, [authLoading, user, id, navigate]);

  // Hydrate from localStorage (for anonymous parents) so they don't lose typing.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(STORY_LOCAL_KEY);
    if (!raw) return;
    try {
      const s = JSON.parse(raw);
      if (s.theme) setTheme(s.theme);
      if (s.prompt) setPrompt(s.prompt);
      if (s.detailsInclude) setDetailsInclude(s.detailsInclude);
      if (s.dedication) setDedication(s.dedication);
      if (typeof s.lesson === "string") setLesson(s.lesson);
      if (typeof s.rhyme === "boolean") setRhyme(s.rhyme);
      if (s.consent) setConsent(true);
      if (s.theme || s.detailsInclude || s.dedication) setMoreOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  // For signed-in parents with an existing draft, hydrate from the database.
  useEffect(() => {
    if (!id || !user) return;
    supabase
      .from("books")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }: { data: any }) => {
        if (!data) return;
        if (data.story_theme) setTheme(data.story_theme);
        if (data.story_prompt) setPrompt(data.story_prompt);
        if (data.details_include) setDetailsInclude(data.details_include);
        if (data.dedication) setDedication(data.dedication);
        if (typeof data.story_lesson === "string") setLesson(data.story_lesson);
        if (typeof data.rhyme === "boolean") setRhyme(data.rhyme);
        if (typeof data.child_age === "number") setChildAge(data.child_age);
        if (data.guardian_consent_at) setConsent(true);
        if (data.story_theme || data.details_include || data.dedication) setMoreOpen(true);
      });
  }, [id, user]);

  function persistLocal(next?: Partial<{
    theme: string;
    prompt: string;
    detailsInclude: string;
    dedication: string;
    lesson: string;
    rhyme: boolean;
    consent: boolean;
  }>) {
    if (typeof window === "undefined") return;
    const payload = {
      theme,
      prompt,
      detailsInclude,
      dedication,
      lesson,
      rhyme,
      consent,
      ...next,
    };
    localStorage.setItem(STORY_LOCAL_KEY, JSON.stringify(payload));
  }

  const [consentError, setConsentError] = useState(false);

  async function next(e: React.FormEvent) {
    e.preventDefault();

    if (!consent) {
      setConsentError(true);
      toast.error("Please confirm guardian consent to continue.");
      return;
    }

    const parsed = storySchema.safeParse({
      theme,
      prompt,
      details_include: detailsInclude,
      dedication,
      lesson,
      rhyme,
      guardian_consent: consent as true,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    persistLocal();

    const derivedReadingLevel = readingLevelForAge(childAge);

    if (!user || !id) {
      navigate({ to: "/create/avoid" });
      return;
    }

    setBusy(true);
    const { error } = await supabase
      .from("books")
      .update({
        story_theme: theme || null,
        story_prompt: prompt,
        details_include: detailsInclude || null,
        dedication: dedication || null,
        story_lesson: lesson || null,
        rhyme,
        reading_level: derivedReadingLevel,
        guardian_consent_at: new Date().toISOString(),
      })
      .eq("id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/create/avoid" });
  }

  if (redirecting) {
    return (
      <WizardLayout>
        <div className="grid min-h-[20vh] place-items-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </WizardLayout>
    );
  }

  return (
    <WizardLayout>
      <h1 className="font-display text-3xl font-semibold">Shape the story</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        A theme and a few sentences are enough — we'll handle the rest.
      </p>

      <form onSubmit={next} className="mt-8 space-y-6">
        <div>
          <Label htmlFor="prompt">What should the story be about?</Label>
          <Textarea
            id="prompt"
            rows={5}
            maxLength={800}
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); persistLocal({ prompt: e.target.value }); }}
            placeholder="e.g. Maya just got a baby brother and feels a bit left out. Her favorite person is Grandpa Joe."
          />
          <p className="mt-1 text-xs text-muted-foreground">
            A theme, a real situation, or a lesson to weave in — like "nervous about starting kindergarten," "had a rough day and needs a confidence boost," or "learning to share with the new baby." Leave it blank and we'll surprise them.
          </p>
        </div>

        <div>
          <Label htmlFor="lesson">Something to gently teach? (optional)</Label>
          <Textarea
            id="lesson"
            rows={2}
            maxLength={200}
            value={lesson}
            onChange={(e) => { setLesson(e.target.value); persistLocal({ lesson: e.target.value }); }}
            placeholder="e.g. sharing with the new baby; being brave at the doctor."
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Like sharing with the new baby, or being brave at the doctor. We'll weave it in softly, never preachy. Leave blank to skip.
          </p>
        </div>

        <div className="rounded-md border border-border bg-paper/40 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="rhyme" className="text-sm font-semibold">Make it rhyme</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                {rhyme
                  ? "We'll rhyme wherever it stays clear and never force a line."
                  : "A bouncy, rhyming read-aloud. Off = a gentle storybook voice."}
              </p>
            </div>
            <Switch
              id="rhyme"
              checked={rhyme}
              onCheckedChange={(v) => { setRhyme(v); persistLocal({ rhyme: v }); }}
              aria-label="Make it rhyme"
            />
          </div>
        </div>


        <div className="rounded-md border border-border bg-paper/40">
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold"
            aria-expanded={moreOpen}
          >
            <span>Add more details (optional)</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
          </button>
          {moreOpen && (
            <div className="space-y-5 border-t border-border px-4 py-4">
              <div>
                <Label>Story theme</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {THEMES.map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => { const newT = theme === t ? "" : t; setTheme(newT); persistLocal({ theme: newT }); }}
                      className={[
                        "rounded-md border px-3 py-1.5 text-sm transition-colors",
                        theme === t
                          ? "border-ember bg-ember/10 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-muted",
                      ].join(" ")}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="include">Details to include</Label>
                <Textarea
                  id="include"
                  rows={3}
                  maxLength={400}
                  value={detailsInclude}
                  onChange={(e) => { setDetailsInclude(e.target.value); persistLocal({ detailsInclude: e.target.value }); }}
                  placeholder="Grandma Rose, our cabin by the lake, the red rain boots."
                />
              </div>

              <div>
                <Label htmlFor="dedication">Dedication message</Label>
                <Textarea
                  id="dedication"
                  rows={3}
                  maxLength={280}
                  value={dedication}
                  onChange={(e) => { setDedication(e.target.value); persistLocal({ dedication: e.target.value }); }}
                  placeholder="For Ada, our brave explorer. Love, Mom & Dad."
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Printed on the dedication page. You can edit this before final approval.
                </p>
              </div>
            </div>
          )}
        </div>

        <div
          className={[
            "rounded-md border p-4 transition-colors",
            consentError && !consent
              ? "border-ember bg-ember/10 ring-2 ring-ember"
              : "border-border bg-paper/40",
          ].join(" ")}
        >
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox
              checked={consent}
              onCheckedChange={(v) => {
                const c = v === true;
                setConsent(c);
                if (c) setConsentError(false);
                persistLocal({ consent: c });
              }}
              className="mt-0.5"
              aria-label="Guardian consent"
            />
            <span className="text-sm">
              <span className="flex items-center gap-1.5 font-semibold">
                <ShieldCheck className="h-3.5 w-3.5 text-sage" /> Guardian consent
              </span>
              <span className="mt-1 block text-muted-foreground">
                I confirm I am this child's parent or guardian, or I have permission to create this
                book using these photos and details.
              </span>
            </span>
          </label>
        </div>

        <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/create/profile" className="w-full sm:w-auto">
            <Button type="button" variant="ghost" className="w-full sm:w-auto">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
          <div className="flex flex-col items-end gap-2">
            <Button type="submit" variant="ember" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Next: things to avoid{" "}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <p className="text-xs text-muted-foreground">
              No payment until you approve the illustrated character.
            </p>
          </div>
        </div>
      </form>
    </WizardLayout>
  );
}
