import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { WizardLayout } from "@/components/wizard-layout";
import { getDraftId } from "@/lib/draft";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import s1 from "@/assets/sample-1.jpg";
import s2 from "@/assets/sample-2.jpg";
import s3 from "@/assets/sample-3.jpg";

export const Route = createFileRoute("/create/style")({
  component: () => <AuthGate><Inner /></AuthGate>,
  head: () => ({ meta: [{ title: "Style — Create — StoryNest" }] }),
});

const styles = [
  { id: "warm-watercolor", name: "Warm watercolor", desc: "Soft, painterly, bedtime-friendly", img: s3 },
  { id: "storybook-classic", name: "Storybook classic", desc: "Bold lines, rich color, timeless", img: s1 },
  { id: "dreamy-pastel", name: "Dreamy pastel", desc: "Airy and gentle, perfect for younger kids", img: s2 },
];

function Inner() {
  const navigate = useNavigate();
  const id = getDraftId();
  const [picked, setPicked] = useState(styles[0].id);

  useEffect(() => {
    if (!id) return;
    supabase.from("books").select("art_style").eq("id", id).maybeSingle().then(({ data }) => {
      if (data?.art_style) setPicked(data.art_style);
    });
  }, [id]);

  async function next() {
    if (!id) return;
    await supabase.from("books").update({ art_style: picked }).eq("id", id);
    navigate({ to: "/create/character-sheet" });
  }

  return (
    <WizardLayout>
      <h1 className="font-display text-3xl font-semibold">Pick an illustration style</h1>
      <p className="mt-2 text-sm text-muted-foreground">You can preview a different style on the next step too.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {styles.map((s) => {
          const active = picked === s.id;
          return (
            <button key={s.id} onClick={() => setPicked(s.id)}
              className={[
                "overflow-hidden rounded-lg border bg-background text-left transition-all",
                active ? "border-ember ring-2 ring-ember/30" : "border-border hover:border-muted-foreground",
              ].join(" ")}>
              <div className="aspect-[4/5] overflow-hidden bg-muted">
                <img src={s.img} alt={s.name} className="h-full w-full object-cover" />
              </div>
              <div className="p-3">
                <div className="text-sm font-semibold">{s.name}</div>
                <div className="text-xs text-muted-foreground">{s.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-10 flex items-center justify-between">
        <Link to="/create/story"><Button variant="ghost"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
        <Button variant="ember" onClick={next}>Continue <ArrowRight className="h-4 w-4" /></Button>
      </div>
    </WizardLayout>
  );
}
