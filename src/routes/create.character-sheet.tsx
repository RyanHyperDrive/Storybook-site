import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { WizardLayout } from "@/components/wizard-layout";
import { getDraftId } from "@/lib/draft";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Loader2, RefreshCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getArtStyle } from "@/lib/art-styles";

export const Route = createFileRoute("/create/character-sheet")({
  component: () => <AuthGate><Inner /></AuthGate>,
  head: () => ({ meta: [{ title: "Character — Create — StoryNest" }] }),
});

function Inner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const id = getDraftId();
  const [sheet, setSheet] = useState<any>(null);
  const [book, setBook] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const style = getArtStyle(book?.art_style);

  async function load() {
    if (!id) return;
    const [{ data: cs }, { data: b }] = await Promise.all([
      supabase.from("character_sheets").select("*").eq("book_id", id).maybeSingle(),
      supabase.from("books").select("*").eq("id", id).maybeSingle(),
    ]);
    setSheet(cs);
    setBook(b);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function generate() {
    if (!id || !user) return;
    setGenerating(true);
    // Simulated generation. In production this would call an Edge Function / server fn that
    // uses the uploaded photo to produce an illustrated character.
    await new Promise((r) => setTimeout(r, 1500));
    const placeholder = "https://images.unsplash.com/photo-1549887534-1541e9326642?w=900&q=80";
    if (sheet) {
      await supabase.from("character_sheets").update({
        image_url: placeholder, regenerations: (sheet.regenerations ?? 0) + 1, approved: false,
        description: "Curly hair, bright eyes, a cozy sweater — friendly and confident.",
      }).eq("id", sheet.id);
    } else {
      await supabase.from("character_sheets").insert({
        book_id: id, user_id: user.id, image_url: placeholder, approved: false,
        description: "Curly hair, bright eyes, a cozy sweater — friendly and confident.",
      });
    }
    await load();
    setGenerating(false);
  }

  async function approveAndCheckout() {
    if (!id || !sheet) return;
    setApproving(true);
    await supabase.from("character_sheets").update({ approved: true }).eq("id", sheet.id);
    // Placeholder: a real integration would create a payment session here.
    // For MVP, mark book paid and create a job.
    await supabase.from("books").update({ status: "paid" }).eq("id", id);
    const { data: job } = await supabase.from("jobs").insert({
      book_id: id, user_id: sheet.user_id, kind: "book", status: "queued", progress: 5,
    }).select().single();
    setApproving(false);
    if (job) {
      toast.success("Character approved — generating your book");
      navigate({ to: "/jobs/$jobId", params: { jobId: job.id } });
    }
  }

  return (
    <WizardLayout>
      <h1 className="font-display text-3xl font-semibold">Approve the illustrated character</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Review the parent-approved character below. Free regeneration if something looks off.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-border bg-paper/40">
          <div className="aspect-[4/5] bg-muted">
            {sheet?.image_url ? (
              <img src={sheet.image_url} alt="Character" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
                <div>
                  <Sparkles className="mx-auto h-6 w-6" />
                  <div className="mt-2">No character yet — generate to preview</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {sheet?.description && (
            <div className="rounded-md border border-border bg-background p-4 text-sm">
              <div className="text-xs font-semibold uppercase text-muted-foreground">Character notes</div>
              <p className="mt-2">{sheet.description}</p>
              <div className="mt-3 text-xs text-muted-foreground">
                Regenerations used: {sheet.regenerations ?? 0} (free)
              </div>
            </div>
          )}
          <Button variant="outline" className="w-full" onClick={generate} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            {sheet ? "Regenerate character" : "Generate character"}
          </Button>
          <Button variant="ember" className="w-full" disabled={!sheet || approving} onClick={approveAndCheckout}>
            {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Approve & generate book — $29.99
          </Button>
          <p className="text-xs text-muted-foreground">
            By approving you confirm this is the illustrated character you'd like to star in the story.
          </p>
        </div>
      </div>

      <div className="mt-10 flex items-center justify-between">
        <Link to="/create/style"><Button variant="ghost"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
      </div>
    </WizardLayout>
  );
}
