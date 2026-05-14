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
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { storySchema, READING_LEVELS, THEMES } from "@/lib/create-schema";

export const Route = createFileRoute("/create/story")({
  component: () => (
    <AuthGate>
      <Inner />
    </AuthGate>
  ),
  head: () => ({ meta: [{ title: "Story — Create — StoryNest" }] }),
});

function Inner() {
  const navigate = useNavigate();
  const id = getDraftId();
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState<string>(THEMES[0]);
  const [prompt, setPrompt] = useState("");
  const [detailsInclude, setDetailsInclude] = useState("");
  const [detailsAvoid, setDetailsAvoid] = useState("");
  const [dedication, setDedication] = useState("");
  const [readingLevel, setReadingLevel] =
    useState<string>("ages_4_6");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("books")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }: { data: any }) => {
        if (!data) return;
        setTitle(data.title ?? "");
        setTheme(data.story_theme ?? THEMES[0]);
        setPrompt(data.story_prompt ?? "");
        setDetailsInclude(data.details_include ?? "");
        setDetailsAvoid(data.details_avoid ?? "");
        setDedication(data.dedication ?? "");
        // Map any legacy reading_level value into the new bands so the select
        // always lands on a valid option.
        const raw = (data.reading_level as string | null) ?? "ages_4_6";
        const mapped =
          raw === "ages_2_3" || raw === "ages_7_10" || raw === "ages_4_6"
            ? raw
            : raw === "ages_3_5"
              ? "ages_2_3"
              : raw === "ages_6_8"
                ? "ages_7_10"
                : "ages_4_6";
        setReadingLevel(mapped);
        setConsent(!!data.guardian_consent_at);
      });
  }, [id]);

  async function next(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;

    const parsed = storySchema.safeParse({
      title,
      theme,
      prompt,
      details_include: detailsInclude,
      details_avoid: detailsAvoid,
      dedication,
      reading_level: readingLevel,
      guardian_consent: consent as true,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setBusy(true);
    const { error } = await supabase
      .from("books")
      .update({
        title,
        story_theme: theme,
        story_prompt: prompt,
        details_include: detailsInclude || null,
        details_avoid: detailsAvoid || null,
        dedication: dedication || null,
        reading_level: readingLevel,
        guardian_consent_at: new Date().toISOString(),
      })
      .eq("id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/create/style" });
  }

  return (
    <WizardLayout>
      <h1 className="font-display text-3xl font-semibold">Shape the story</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        A theme and a few sentences are enough — we'll handle the rest.
      </p>

      <form onSubmit={next} className="mt-8 space-y-6">
        <div>
          <Label htmlFor="title">Working title (optional)</Label>
          <Input
            id="title"
            maxLength={80}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="The Brave Little Explorer"
          />
        </div>

        <div>
          <Label>Story theme</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {THEMES.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setTheme(t)}
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
          <Label htmlFor="reading-level">Reading level</Label>
          <select
            id="reading-level"
            value={readingLevel}
            onChange={(e) => setReadingLevel(e.target.value)}
            className="mt-2 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {READING_LEVELS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            {READING_LEVELS.find((r) => r.value === readingLevel)?.hint}
          </p>
        </div>

        <div>
          <Label htmlFor="prompt">What should the story be about?</Label>
          <Textarea
            id="prompt"
            rows={4}
            maxLength={800}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="They've been nervous about kindergarten. We'd love a story where they discover a kind classmate."
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="include">Details to include</Label>
            <Textarea
              id="include"
              rows={3}
              maxLength={400}
              value={detailsInclude}
              onChange={(e) => setDetailsInclude(e.target.value)}
              placeholder="Grandma Rose, our cabin by the lake, the red rain boots."
            />
          </div>
          <div>
            <Label htmlFor="avoid">Details to avoid</Label>
            <Textarea
              id="avoid"
              rows={3}
              maxLength={400}
              value={detailsAvoid}
              onChange={(e) => setDetailsAvoid(e.target.value)}
              placeholder="No scary monsters, no thunderstorms."
            />
          </div>
        </div>

        <div>
          <Label htmlFor="dedication">Dedication message</Label>
          <Textarea
            id="dedication"
            rows={3}
            maxLength={280}
            value={dedication}
            onChange={(e) => setDedication(e.target.value)}
            placeholder="For Ada, our brave explorer. Love, Mom & Dad."
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Printed on the dedication page. You can edit this before final approval.
          </p>
        </div>

        <div className="rounded-md border border-border bg-paper/40 p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <Checkbox
              checked={consent}
              onCheckedChange={(v) => setConsent(v === true)}
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

        <div className="flex items-center justify-between">
          <Link to="/create/photos">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
          <Button type="submit" variant="ember" disabled={busy || !consent}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Continue{" "}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </WizardLayout>
  );
}
