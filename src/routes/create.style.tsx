import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { WizardLayout } from "@/components/wizard-layout";
import { getDraftId, STYLE_LOCAL_KEY } from "@/lib/draft";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Check, Clock, ShieldCheck } from "lucide-react";
import {
  ART_STYLES,
  COMING_SOON_STYLES,
  DEFAULT_ART_STYLE_KEY,
  isArtStyleKey,
  type ArtStyleKey,
} from "@/lib/art-styles";
import { StyleArtwork } from "@/components/style-artwork";

export const Route = createFileRoute("/create/style")({
  component: StyleStep,
  head: () => ({ meta: [{ title: "Style — Create — StoryNest" }] }),
});

function StyleStep() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const id = getDraftId();
  const [picked, setPicked] = useState<ArtStyleKey>(DEFAULT_ART_STYLE_KEY);

  // Hydrate from localStorage first (works for anonymous parents).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const local = localStorage.getItem(STYLE_LOCAL_KEY);
    if (local && isArtStyleKey(local)) setPicked(local);
  }, []);

  // If signed in with a draft, prefer the saved book value.
  useEffect(() => {
    if (!id || !user) return;
    supabase
      .from("books")
      .select("art_style")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.art_style && isArtStyleKey(data.art_style)) {
          setPicked(data.art_style);
        }
      });
  }, [id, user]);

  function choose(key: ArtStyleKey) {
    setPicked(key);
    if (typeof window !== "undefined") localStorage.setItem(STYLE_LOCAL_KEY, key);
  }

  async function next() {
    if (typeof window !== "undefined") localStorage.setItem(STYLE_LOCAL_KEY, picked);
    if (user && id) {
      await supabase.from("books").update({ art_style: picked }).eq("id", id);
    }
    navigate({ to: "/create/character-sheet" });
  }

  return (
    <WizardLayout>
      <h1 className="font-display text-3xl font-semibold">Pick an illustration style</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Every page in the book uses this style. You'll preview it on your child's illustrated
        character next.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {ART_STYLES.map((s) => {
          const active = picked === s.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => choose(s.key)}
              aria-pressed={active}
              className={[
                "group flex items-stretch gap-3 overflow-hidden rounded-lg border bg-background p-2 text-left transition-all",
                active
                  ? "border-ember ring-2 ring-ember/30"
                  : "border-border hover:border-muted-foreground",
              ].join(" ")}
            >
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md sm:h-28 sm:w-24">
                <StyleArtwork styleKey={s.key} variant="cover" />
                {active && (
                  <div className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-ember text-ember-foreground">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center py-1 pr-2">
                <div className="text-sm font-semibold">{s.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {s.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-8 rounded-lg border border-dashed border-border bg-paper/40 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> More styles coming later
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {COMING_SOON_STYLES.map((s) => (
            <span
              key={s.name}
              className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground"
            >
              {s.name}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-10 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/create/story" className="w-full sm:w-auto">
          <Button variant="ghost" className="w-full sm:w-auto">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <Button variant="ember" onClick={next} className="w-full sm:w-auto">
            Upload photo securely <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-sage" />
            Your child's photo is private and never used to train models.
          </p>
        </div>
      </div>
    </WizardLayout>
  );
}
