import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/quality")({
  head: () => ({ meta: [{ title: "Quality dashboard — StoryNest admin" }] }),
  component: QualityDashboard,
});

type Job = {
  id: string;
  book_id: string;
  kind: string;
  status: string;
  progress: number;
  current_step: string | null;
  message: string | null;
  created_at: string;
  updated_at: string;
};

type Page = {
  id: string;
  book_id: string;
  page_number: number;
  status: string;
  regenerations: number;
  quality_score: number | null;
  needs_review: boolean;
  review_notes: string | null;
  updated_at: string;
};

const FAILED_STATUSES = new Set(["error", "failed"]);
const LOW_SCORE_THRESHOLD = 70;

function QualityDashboard() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const admin = !!data?.find((r) => r.role === "admin");
      if (cancelled) return;
      setIsAdmin(admin);
      if (!admin) {
        setLoading(false);
        return;
      }

      const [jobsRes, pagesRes] = await Promise.all([
        supabase
          .from("jobs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(25),
        supabase
          .from("book_pages")
          .select(
            "id, book_id, page_number, status, regenerations, quality_score, needs_review, review_notes, updated_at",
          )
          .order("updated_at", { ascending: false })
          .limit(500),
      ]);
      if (cancelled) return;
      setJobs((jobsRes.data ?? []) as Job[]);
      setPages((pagesRes.data ?? []) as Page[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, refreshKey]);

  const failedPages = useMemo(
    () => pages.filter((p) => FAILED_STATUSES.has(p.status)),
    [pages],
  );
  const reviewPages = useMemo(
    () =>
      pages.filter(
        (p) =>
          p.needs_review ||
          (p.quality_score !== null && p.quality_score < LOW_SCORE_THRESHOLD) ||
          p.regenerations >= 3,
      ),
    [pages],
  );
  const scoredPages = useMemo(
    () => pages.filter((p) => p.quality_score !== null),
    [pages],
  );
  const avgScore = useMemo(() => {
    if (!scoredPages.length) return null;
    const sum = scoredPages.reduce((acc, p) => acc + (p.quality_score ?? 0), 0);
    return sum / scoredPages.length;
  }, [scoredPages]);

  if (isAdmin === null || (isAdmin && loading)) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-3 font-display text-2xl font-semibold">Admins only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You need an admin role to view the quality dashboard.
        </p>
      </div>
    );
  }

  async function toggleReview(page: Page, next: boolean) {
    const { error } = await supabase
      .from("book_pages")
      .update({ needs_review: next })
      .eq("id", page.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(next ? "Flagged for review" : "Marked as resolved");
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Quality dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Recent generation jobs, failed pages, and anything queued for human review.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setRefreshKey((k) => k + 1)}
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* KPI strip */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Jobs (last 25)"
          value={jobs.length.toString()}
          icon={<Clock className="h-4 w-4" />}
        />
        <Stat
          label="Failed pages"
          value={failedPages.length.toString()}
          tone={failedPages.length ? "danger" : "ok"}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <Stat
          label="Needs review"
          value={reviewPages.length.toString()}
          tone={reviewPages.length ? "warn" : "ok"}
          icon={<Eye className="h-4 w-4" />}
        />
        <Stat
          label="Avg quality"
          value={avgScore !== null ? avgScore.toFixed(1) : "—"}
          tone={
            avgScore === null
              ? "neutral"
              : avgScore >= 85
              ? "ok"
              : avgScore >= LOW_SCORE_THRESHOLD
              ? "warn"
              : "danger"
          }
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
      </div>

      {/* Recent jobs */}
      <Section title={`Recent generation jobs (${jobs.length})`}>
        {jobs.length === 0 ? (
          <Empty text="No jobs yet." />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Job</th>
                <th className="p-3">Book</th>
                <th className="p-3">Step</th>
                <th className="p-3">Status</th>
                <th className="p-3">Progress</th>
                <th className="p-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-t border-border">
                  <td className="p-3 font-mono text-xs">{j.id.slice(0, 8)}</td>
                  <td className="p-3 font-mono text-xs">
                    <Link
                      to="/books/$bookId"
                      params={{ bookId: j.book_id }}
                      className="hover:underline"
                    >
                      {j.book_id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="p-3 text-muted-foreground">{j.current_step ?? "—"}</td>
                  <td className="p-3">
                    <StatusPill status={j.status} />
                  </td>
                  <td className="p-3">{j.progress}%</td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(j.updated_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Failed pages */}
      <Section title={`Failed pages (${failedPages.length})`}>
        {failedPages.length === 0 ? (
          <Empty text="No failed pages." />
        ) : (
          <PageTable pages={failedPages} onToggleReview={toggleReview} />
        )}
      </Section>

      {/* Manual review queue */}
      <Section
        title={`Manual review queue (${reviewPages.length})`}
        subtitle={`Pages flagged, scored under ${LOW_SCORE_THRESHOLD}, or regenerated 3+ times.`}
      >
        {reviewPages.length === 0 ? (
          <Empty text="Nothing waiting for review. Nice." />
        ) : (
          <PageTable pages={reviewPages} onToggleReview={toggleReview} />
        )}
      </Section>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "ok" | "warn" | "danger" | "neutral";
}) {
  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "warn"
      ? "text-amber-600"
      : tone === "ok"
      ? "text-emerald-600"
      : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`mt-2 font-display text-2xl font-semibold ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      <div className="mt-3 overflow-x-auto rounded-md border border-border">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="p-6 text-center text-sm text-muted-foreground">{text}</div>;
}

function StatusPill({ status }: { status: string }) {
  const tone = FAILED_STATUSES.has(status)
    ? "bg-destructive/10 text-destructive"
    : status === "done" || status === "ready"
    ? "bg-emerald-500/10 text-emerald-700"
    : status === "running" || status === "regenerating"
    ? "bg-amber-500/10 text-amber-700"
    : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${tone}`}>
      {status}
    </span>
  );
}

