import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/jobs/$jobId")({
  component: () => <AuthGate><Inner /></AuthGate>,
});

function Inner() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<any>(null);

  useEffect(() => {
    let active = true;
    async function tick() {
      const { data } = await supabase.from("jobs").select("*").eq("id", jobId).maybeSingle();
      if (!active) return;
      setJob(data);
      if (!data) return;
      // Simulate progress
      if (data.status !== "done" && data.progress < 100) {
        const next = Math.min(100, data.progress + 12);
        const status = next >= 100 ? "done" : "running";
        await supabase.from("jobs").update({ progress: next, status, message: status === "done" ? "Book ready" : "Illustrating pages…" }).eq("id", jobId);
        if (status === "done") {
          await supabase.from("books").update({ status: "ready", cover_url: "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=800&q=80" }).eq("id", data.book_id);
        }
      }
    }
    tick();
    const t = setInterval(tick, 1500);
    return () => { active = false; clearInterval(t); };
  }, [jobId]);

  if (!job) return <div className="grid min-h-[40vh] place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const done = job.status === "done";
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="font-display text-3xl font-semibold">{done ? "Your book is ready" : "Creating your book"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{job.message ?? "Just a moment…"}</p>
      <div className="mt-6">
        <Progress value={job.progress} />
        <div className="mt-2 text-xs text-muted-foreground">{job.progress}%</div>
      </div>
      {done && (
        <Button className="mt-6" variant="ember" onClick={() => navigate({ to: "/books/$bookId", params: { bookId: job.book_id } })}>
          Open your book
        </Button>
      )}
      {!done && <Link to="/library" className="mt-6 inline-block text-sm text-muted-foreground underline">View library</Link>}
    </div>
  );
}
