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
  { key: "page_illustrations", label: "Page illustrations", helper: "Painting each page in the style you chose.", icon: Brush, pct: 75 },
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
          supabase.from("books").select("id,title,status,cover_image_path,cover_validation,visual_consistency_contract,story_json,ebook_url,page_count,details_avoid").eq("id", data.book_id).maybeSingle(),
          supabase.from("book_pages").select("id,page_number,status,regenerations,needs_review,quality_score,review_notes,quality_metadata").eq("book_id", data.book_id).order("page_number", { ascending: true }),
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
  const reviewCountForJob = pages.filter((p) => p.needs_review).length;
  const finalRenderReady = !!book?.ebook_url;
  const fullyReady = done && finalRenderReady && reviewCountForJob === 0;
  const previewReady = done && !fullyReady;
  const pct: number = Math.max(0, Math.min(100, job.progress ?? 0));
  const displayPct = previewReady && !finalRenderReady ? Math.min(pct, 96) : pct;
  const currentStep: StepKey = (job.current_step as StepKey) || stepFromProgress(pct);
  const displayStep: StepKey = previewReady && !finalRenderReady ? "pdf_assembly" : currentStep;
  const currentMeta = STEPS.find((s) => s.key === displayStep) ?? STEPS[0];

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="text-center">
        <h1 className="font-display text-3xl font-semibold">
          {fullyReady
            ? "Your book is ready"
            : previewReady
              ? "Your book preview is ready"
              : failed
                ? "Something went wrong"
                : "Creating your book"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {fullyReady
            ? "All pages have been illustrated and assembled."
            : previewReady
              ? reviewCountForJob > 0
                ? `${reviewCountForJob} page${reviewCountForJob === 1 ? "" : "s"} need review before the final PDF is ready.`
                : "All pages are illustrated. The final PDF is still being assembled."
            : failed
              ? job.message ?? "Your book couldn't be generated. Please try again."
              : currentMeta.helper}
        </p>
      </div>

      {!failed && (
        <div className="mt-8 rounded-lg border border-border bg-paper/40 p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wide text-foreground">
              {fullyReady ? "Complete" : previewReady && !finalRenderReady ? "Final render pending" : currentMeta.label}
            </span>
            <span>{displayPct}%</span>
          </div>
          <Progress value={displayPct} className="mt-3" />
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
        <Timeline currentStep={displayStep} done={fullyReady} />
      )}

      {book && !failed && (
        <PipelineDetails book={book} pages={pages} />
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
            <BookOpen className="h-4 w-4" /> {fullyReady ? "Open your book" : "Review your book"}
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

function StatusPill({ tone, children }: { tone: "done" | "active" | "pending" | "warn"; children: React.ReactNode }) {
  const cls =
    tone === "done"
      ? "bg-sage/15 text-sage border-sage/30"
      : tone === "active"
        ? "bg-ember/10 text-ember border-ember/30"
        : tone === "warn"
          ? "bg-destructive/10 text-destructive border-destructive/30"
          : "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}>
      {children}
    </span>
  );
}

function PipelineDetails({ book, pages }: { book: any; pages: any[] }) {
  const contractReady = !!book.visual_consistency_contract;
  const coverReady = !!book.cover_image_path;
  const coverValidation = book.cover_validation as any;
  const storyPages: any[] = book.story_json?.pages ?? [];
  const storyReady = storyPages.length > 0;
  const renderReady = !!book.ebook_url;

  const expected = book.page_count ?? storyPages.length ?? pages.length;
  const doneCount = pages.filter((p) => p.status === "ready" || p.status === "done").length;
  const activeCount = pages.filter((p) => p.status === "rendering" || p.status === "validating" || p.status === "in_progress").length;
  const reviewCount = pages.filter((p) => p.needs_review).length;
  const totalRetries = pages.reduce((sum, p) => sum + (p.regenerations ?? 0), 0);

  const Row = ({
    label,
    helper,
    tone,
    status,
  }: {
    label: string;
    helper?: string;
    tone: "done" | "active" | "pending" | "warn";
    status: string;
  }) => (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        {helper && <p className="mt-0.5 text-xs text-muted-foreground">{helper}</p>}
      </div>
      <StatusPill tone={tone}>{status}</StatusPill>
    </div>
  );

  return (
    <div className="mt-8 rounded-lg border border-border bg-background p-5">
      <h2 className="font-display text-lg font-semibold">Pipeline details</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Live status of each stage of your book generation.
      </p>

      <div className="mt-4">
        <Row
          label="Visual contract"
          helper="Locks character look, palette, and style across pages."
          tone={contractReady ? "done" : "pending"}
          status={contractReady ? "Ready" : "Pending"}
        />
        <Row
          label="Story"
          helper={storyReady ? `${storyPages.length} pages written` : "Drafting narrative…"}
          tone={storyReady ? "done" : "active"}
          status={storyReady ? "Ready" : "Writing"}
        />
        <Row
          label="Cover"
          helper={
            coverValidation?.needs_regeneration
              ? "Cover flagged for regeneration"
              : coverReady
                ? "Cover illustrated and validated"
                : "Awaiting illustration"
          }
          tone={coverValidation?.needs_regeneration ? "warn" : coverReady ? "done" : "pending"}
          status={coverReady ? (coverValidation?.needs_regeneration ? "Retrying" : "Ready") : "Pending"}
        />
        <Row
          label="Pages"
          helper={`${doneCount}/${expected || "?"} illustrated${activeCount ? ` · ${activeCount} in progress` : ""}${reviewCount ? ` · ${reviewCount} need review` : ""}`}
          tone={reviewCount ? "warn" : expected && doneCount >= expected ? "done" : activeCount ? "active" : "pending"}
          status={reviewCount ? "Review" : expected && doneCount >= expected ? "Ready" : `${doneCount}/${expected || "?"}`}
        />
        <Row
          label="Retries"
          helper={
            totalRetries === 0
              ? "No regenerations needed so far."
              : `${totalRetries} page regeneration${totalRetries === 1 ? "" : "s"} triggered by quality checks.`
          }
          tone={totalRetries > 0 ? "warn" : "done"}
          status={String(totalRetries)}
        />
        <Row
          label="Final render"
          helper={renderReady ? "PDF assembled and ready to download." : reviewCount ? "Review flagged pages before final PDF assembly." : "Assembling the downloadable PDF."}
          tone={renderReady ? "done" : reviewCount ? "warn" : "active"}
          status={renderReady ? "Ready" : reviewCount ? "Review" : "Building"}
        />
      </div>

      {pages.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Per-page status
          </div>
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
            {pages.map((p) => {
              const isReady = p.status === "ready" || p.status === "done";
              const isFlag = p.needs_review;
              const tone: "done" | "active" | "warn" = isFlag ? "warn" : isReady ? "done" : "active";
              const bg =
                tone === "done"
                  ? "bg-sage/20 text-sage border-sage/40"
                  : tone === "warn"
                    ? "bg-destructive/10 text-destructive border-destructive/30"
                    : "bg-ember/10 text-ember border-ember/30";
              return (
                <div
                  key={p.id}
                  title={`Page ${p.page_number} · ${p.status}${p.regenerations ? ` · ${p.regenerations} retries` : ""}${p.review_notes ? ` · ${p.review_notes}` : ""}`}
                  className={`relative grid h-10 place-items-center rounded border text-xs font-semibold ${bg}`}
                >
                  {p.page_number}
                  {p.regenerations > 0 && (
                    <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full border border-border bg-background px-1 text-[9px] font-bold text-foreground">
                      {p.regenerations}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <AvoidListPanel book={book} />
      <CorrectionsLog book={book} pages={pages} />
    </div>
  );
}

function AvoidListPanel({ book }: { book: any }) {
  const raw: string = book?.details_avoid ?? "";
  const items = Array.from(
    new Set(
      raw
        .split(/[\n,]+/)
        .map((s: string) => s.trim())
        .filter(Boolean),
    ),
  );
  if (items.length === 0) return null;
  return (
    <div className="mt-6 rounded-lg border border-sage/30 bg-sage/5 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Avoid list applied</h3>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {items.length} item{items.length === 1 ? "" : "s"}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Every page is checked against these. Anything that slips through triggers an automatic
        regeneration with a specific correction.
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {items.map((it) => (
          <li
            key={it}
            className="inline-flex items-center rounded-full border border-sage/40 bg-background px-3 py-1 text-xs text-foreground"
          >
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CorrectionsLog({ book, pages }: { book: any; pages: any[] }) {
  type Entry = {
    key: string;
    label: string;
    instruction: string;
    retries: number;
    banned: string[];
    reasons: string[];
  };
  const entries: Entry[] = [];

  const coverBanned: string[] = Array.isArray(book?.cover_validation?.banned_content_detected)
    ? book.cover_validation.banned_content_detected
    : [];
  const coverReasons: string[] = Array.isArray(book?.cover_validation?.reasons)
    ? book.cover_validation.reasons
    : [];
  const coverInstruction =
    book?.cover_validation?.regeneration_instruction ||
    (coverBanned.length
      ? `Remove: ${coverBanned.join(", ")} (parent explicitly disallowed)`
      : "");
  if (coverInstruction || coverBanned.length) {
    entries.push({
      key: "cover",
      label: "Cover",
      instruction: coverInstruction,
      retries: 0,
      banned: coverBanned,
      reasons: coverReasons,
    });
  }

  for (const p of pages) {
    const meta = p.quality_metadata ?? {};
    const banned: string[] = Array.isArray(meta.banned_content_detected)
      ? meta.banned_content_detected
      : [];
    const reasons: string[] = Array.isArray(meta.reasons) ? meta.reasons : [];
    const instr: string = meta.regeneration_instruction || p.review_notes || "";
    if ((instr || banned.length) && (p.regenerations > 0 || p.needs_review)) {
      entries.push({
        key: `p${p.id}`,
        label: `Page ${p.page_number}`,
        instruction: instr,
        retries: p.regenerations ?? 0,
        banned,
        reasons,
      });
    }
  }

  if (entries.length === 0) return null;

  const totalBanned = entries.reduce((n, e) => n + e.banned.length, 0);

  return (
    <div className="mt-6 rounded-lg border border-ember/30 bg-ember/5 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Corrections applied</h3>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {entries.length} item{entries.length === 1 ? "" : "s"}
          {totalBanned > 0 ? ` · ${totalBanned} removed` : ""}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        What the quality checker flagged, what was removed from your avoid list, and the
        correction the illustrator was asked to apply.
      </p>
      <ul className="mt-3 space-y-2">
        {entries.map((e) => (
          <li key={e.key} className="rounded-md border border-border bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold">{e.label}</span>
              {e.retries > 0 && (
                <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {e.retries} retr{e.retries === 1 ? "y" : "ies"}
                </span>
              )}
            </div>

            {e.banned.length > 0 && (
              <div className="mt-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-destructive">
                  Removed from this {e.label === "Cover" ? "cover" : "page"}
                </div>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {e.banned.map((b) => (
                    <li
                      key={b}
                      className="inline-flex items-center rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive"
                      title="Matched an item on your avoid list"
                    >
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {e.reasons.length > 0 && (
              <div className="mt-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Why it was flagged
                </div>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] leading-relaxed text-muted-foreground">
                  {e.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {e.instruction && (
              <div className="mt-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Correction sent to illustrator
                </div>
                <p className="mt-1 text-xs leading-relaxed text-foreground">{e.instruction}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