function PageTable({
  pages,
  onToggleReview,
}: {
  pages: Page[];
  onToggleReview: (p: Page, next: boolean) => void;
}) {
  return (
    <table className="w-full text-sm">
      <thead className="bg-paper text-left text-xs uppercase text-muted-foreground">
        <tr>
          <th className="p-3">Book</th>
          <th className="p-3">Page</th>
          <th className="p-3">Status</th>
          <th className="p-3">Score</th>
          <th className="p-3">Regens</th>
          <th className="p-3">Updated</th>
          <th className="p-3 text-right">Action</th>
        </tr>
      </thead>
      <tbody>
        {pages.map((p) => (
          <tr key={p.id} className="border-t border-border">
            <td className="p-3 font-mono text-xs">
              <Link
                to="/books/$bookId"
                params={{ bookId: p.book_id }}
                className="hover:underline"
              >
                {p.book_id.slice(0, 8)}
              </Link>
            </td>
            <td className="p-3">#{p.page_number}</td>
            <td className="p-3">
              <StatusPill status={p.status} />
            </td>
            <td className="p-3">
              {p.quality_score !== null ? (
                <span
                  className={
                    p.quality_score < LOW_SCORE_THRESHOLD
                      ? "font-medium text-destructive"
                      : "text-foreground"
                  }
                >
                  {Number(p.quality_score).toFixed(1)}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </td>
            <td className="p-3">{p.regenerations}</td>
            <td className="p-3 text-muted-foreground">
              {new Date(p.updated_at).toLocaleString()}
            </td>
            <td className="p-3 text-right">
              <Button
                size="sm"
                variant={p.needs_review ? "ember" : "ghost"}
                onClick={() => onToggleReview(p, !p.needs_review)}
              >
                {p.needs_review ? "Mark resolved" : "Flag for review"}
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
