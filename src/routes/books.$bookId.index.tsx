import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, Settings2 } from "lucide-react";
import s1 from "@/assets/sample-1.jpg";

export const Route = createFileRoute("/books/$bookId/")({
  component: () => <AuthGate><Inner /></AuthGate>,
});

function Inner() {
  const { bookId } = Route.useParams();
  const [book, setBook] = useState<any>(null);
  useEffect(() => {
    supabase.from("books").select("*").eq("id", bookId).maybeSingle().then(({ data }) => setBook(data));
  }, [bookId]);

  if (!book) return <div className="px-4 py-12 text-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="aspect-[4/5] bg-muted">
            <img src={book.cover_url ?? s1} alt={book.title ?? "Book cover"} className="h-full w-full object-cover" />
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Storybook</div>
          <h1 className="mt-1 font-display text-3xl font-semibold">{book.title ?? `${book.child_name ?? "Your child"}'s storybook`}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Starring {book.child_name ?? "your child"} · {book.page_count ?? 12} pages · {book.art_style ?? "Warm watercolor"}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="ember"><Download className="h-4 w-4" /> Download ebook</Button>
            <Link to="/books/$bookId/manage" params={{ bookId }}>
              <Button variant="outline"><Settings2 className="h-4 w-4" /> Manage</Button>
            </Link>
          </div>
          <div className="mt-8 rounded-md border border-border bg-paper/40 p-4 text-sm">
            <div className="font-semibold">Story prompt</div>
            <p className="mt-1 text-muted-foreground">{book.story_prompt ?? "—"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
