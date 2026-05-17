import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  BookOpen,
  Brush,
  Camera,
  Check,
  FileText,
  Mail,
  PenLine,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

export const Route = createFileRoute("/jobs/$jobId")({
  component: () => (
    <AuthGate>
      <Inner />
    </AuthGate>
  ),
  head: () => ({ meta: [{ title: "Creating your book — StoryNest" }] }),
});

type StepKey =
  | "photo_check"
  | "character_profile"
  | "character_sheet"
  | "story_writing"
  | "page_illustrations"
  | "quality_checks"
  | "pdf_assembly"
  | "ready";

const STEPS: { key: StepKey; label: string; helper: string; icon: any; pct: number }[] = [
  { key: "photo_check", label: "Photo check", helper: "Confirming the reference photo is clear and safe.", icon: Camera, pct: 8 },
  { key: "character_profile", label: "Character profile", helper: "Distilling the details that make your child unique.", icon: UserRound, pct: 18 },
  { key: "character_sheet", label: "Character sheet", helper: "Locking in the illustrated look so every page matches.", icon: Sparkles, pct: 30 },
  { key: "story_writing", label: "Story writing", helper: "Drafting the narrative around your prompt and theme.", icon: PenLine, pct: 45 },
  { key: "page_illustrations", label: "Page illustrations", helper: "Painting each spread in the style you chose.", icon: Brush, pct: 75 },
  { key: "quality_checks", label: "Quality checks", helper: "Reviewing every page for consistency and tone.", icon: ShieldCheck, pct: 88 },
  { key: "pdf_assembly", label: "PDF assembly", helper: "Binding the pages into your downloadable book.", icon: FileText, pct: 96 },
  { key: "ready", label: "Ready", helper: "Your book is ready to read.", icon: BookOpen, pct: 100 },
];

function stepFromProgress(pct: number): StepKey {
  for (let i = STEPS.length - 1; i >= 0; i--) {
    if (pct >= STEPS[i].pct) return STEPS[i].key;
  }
  return "photo_check";
}

function nextStep(current: StepKey): StepKey {
  const i = STEPS.findIndex((s) => s.key === current);
  return STEPS[Math.min(STEPS.length - 1, i + 1)].key;
}

