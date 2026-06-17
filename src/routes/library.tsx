import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, BookOpen } from "lucide-react";

export const Route = createFileRoute("/library")({
  component: () => <AuthGate><Inner /></AuthGate>,
  head: () => ({ meta: [{ title: "Library — StoryNest" }] }),
});

type BookRow = {
  id: string;
  title: string | null;
  child_name: string | null;
  status: string | null;
  cover_url: string | null;
  created_at: string;
  art_style: string | null;
};

const PAGES_BUCKET = "generated-pages";
const SIGNED_URL_BUCKETS = [PAGES_BUCKET, "character-sheets", "pdfs", "storynest", "raw-uploads"];

async function resolveSignedUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const slash = value.indexOf("/");
  if (slash > 0) {
    const maybeBucket = value.slice(0, slash);
    const rest = value.slice(slash + 1);
    if (SIGNED_URL_BUCKETS.includes(maybeBucket)) {
      const { data } = await supabase.storage.from(maybeBucket).createSignedUrl(rest, 3600);
      if (data?.signedUrl) return data.signedUrl;
    }
  }
  for (const b of SIGNED_URL_BUCKETS) {
    const { data } = await supabase.storage.from(b).createSignedUrl(value, 3600);
    if (data?.signedUrl) return data.signedUrl;
  }
  return null;
}

type StatusFilter = "all" | "ready" | "draft" | "in_progress";
type SortKey = "newest" | "oldest" | "title";

function classifyStatus(s: string | null | undefined): "ready" | "draft" | "in_progress" {
  const v = (s ?? "").toLowerCase();
  if (v === "ready" || v === "complete" || v === "completed" || v === "done" || v === "published") return "ready";
  if (v === "draft" || v === "" || v === "new") return "draft";
  return "in_progress";
}

function statusLabel(s: string | null | undefined): string {
  switch (classifyStatus(s)) {
    case "ready": return "Ready to read";
    case "draft": return "Draft";
    case "in_progress": return "In progress";
  }
}

function Inner() {
  const { user } = useAuth();
  const [books, setBooks] = useState<BookRow[]>([]);
  const [covers, setCovers] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("books")
        .select("id, title, child_name, status, cover_url, created_at, art_style")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      const rows = (data ?? []) as BookRow[];
      setBooks(rows);
      setLoading(false);
      // Resolve covers in parallel
      const entries = await Promise.all(
        rows.map(async (b) => [b.id, await resolveSignedUrl(b.cover_url)] as const),
      );
      if (cancelled) return;
      setCovers(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [user]);

  const visible = useMemo(() => {
    let arr = books;
    if (statusFilter !== "all") arr = arr.filter((b) => classifyStatus(b.status) === statusFilter);
    arr = [...arr];
    if (sort === "newest") arr.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    else if (sort === "oldest") arr.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    else if (sort === "title") {
      arr.sort((a, b) => (a.title ?? a.child_name ?? "").localeCompare(b.title ?? b.child_name ?? ""));
    }
    return arr;
  }, [books, statusFilter, sort]);

  const filterChips: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "ready", label: "Ready" },
    { key: "draft", label: "Draft" },
    { key: "in_progress", label: "In progress" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-semibold sm:text-3xl">Your library</h1>
          <p className="mt-1 text-sm text-muted-foreground">All the storybooks you've created.</p>
        </div>
        <Link to="/create" className="shrink-0">
          <Button variant="ember" className="h-11"><Plus className="h-4 w-4" /> New book</Button>
        </Link>
      </header>

      {!loading && books.length > 0 && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {filterChips.map((c) => {
              const active = statusFilter === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setStatusFilter(c.key)}
                  className={`h-10 rounded-full border px-4 text-sm font-medium transition-colors ${
                    active
                      ? "border-ember bg-ember/10 text-ember"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="shrink-0">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="title">Title A–Z</option>
            </select>
          </label>
        </div>
      )}

      {loading ? (
        <div className="mt-10 text-sm text-muted-foreground">Loading your books…</div>
      ) : books.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-border bg-paper/40 p-12 text-center">
          <p className="text-sm text-muted-foreground">You haven't created a book yet.</p>
          <Link to="/create" className="mt-4 inline-block"><Button variant="ember">Start your first book</Button></Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-border bg-paper/40 p-12 text-center">
          <p className="text-sm text-muted-foreground">No books match this filter.</p>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-7 lg:grid-cols-3">
          {visible.map((b) => {
            const cover = covers[b.id] ?? null;
            const title = b.title ?? `${b.child_name ?? "Untitled"}'s story`;
            return (
              <li key={b.id}>
                <Link
                  to="/books/$bookId"
                  params={{ bookId: b.id }}
                  className="group block focus:outline-none"
                >
                  {/* Bookshelf-style cover with spine + shadow */}
                  <div className="relative">
                    {/* spine */}
                    <div className="pointer-events-none absolute inset-y-0 left-0 w-2 rounded-l-md bg-gradient-to-r from-black/30 via-black/10 to-transparent" />
                    {/* page edges */}
                    <div className="pointer-events-none absolute inset-y-1 right-0 w-1 rounded-r-sm bg-gradient-to-l from-black/15 to-transparent" />
                    <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-muted shadow-[0_10px_24px_-12px_rgba(0,0,0,0.45),0_2px_4px_rgba(0,0,0,0.08)] ring-1 ring-black/5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_18px_32px_-12px_rgba(0,0,0,0.5),0_3px_6px_rgba(0,0,0,0.1)]">
                      {cover ? (
                        <img
                          src={cover}
                          alt={title}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-paper to-muted text-muted-foreground">
                          <BookOpen className="h-10 w-10 opacity-60" />
                          <span className="px-4 text-center text-xs">Cover coming soon</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 pl-2">
                    <div className="line-clamp-2 text-base font-semibold leading-snug">{title}</div>
                    {b.child_name && (
                      <div className="mt-0.5 truncate text-sm text-muted-foreground">For {b.child_name}</div>
                    )}
                    <div className="mt-1 text-xs text-muted-foreground">{statusLabel(b.status)}</div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
