import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/books/$bookId/manage")({
  component: () => <AuthGate><Inner /></AuthGate>,
});

function Inner() {
  const { bookId } = Route.useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState<any>(null);

  useEffect(() => {
    supabase.from("books").select("*").eq("id", bookId).maybeSingle().then(({ data }) => setBook(data));
  }, [bookId]);

  async function save() {
    const { error } = await supabase.from("books").update({ title: book.title }).eq("id", bookId);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  }
  async function del() {
    if (!confirm("Delete this book? This can't be undone.")) return;
    await supabase.from("books").delete().eq("id", bookId);
    navigate({ to: "/library" });
  }

  if (!book) return <div className="px-4 py-12 text-center text-sm text-muted-foreground">Loading…</div>;
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Link to="/books/$bookId" params={{ bookId }} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to book</Link>
      <h1 className="mt-3 font-display text-3xl font-semibold">Manage book</h1>
      <div className="mt-6 space-y-4">
        <div>
          <Label>Title</Label>
          <Input value={book.title ?? ""} onChange={(e) => setBook({ ...book, title: e.target.value })} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button variant="ember" onClick={save}>Save changes</Button>
          <Button variant="outline" onClick={del}><Trash2 className="h-4 w-4" /> Delete</Button>
        </div>
      </div>
    </div>
  );
}
