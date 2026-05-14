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
import { Switch } from "@/components/ui/switch";
import { ArrowRight, Loader2, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { childSchema, emptyChild, type ChildDraft } from "@/lib/create-schema";

const LOCAL_KEY = "storynest:profile_draft_v2";

type ProfileState = {
  isTwins: boolean;
  children: [ChildDraft, ChildDraft];
};

export const Route = createFileRoute("/create/profile")({
  component: ProfileStep,
  head: () => ({ meta: [{ title: "About your child — StoryNest" }] }),
});

function ProfileStep() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<ProfileState>({
    isTwins: false,
    children: [{ ...emptyChild }, { ...emptyChild }],
  });
  const [busy, setBusy] = useState(false);
  const [bookId, setBookId] = useState<string | null>(null);

  // Hydrate from localStorage so anonymous parents don't lose typing.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.children)) setState(parsed);
      } catch {
        /* ignore */
      }
    }
  }, []);

  // If signed in, hydrate from the actual draft book + child profiles.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const b = await ensureDraftBook(user.id);
      setBookId(b.id);
      const { data: kids } = await supabase
        .from("child_profiles")
        .select("*")
        .eq("book_id", b.id)
        .order("slot");
      if (kids && kids.length) {
        const primary = kids.find((k: any) => k.slot === "primary") ?? kids[0];
        const sibling = kids.find((k: any) => k.slot === "sibling");
        setState({
          isTwins: !!sibling || !!b.is_twins,
          children: [rowToDraft(primary), sibling ? rowToDraft(sibling) : { ...emptyChild }],
        });
      } else if (b.child_name) {
        // Fall back to legacy book columns (single child).
        setState((s) => ({
          ...s,
          children: [
            {
              ...emptyChild,
              name: b.child_name ?? "",
              age: b.child_age?.toString() ?? "",
              pronouns: b.child_pronouns ?? "",
              loves: b.child_loves ?? "",
            },
            { ...emptyChild },
          ],
        }));
      }
    })().catch((e) => toast.error(e.message));
  }, [user]);

  function updateChild(idx: 0 | 1, key: keyof ChildDraft, value: string) {
    const children = [...state.children] as [ChildDraft, ChildDraft];
    children[idx] = { ...children[idx], [key]: value };
    const next = { ...state, children };
    setState(next);
    if (typeof window !== "undefined") localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
  }

  function setTwins(v: boolean) {
    const next = { ...state, isTwins: v };
    setState(next);
    if (typeof window !== "undefined") localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
  }

  async function next(e: React.FormEvent) {
    e.preventDefault();
    // Validate
    const slots: Array<["primary" | "sibling", ChildDraft]> = [["primary", state.children[0]]];
    if (state.isTwins) slots.push(["sibling", state.children[1]]);
    for (const [slot, c] of slots) {
      const result = childSchema.safeParse(c);
      if (!result.success) {
        toast.error(`${slot === "primary" ? "Child 1" : "Child 2"}: ${result.error.issues[0].message}`);
        return;
      }
    }

    if (typeof window !== "undefined") localStorage.setItem(LOCAL_KEY, JSON.stringify(state));

    if (!user) {
      navigate({ to: "/create/photos" });
      return;
    }
    if (!bookId) return;
    setBusy(true);

    const primary = state.children[0];
    // Sync primary child to legacy book columns + twin flag.
    const { error: bErr } = await supabase
      .from("books")
      .update({
        child_name: primary.name,
        child_age: primary.age ? parseInt(primary.age) : null,
        child_pronouns: primary.pronouns || null,
        child_loves: primary.loves || null,
        is_twins: state.isTwins,
      })
      .eq("id", bookId);
    if (bErr) {
      setBusy(false);
      return toast.error(bErr.message);
    }

    // Replace child_profiles for this book (simpler than diffing).
    await supabase.from("child_profiles").delete().eq("book_id", bookId).eq("user_id", user.id);
    const rows = slots.map(([slot, c]) => ({
      user_id: user.id,
      book_id: bookId,
      slot,
      name: c.name,
      age: c.age ? parseInt(c.age) : null,
      pronouns: c.pronouns || null,
      favorite_color: c.favorite_color || null,
      favorite_activities: c.favorite_activities || null,
      loves: c.loves || null,
      personality_traits: c.personality_traits || null,
      accessibility_details: c.accessibility_details || null,
    }));
    const { error } = await supabase.from("child_profiles").insert(rows);
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/create/photos" });
  }

  return (
    <WizardLayout>
      <h1 className="font-display text-3xl font-semibold">Tell us about your child</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        These details shape the character and the story's voice. Share what makes your child
        unique — you don't need to include any sensitive details.
      </p>

      <div className="mt-6 flex items-center justify-between rounded-md border border-border bg-paper/40 p-4">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-ember" />
          <div>
            <div className="text-sm font-semibold">Creating for twins?</div>
            <p className="text-xs text-muted-foreground">
              We'll feature both children together throughout the book.
            </p>
          </div>
        </div>
        <Switch checked={state.isTwins} onCheckedChange={setTwins} aria-label="Twins" />
      </div>

      <form onSubmit={next} className="mt-8 space-y-10">
        <ChildFieldset
          label={state.isTwins ? "Child 1" : "Child"}
          value={state.children[0]}
          onChange={(k, v) => updateChild(0, k, v)}
        />
        {state.isTwins && (
          <ChildFieldset
            label="Child 2"
            value={state.children[1]}
            onChange={(k, v) => updateChild(1, k, v)}
          />
        )}

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

function ChildFieldset({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ChildDraft;
  onChange: (k: keyof ChildDraft, v: string) => void;
}) {
  return (
    <fieldset className="space-y-5 rounded-lg border border-border bg-background p-5">
      <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </legend>

      <div>
        <Label htmlFor={`${label}-name`}>First name</Label>
        <Input
          id={`${label}-name`}
          required
          maxLength={40}
          value={value.name}
          onChange={(e) => onChange("name", e.target.value)}
          placeholder="Ada"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${label}-age`}>Age</Label>
          <Input
            id={`${label}-age`}
            type="number"
            min={1}
            max={12}
            value={value.age}
            onChange={(e) => onChange("age", e.target.value)}
            placeholder="5"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Personalized for ages 2–10. Reading level adapts to your child.
          </p>
        </div>
        <div>
          <Label htmlFor={`${label}-pronouns`}>Pronouns</Label>
          <Input
            id={`${label}-pronouns`}
            maxLength={40}
            value={value.pronouns}
            onChange={(e) => onChange("pronouns", e.target.value)}
            placeholder="she/her, he/him, they/them"
          />
        </div>
      </div>

      <div>
        <Label htmlFor={`${label}-color`}>Favorite color</Label>
        <Input
          id={`${label}-color`}
          maxLength={40}
          value={value.favorite_color}
          onChange={(e) => onChange("favorite_color", e.target.value)}
          placeholder="Sunset orange"
        />
      </div>

      <div>
        <Label htmlFor={`${label}-activities`}>Favorite activities</Label>
        <Textarea
          id={`${label}-activities`}
          rows={2}
          maxLength={400}
          value={value.favorite_activities}
          onChange={(e) => onChange("favorite_activities", e.target.value)}
          placeholder="Building forts, splashing in puddles, painting at the kitchen table."
        />
      </div>

      <div>
        <Label htmlFor={`${label}-loves`}>Favorite things</Label>
        <Textarea
          id={`${label}-loves`}
          rows={2}
          maxLength={400}
          value={value.loves}
          onChange={(e) => onChange("loves", e.target.value)}
          placeholder="Dinosaurs, our dog Mango, blueberry pancakes."
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Toys, animals, foods, places — anything that lights them up.
        </p>
      </div>

      <div>
        <Label htmlFor={`${label}-traits`}>Personality traits</Label>
        <Textarea
          id={`${label}-traits`}
          rows={2}
          maxLength={400}
          value={value.personality_traits}
          onChange={(e) => onChange("personality_traits", e.target.value)}
          placeholder="Curious, gentle with little ones, loves a good giggle."
        />
      </div>

      <div>
        <Label htmlFor={`${label}-access`}>Physical or accessibility details to represent</Label>
        <Textarea
          id={`${label}-access`}
          rows={2}
          maxLength={400}
          value={value.accessibility_details}
          onChange={(e) => onChange("accessibility_details", e.target.value)}
          placeholder="Wears glasses; uses a wheelchair; long curly hair in braids."
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Optional. Only what you'd like the illustrator to honor — skip anything you'd rather not share.
        </p>
      </div>
    </fieldset>
  );
}

function rowToDraft(row: any): ChildDraft {
  return {
    name: row?.name ?? "",
    age: row?.age?.toString() ?? "",
    pronouns: row?.pronouns ?? "",
    favorite_color: row?.favorite_color ?? "",
    favorite_activities: row?.favorite_activities ?? "",
    loves: row?.loves ?? "",
    personality_traits: row?.personality_traits ?? "",
    accessibility_details: row?.accessibility_details ?? "",
  };
}