function Inner() {
  const { jobId } = Route.useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<any>(null);
  const [book, setBook] = useState<any>(null);
  const [pages, setPages] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let inFlight = false;

    async function poll() {
      const { data, error } = await supabase
        .from("jobs").select("*").eq("id", jobId).maybeSingle();
      if (!active) return;
      setLoading(false);
      if (error) { setError(error.message); return; }
      setJob(data);
      if (data?.book_id) {
        const [{ data: bk }, { data: pg }] = await Promise.all([
          supabase.from("books").select("id,title,status,cover_image_path,cover_validation,visual_consistency_contract,story_json,ebook_url,page_count").eq("id", data.book_id).maybeSingle(),
          supabase.from("book_pages").select("id,page_number,status,regenerations,needs_review,quality_score,review_notes").eq("book_id", data.book_id).order("page_number", { ascending: true }),
        ]);
        if (!active) return;
        setBook(bk);
        setPages(pg ?? []);
      }
      if (!data) return;
      if (data.status === "done" || data.status === "error") return;
      if (inFlight) return;
      inFlight = true;
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (!token) return;
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-book-step`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        });
      } catch (e) {
        console.error("run-book-step error", e);
      } finally {
        inFlight = false;
      }
    }

    poll();
    const t = setInterval(poll, 3000);
    return () => { active = false; clearInterval(t); };
  }, [jobId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <SkeletonTimeline />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="We couldn't load this job"
        message={error}
      />
    );
  }

  if (!job) {
    return (
      <ErrorState
        title="Job not found"
        message="This generation job doesn't exist or you don't have access to it."
      />
    );
  }

  const failed = job.status === "error" || job.status === "failed";
  const done = job.status === "done";
  const pct: number = Math.max(0, Math.min(100, job.progress ?? 0));
  const currentStep: StepKey = (job.current_step as StepKey) || stepFromProgress(pct);
  const currentMeta = STEPS.find((s) => s.key === currentStep) ?? STEPS[0];

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="text-center">
        <h1 className="font-display text-3xl font-semibold">
          {done ? "Your book is ready" : failed ? "Something went wrong" : "Creating your book"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {done
            ? "All pages have been illustrated and assembled."
            : failed
              ? job.message ?? "Your book couldn't be generated. Please try again."
              : currentMeta.helper}
        </p>
      </div>

      {!failed && (
        <div className="mt-8 rounded-lg border border-border bg-paper/40 p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wide text-foreground">
              {done ? "Complete" : currentMeta.label}
            </span>
            <span>{pct}%</span>
          </div>
          <Progress value={pct} className="mt-3" />
        </div>
      )}

      {failed ? (
        <div className="mt-8 rounded-lg border border-destructive/40 bg-destructive/5 p-5 text-sm">
          <div className="flex items-center gap-2 font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4" /> Generation stopped
          </div>
          <p className="mt-2 text-muted-foreground">
            {job.message ?? "An unexpected error occurred while creating your book."}
          </p>
          <div className="mt-4 flex gap-2">
            <Link to="/library">
              <Button size="sm" variant="outline">Back to library</Button>
            </Link>
            <Link to="/create/photos">
              <Button size="sm" variant="ember">Start a new book</Button>
            </Link>
          </div>
        </div>
      ) : (
        <Timeline currentStep={currentStep} done={done} />
      )}

      {!done && !failed && (
        <div className="mt-8 flex items-start gap-3 rounded-md border border-border bg-background p-4 text-sm">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-ember" />
          <div>
            <div className="font-semibold">You can close this page.</div>
            <p className="mt-0.5 text-muted-foreground">
              We'll email you when the book is ready. You can also check progress anytime from
              your library.
            </p>
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-col items-center gap-3">
        {done ? (
          <Button
            variant="ember"
            onClick={() => navigate({ to: "/books/$bookId", params: { bookId: job.book_id } })}
          >
            <BookOpen className="h-4 w-4" /> Open your book
          </Button>
        ) : (
          <Link to="/library" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            View library
          </Link>
        )}
      </div>
    </div>
  );
}

function Timeline({ currentStep, done }: { currentStep: StepKey; done: boolean }) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStep);
  return (
    <ol className="mt-8 space-y-2">
      {STEPS.map((s, i) => {
        const isDone = done ? true : i < currentIdx;
        const isActive = !done && i === currentIdx;
        const Icon = s.icon;
        return (
          <li
            key={s.key}
            className={[
              "flex items-start gap-4 rounded-lg border p-4 transition-colors",
              isActive
                ? "border-ember/40 bg-ember/5"
                : isDone
                  ? "border-sage/30 bg-sage/5"
                  : "border-border bg-background",
            ].join(" ")}
          >
            <div
              className={[
                "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border",
                isActive
                  ? "border-ember bg-ember text-ember-foreground"
                  : isDone
                    ? "border-sage bg-sage text-sage-foreground"
                    : "border-border bg-muted text-muted-foreground",
              ].join(" ")}
            >
              {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold">{s.label}</div>
                {isActive && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-ember/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ember">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ember" />
                    In progress
                  </span>
                )}
                {isDone && !isActive && (
                  <span className="text-[10px] font-medium uppercase tracking-wide text-sage">
                    Done
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.helper}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function SkeletonTimeline() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="mx-auto h-7 w-64 rounded bg-muted" />
      <div className="mx-auto mt-2 h-3 w-80 rounded bg-muted" />
      <div className="mt-8 h-3 w-full rounded bg-muted" />
      <div className="mt-6 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-muted/60" />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <h1 className="mt-4 font-display text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <Link to="/library" className="mt-6 inline-block">
        <Button variant="outline" size="sm">Back to library</Button>
      </Link>
    </div>
  );
}
