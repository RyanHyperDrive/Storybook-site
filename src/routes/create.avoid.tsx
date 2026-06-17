import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AuthGate } from "@/components/auth-gate";
import { WizardLayout } from "@/components/wizard-layout";
import { getDraftId, STORY_LOCAL_KEY } from "@/lib/draft";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Loader2, Plus, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/create/avoid")({
  component: () => (
    <AuthGate title="Sign in to continue">
      <AvoidStep />
    </AuthGate>
  ),
  head: () => ({ meta: [{ title: "Things to avoid — Create — StoryNest" }] }),
});

const SUGGESTIONS = [
  "the dark",
  "thunderstorms",
  "dogs",
  "spiders",
  "snakes",
  "bees",
  "clowns",
  "loud noises",
];

// details_avoid is stored as plain text. We treat it as a newline- or
// comma-separated list so it can round-trip without a schema change.
function parseAvoid(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
}

function serializeAvoid(items: string[]): string {
  return items.map((s) => s.trim()).filter(Boolean).join("\n");
}

function AvoidStep() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const id = getDraftId();
  const [items, setItems] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    if (!id) {
      setRedirecting(true);
      toast.info("Let's start with your child's photo.");
      navigate({ to: "/create/photos" });
    }
  }, [authLoading, user, id, navigate]);

  // Hydrate from localStorage first (anonymous flow).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(STORY_LOCAL_KEY);
    if (!raw) return;
    try {
      const s = JSON.parse(raw);
      if (s.detailsAvoid) setItems(parseAvoid(s.detailsAvoid));
    } catch {
      /* ignore */
    }
  }, []);

  // For signed-in parents, hydrate from the database.
  useEffect(() => {
    if (!id || !user) return;
    supabase
      .from("books")
      .select("details_avoid")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }: { data: any }) => {
        if (data?.details_avoid) setItems(parseAvoid(data.details_avoid));
      });
  }, [id, user]);

  const suggestionsRemaining = useMemo(
    () => SUGGESTIONS.filter((s) => !items.some((i) => i.toLowerCase() === s.toLowerCase())),
    [items],
  );

  function persistLocal(nextItems: string[]) {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(STORY_LOCAL_KEY);
    let payload: Record<string, unknown> = {};
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        /* ignore */
      }
    }
    payload.detailsAvoid = serializeAvoid(nextItems);
    localStorage.setItem(STORY_LOCAL_KEY, JSON.stringify(payload));
  }

  function addItem(value: string) {
    const v = value.trim();
    if (!v) return;
    if (v.length > 60) {
      toast.error("Keep each item under 60 characters.");
      return;
    }
    if (items.some((i) => i.toLowerCase() === v.toLowerCase())) return;
    if (items.length >= 20) {
      toast.error("You can list up to 20 things to avoid.");
      return;
    }
    const next = [...items, v];
    setItems(next);
    persistLocal(next);
  }

  function removeItem(value: string) {
    const next = items.filter((i) => i !== value);
    setItems(next);
    persistLocal(next);
  }

  function onAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    addItem(draft);
    setDraft("");
  }

  async function next() {
    if (!user || !id) {
      // Anonymous — keep the in-progress list and continue.
      navigate({ to: "/create/style" });
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("books")
      .update({ details_avoid: items.length ? serializeAvoid(items) : null })
      .eq("id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(
      items.length
        ? `Saved ${items.length} item${items.length === 1 ? "" : "s"} to avoid.`
        : "Cleared your avoid list.",
    );
    navigate({ to: "/create/style" });
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
      <h1 className="font-display text-3xl font-semibold">Anything to leave out?</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Every book is gentle and age-appropriate by default. If your child is scared of something
        specific, add it and we'll keep it out.
      </p>

      <div className="mt-8 space-y-6">
        <form onSubmit={onAddSubmit} className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="avoid-input" className="sr-only">
              Add an item to avoid
            </Label>
            <Input
              id="avoid-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="e.g. thunderstorms, scary monsters, snakes"
              maxLength={60}
            />
          </div>
          <Button type="submit" variant="outline" disabled={!draft.trim()}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </form>

        <div className="rounded-md border border-border bg-paper/40 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Your avoid list</h2>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {items.length} item{items.length === 1 ? "" : "s"}
            </span>
          </div>
          {items.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Nothing here yet. Tap a suggestion below or type your own.
            </p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {items.map((it) => (
                <li key={it}>
                  <button
                    type="button"
                    onClick={() => removeItem(it)}
                    className="group inline-flex items-center gap-1.5 rounded-full border border-ember/40 bg-ember/10 px-3 py-1 text-xs text-foreground transition-colors hover:bg-ember/20"
                    aria-label={`Remove ${it}`}
                  >
                    <span>{it}</span>
                    <X className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {suggestionsRemaining.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Common things kids are scared of
            </h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {suggestionsRemaining.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => addItem(s)}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-ember/40 hover:text-foreground"
                  >
                    <Plus className="h-3 w-3" /> {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-start gap-3 rounded-md border border-sage/30 bg-sage/5 p-3 text-xs text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
          <p>
            We pass this list into every page's quality check. If a page contains one of these,
            the illustrator is asked to regenerate it with a specific correction instruction —
            you'll see that in the job progress view.
          </p>
        </div>

        <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/create/story" className="w-full sm:w-auto">
            <Button type="button" variant="ghost" className="w-full sm:w-auto">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
          <Button type="button" variant="ember" onClick={next} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Choose the art style{" "}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </WizardLayout>
  );
}
