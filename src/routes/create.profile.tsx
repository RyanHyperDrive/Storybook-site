import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { WizardLayout } from "@/components/wizard-layout";
import { useAuth } from "@/hooks/use-auth";
import { ensureDraftBook } from "@/lib/draft";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const LOCAL_KEY = "storynest:profile_draft";

type ProfileDraft = {
  name: string;
  age: string;
  pronouns: string;
  loves: string;
};

export const Route = createFileRoute("/create/profile")({
  component: ProfileStep,
  head: () => ({ meta: [{ title: "About your child — StoryNest" }] }),
});

function ProfileStep() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<ProfileDraft>({ name: "", age: "", pronouns: "", loves: "" });
  const [busy, setBusy] = useState(false);
  const [bookId, setBookId] = useState<string | null>(null);

  // Hydrate from localStorage so anonymous parents don't lose typing.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      try { setDraft(JSON.parse(raw)); } catch { /* ignore */ }
    }
  }, []);

  // If signed in, hydrate (and overwrite) from the actual draft book.
  useEffect(() => {
    if (!user) return;
    ensureDraftBook(user.id).then((b) => {
      setBookId(b.id);
      setDraft({
        name: b.child_name ?? "",
        age: b.child_age?.toString() ?? "",
        pronouns: b.child_pronouns ?? "",
        loves: b.child_loves ?? "",
      });
    }).catch((e) => toast.error(e.message));
  }, [user]);

  function update<K extends keyof ProfileDraft>(key: K, value: string) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    if (typeof window !== "undefined") localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
  }

  async function next(e: React.FormEvent) {
    e.preventDefault();
    // Persist what we have so the user doesn't retype after sign-in.
    if (typeof window !== "undefined") localStorage.setItem(LOCAL_KEY, JSON.stringify(draft));

    if (!user) {
      // Not gated yet — just move them forward; the photos step asks for sign-in.
      navigate({ to: "/create/photos" });
      return;
    }
    if (!bookId) return;
    setBusy(true);
    const { error } = await supabase.from("books").update({
      child_name: draft.name,
      child_age: draft.age ? parseInt(draft.age) : null,
      child_pronouns: draft.pronouns,
      child_loves: draft.loves,
    }).eq("id", bookId);
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/create/photos" });
  }

  return (
    <WizardLayout>
      <h1 className="font-display text-3xl font-semibold">Tell us about your child</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This shapes the character and the language we use. Built for ages 4–7.
      </p>

      <form onSubmit={next} className="mt-8 space-y-5">
        <div>
          <Label htmlFor="name">Child's name</Label>
          <Input id="name" required value={draft.name} onChange={(e) => update("name", e.target.value)} placeholder="Ada" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="age">Age</Label>
            <Input id="age" type="number" min={3} max={9} value={draft.age} onChange={(e) => update("age", e.target.value)} placeholder="5" />
          </div>
          <div>
            <Label htmlFor="pronouns">Pronouns</Label>
            <Input id="pronouns" value={draft.pronouns} onChange={(e) => update("pronouns", e.target.value)} placeholder="she/her, he/him, they/them" />
          </div>
        </div>
        <div>
          <Label htmlFor="loves">What do they love?</Label>
          <Textarea
            id="loves"
            rows={4}
            value={draft.loves}
            onChange={(e) => update("loves", e.target.value)}
            placeholder="Dinosaurs, our dog Mango, and helping in the kitchen."
          />
        </div>

        <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-sage" />
            We'll ask you to sign in before uploading any photos.
          </p>
          <Button type="submit" variant="ember" disabled={busy} className="w-full sm:w-auto">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </WizardLayout>
  );
}
