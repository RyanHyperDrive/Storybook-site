import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  ShieldAlert,
  ImageIcon,
  Gauge,
  Users,
  BookOpen,
  Activity,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  CreditCard,
  Eye,
} from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: Inner,
  head: () => ({ meta: [{ title: "Admin dashboard — StoryNest" }] }),
});

type Stats = {
  users: number;
  books: number;
  booksReady: number;
  booksDraft: number;
  booksFailed: number;
  jobsActive: number;
  jobsQueued: number;
  jobsDone: number;
  jobsError: number;
  pagesNeedReview: number;
  totalRetries: number;
  paymentsPaid: number;
  revenueCents: number;
  booksLast24h: number;
};

function Inner() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [books, setBooks] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function loadAll() {
    setRefreshing(true);
    const since24 = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [
      profilesC,
      booksAll,
      jobsAll,
      pagesReview,
      pagesRetries,
      paymentsPaid,
      booksRecent,
      jobsRecent,
      books24,
    ] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("books").select("status"),
      supabase.from("jobs").select("status"),
      supabase.from("book_pages").select("id", { count: "exact", head: true }).eq("needs_review", true),
      supabase.from("book_pages").select("regenerations"),
      supabase.from("payments").select("amount_cents,status").eq("status", "paid"),
      supabase.from("books").select("*").order("created_at", { ascending: false }).limit(15),
      supabase.from("jobs").select("*").order("created_at", { ascending: false }).limit(15),
      supabase.from("books").select("id", { count: "exact", head: true }).gte("created_at", since24),
    ]);

    const bookStatuses = (booksAll.data ?? []) as { status: string }[];
    const jobStatuses = (jobsAll.data ?? []) as { status: string }[];
    const retriesRows = (pagesRetries.data ?? []) as { regenerations: number }[];
    const payRows = (paymentsPaid.data ?? []) as { amount_cents: number }[];

    setStats({
      users: profilesC.count ?? 0,
      books: bookStatuses.length,
      booksReady: bookStatuses.filter((b) => b.status === "ready" || b.status === "complete" || b.status === "done").length,
      booksDraft: bookStatuses.filter((b) => b.status === "draft").length,
      booksFailed: bookStatuses.filter((b) => b.status === "error" || b.status === "failed").length,
      jobsActive: jobStatuses.filter((j) => j.status === "running" || j.status === "in_progress").length,
      jobsQueued: jobStatuses.filter((j) => j.status === "queued" || j.status === "pending").length,
      jobsDone: jobStatuses.filter((j) => j.status === "done" || j.status === "complete").length,
      jobsError: jobStatuses.filter((j) => j.status === "error" || j.status === "failed").length,
      pagesNeedReview: pagesReview.count ?? 0,
      totalRetries: retriesRows.reduce((s, r) => s + (r.regenerations ?? 0), 0),
      paymentsPaid: payRows.length,
      revenueCents: payRows.reduce((s, r) => s + (r.amount_cents ?? 0), 0),
      booksLast24h: books24.count ?? 0,
    });
    setBooks(booksRecent.data ?? []);
    setJobs(jobsRecent.data ?? []);
    setRefreshing(false);
  }

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const admin = !!data?.find((r) => r.role === "admin");
      setIsAdmin(admin);
      if (admin) await loadAll();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (isAdmin === null)
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );

  if (!isAdmin)
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-3 font-display text-2xl font-semibold">Admins only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account doesn't have admin access.
        </p>
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Admin dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Operational overview of users, books, jobs, and revenue.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadAll}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-paper disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
          <Link
            to="/admin/quality"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-paper"
          >
            <Gauge className="h-4 w-4" /> Quality
          </Link>
          <Link
            to="/admin/samples"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-paper"
          >
            <ImageIcon className="h-4 w-4" /> Sample art
          </Link>
        </div>
      </div>

      {!stats ? (
        <div className="mt-8 grid place-items-center py-16">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <StatCard icon={Users} label="Users" value={stats.users} tone="default" />
            <StatCard
              icon={BookOpen}
              label="Books"
              value={stats.books}
              sub={`${stats.booksLast24h} new in 24h`}
              tone="default"
            />
            <StatCard
              icon={CheckCircle2}
              label="Ready"
              value={stats.booksReady}
              sub={`${stats.booksDraft} draft`}
              tone="sage"
            />
            <StatCard
              icon={AlertTriangle}
              label="Failed books"
              value={stats.booksFailed}
              tone={stats.booksFailed > 0 ? "destructive" : "default"}
            />
            <StatCard
              icon={Activity}
              label="Jobs active"
              value={stats.jobsActive}
              sub={`${stats.jobsQueued} queued`}
              tone={stats.jobsActive > 0 ? "ember" : "default"}
            />
            <StatCard
              icon={AlertTriangle}
              label="Jobs error"
              value={stats.jobsError}
              tone={stats.jobsError > 0 ? "destructive" : "default"}
            />
            <StatCard
              icon={Eye}
              label="Pages need review"
              value={stats.pagesNeedReview}
              sub={`${stats.totalRetries} total retries`}
              tone={stats.pagesNeedReview > 0 ? "ember" : "default"}
            />
            <StatCard
              icon={CreditCard}
              label="Revenue"
              value={`$${(stats.revenueCents / 100).toFixed(2)}`}
              sub={`${stats.paymentsPaid} paid orders`}
              tone="sage"
            />
          </section>

          <section className="mt-10">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Recent books</h2>
              <span className="text-xs text-muted-foreground">{books.length} shown</span>
            </div>
            <div className="mt-3 overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-paper text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3">Title</th>
                    <th className="p-3">Child</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Created</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {books.map((b) => (
                    <tr key={b.id} className="border-t border-border">
                      <td className="p-3">{b.title ?? "Untitled"}</td>
                      <td className="p-3">{b.child_name ?? "—"}</td>
                      <td className="p-3"><StatusBadge status={b.status} /></td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(b.created_at).toLocaleString()}
                      </td>
                      <td className="p-3 text-right">
                        <Link
                          to="/books/$bookId"
                          params={{ bookId: b.id }}
                          className="text-xs underline-offset-4 hover:underline"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {books.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No books yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-10">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Recent jobs</h2>
              <span className="text-xs text-muted-foreground">{jobs.length} shown</span>
            </div>
            <div className="mt-3 overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-paper text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3">Job</th>
                    <th className="p-3">Kind</th>
                    <th className="p-3">Step</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Progress</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.id} className="border-t border-border">
                      <td className="p-3 font-mono text-xs">{j.id.slice(0, 8)}</td>
                      <td className="p-3">{j.kind}</td>
                      <td className="p-3 text-muted-foreground">{j.current_step ?? "—"}</td>
                      <td className="p-3"><StatusBadge status={j.status} /></td>
                      <td className="p-3">{j.progress ?? 0}%</td>
                      <td className="p-3 text-right">
                        <Link
                          to="/jobs/$jobId"
                          params={{ jobId: j.id }}
                          className="text-xs underline-offset-4 hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {jobs.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No jobs yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon: any;
  label: string;
  value: number | string;
  sub?: string;
  tone?: "default" | "sage" | "ember" | "destructive";
}) {
  const toneCls =
    tone === "sage"
      ? "border-sage/30 bg-sage/5"
      : tone === "ember"
        ? "border-ember/30 bg-ember/5"
        : tone === "destructive"
          ? "border-destructive/30 bg-destructive/5"
          : "border-border bg-background";
  const iconCls =
    tone === "sage"
      ? "text-sage"
      : tone === "ember"
        ? "text-ember"
        : tone === "destructive"
          ? "text-destructive"
          : "text-muted-foreground";
  return (
    <div className={`rounded-lg border p-4 ${toneCls}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Icon className={`h-4 w-4 ${iconCls}`} />
      </div>
      <div className="mt-2 font-display text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = (status ?? "").toLowerCase();
  const tone =
    s === "ready" || s === "done" || s === "complete" || s === "paid"
      ? "sage"
      : s === "error" || s === "failed"
        ? "destructive"
        : s === "running" || s === "in_progress" || s === "queued" || s === "pending"
          ? "ember"
          : "muted";
  const cls =
    tone === "sage"
      ? "bg-sage/15 text-sage border-sage/30"
      : tone === "destructive"
        ? "bg-destructive/10 text-destructive border-destructive/30"
        : tone === "ember"
          ? "bg-ember/10 text-ember border-ember/30"
          : "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${cls}`}>
      {status ?? "—"}
    </span>
  );
}
