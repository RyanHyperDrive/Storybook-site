import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import s1 from "@/assets/sample-1.jpg";

export const Route = createFileRoute("/library")({
  component: () => <AuthGate><Inner /></AuthGate>,
  head: () => ({ meta: [{ title: "Library — StoryNest" }] }),
});

function Inner() {
  const { user } = useAuth();
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("books").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => { setBooks(data ?? []); setLoading(false); });
  }, [user]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Your library</h1>
          <p className="mt-1 text-sm text-muted-foreground">All the storybooks you've created.</p>
        </div>
        <Link to="/create"><Button variant="ember"><Plus className="h-4 w-4" /> New book</Button></Link>
      </div>

      {loading ? null : books.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-border bg-paper/40 p-12 text-center">
          <p className="text-sm text-muted-foreground">You haven't created a book yet.</p>
          <Link to="/create" className="mt-4 inline-block"><Button variant="ember">Start your first book</Button></Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((b) => (
            <Link to="/books/$bookId" params={{ bookId: b.id }} key={b.id}
              className="overflow-hidden rounded-lg border border-border bg-background transition-shadow hover:shadow-md">
              <div className="aspect-[4/5] overflow-hidden bg-muted">
                <img src={b.cover_url ?? s1} alt={b.title ?? "Book"} className="h-full w-full object-cover" />
              </div>
              <div className="p-4">
                <div className="text-sm font-semibold">{b.title ?? `${b.child_name ?? "Untitled"}'s story`}</div>
                <div className="text-xs text-muted-foreground capitalize">{b.status}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
