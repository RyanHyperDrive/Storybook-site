import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { WizardLayout } from "@/components/wizard-layout";
import { useAuth } from "@/hooks/use-auth";
import { ensureDraftBook } from "@/lib/draft";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/create/profile")({
  component: () => <AuthGate message="Sign in to save your draft."><Inner /></AuthGate>,
  head: () => ({ meta: [{ title: "Profile — Create — StoryNest" }] }),
});

function Inner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [loves, setLoves] = useState("");
  const [busy, setBusy] = useState(false);
  const [bookId, setBookId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    ensureDraftBook(user.id).then((b) => {
      setBookId(b.id);
      setName(b.child_name ?? "");
      setAge(b.child_age?.toString() ?? "");
      setPronouns(b.child_pronouns ?? "");
      setLoves(b.child_loves ?? "");
    }).catch((e) => toast.error(e.message));
  }, [user]);

  async function next(e: React.FormEvent) {
    e.preventDefault();
    if (!bookId) return;
    setBusy(true);
    const { error } = await supabase.from("books").update({
      child_name: name,
      child_age: age ? parseInt(age) : null,
      child_pronouns: pronouns,
      child_loves: loves,
    }).eq("id", bookId);
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/create/photos" });
  }

  return (
    <WizardLayout>
      <h1 className="font-display text-3xl font-semibold">Tell us about your child</h1>
      <p className="mt-2 text-sm text-muted-foreground">This shapes the character and the language we'll use.</p>
      <form onSubmit={next} className="mt-8 space-y-5">
        <div>
          <Label htmlFor="name">Child's name</Label>
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="age">Age</Label>
            <Input id="age" type="number" min={1} max={12} value={age} onChange={(e) => setAge(e.target.value)} placeholder="5" />
          </div>
          <div>
            <Label htmlFor="pronouns">Pronouns</Label>
            <Input id="pronouns" value={pronouns} onChange={(e) => setPronouns(e.target.value)} placeholder="she/her, he/him, they/them" />
          </div>
        </div>
        <div>
          <Label htmlFor="loves">What do they love?</Label>
          <Textarea id="loves" rows={4} value={loves} onChange={(e) => setLoves(e.target.value)}
            placeholder="Dinosaurs, our dog Mango, and helping in the kitchen." />
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="ember" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </WizardLayout>
  );
}
