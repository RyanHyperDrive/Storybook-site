import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldAlert, ImageIcon } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: () => <AuthGate><Inner /></AuthGate>,
  head: () => ({ meta: [{ title: "Admin — StoryNest" }] }),
});

function Inner() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [books, setBooks] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const admin = !!data?.find((r) => r.role === "admin");
      setIsAdmin(admin);
      if (admin) {
        const [bks, jbs] = await Promise.all([
          supabase.from("books").select("*").order("created_at", { ascending: false }).limit(50),
          supabase.from("jobs").select("*").order("created_at", { ascending: false }).limit(50),
        ]);
        setBooks(bks.data ?? []);
        setJobs(jbs.data ?? []);
      }
    })();
  }, [user]);

  if (isAdmin === null) return <div className="grid min-h-[40vh] place-items-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!isAdmin) return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground" />
      <h1 className="mt-3 font-display text-2xl font-semibold">Admins only</h1>
      <p className="mt-2 text-sm text-muted-foreground">Your account doesn't have admin access.</p>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">Admin</h1>
        <Link
          to="/admin/samples"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-paper"
        >
          <ImageIcon className="h-4 w-4" /> Sample art
        </Link>
      </div>

      <section className="mt-8">
        <h2 className="font-display text-xl font-semibold">Recent books ({books.length})</h2>
        <div className="mt-3 overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase text-muted-foreground">
              <tr><th className="p-3">Title</th><th className="p-3">Child</th><th className="p-3">Status</th><th className="p-3">Created</th></tr>
            </thead>
            <tbody>
              {books.map((b) => (
                <tr key={b.id} className="border-t border-border">
                  <td className="p-3">{b.title ?? "Untitled"}</td>
                  <td className="p-3">{b.child_name ?? "—"}</td>
                  <td className="p-3 capitalize">{b.status}</td>
                  <td className="p-3 text-muted-foreground">{new Date(b.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-semibold">Recent jobs ({jobs.length})</h2>
        <div className="mt-3 overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase text-muted-foreground">
              <tr><th className="p-3">Job</th><th className="p-3">Kind</th><th className="p-3">Status</th><th className="p-3">Progress</th></tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-t border-border">
                  <td className="p-3 font-mono text-xs">{j.id.slice(0, 8)}</td>
                  <td className="p-3">{j.kind}</td>
                  <td className="p-3 capitalize">{j.status}</td>
                  <td className="p-3">{j.progress}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
