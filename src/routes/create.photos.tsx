import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { WizardLayout } from "@/components/wizard-layout";
import { useAuth } from "@/hooks/use-auth";
import { getDraftId } from "@/lib/draft";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/create/photos")({
  component: () => <AuthGate><Inner /></AuthGate>,
  head: () => ({ meta: [{ title: "Photos — Create — StoryNest" }] }),
});

type Photo = { id: string; storage_path: string; signed?: string };

function Inner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const bookId = getDraftId();

  async function refresh() {
    if (!bookId) return;
    const { data } = await supabase.from("photos").select("*").eq("book_id", bookId).order("created_at");
    if (!data) return;
    const withUrls: Photo[] = await Promise.all(data.map(async (p) => {
      const { data: s } = await supabase.storage.from("storynest").createSignedUrl(p.storage_path, 600);
      return { id: p.id, storage_path: p.storage_path, signed: s?.signedUrl };
    }));
    setPhotos(withUrls);
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [bookId]);

  async function onUpload(files: FileList | null) {
    if (!files || !user || !bookId) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const ext = f.name.split(".").pop() ?? "jpg";
        const path = `${user.id}/${bookId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("storynest").upload(path, f, { upsert: false });
        if (upErr) throw upErr;
        const { error: dbErr } = await supabase.from("photos").insert({ book_id: bookId, user_id: user.id, storage_path: path });
        if (dbErr) throw dbErr;
      }
      await refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setUploading(false); }
  }

  async function remove(p: Photo) {
    await supabase.storage.from("storynest").remove([p.storage_path]);
    await supabase.from("photos").delete().eq("id", p.id);
    refresh();
  }

  if (!bookId) return <WizardLayout><EmptyDraft /></WizardLayout>;

  return (
    <WizardLayout>
      <h1 className="font-display text-3xl font-semibold">Add a clear photo</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        One well-lit, front-facing photo works best. We'll use it only to design the illustrated character.
      </p>

      <label className="mt-6 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-paper/40 p-10 text-center transition-colors hover:border-ember hover:bg-ember/5">
        <ImagePlus className="h-6 w-6 text-muted-foreground" />
        <span className="text-sm font-medium">{uploading ? "Uploading…" : "Click to upload — or drop a file"}</span>
        <span className="text-xs text-muted-foreground">JPG or PNG, up to ~10MB</span>
        <input type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => onUpload(e.target.files)} />
      </label>

      {photos.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {photos.map((p) => (
            <div key={p.id} className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
              {p.signed && <img src={p.signed} alt="upload" className="h-full w-full object-cover" />}
              <button onClick={() => remove(p)} aria-label="Remove"
                className="absolute right-1 top-1 rounded-md bg-background/90 p-1 opacity-0 shadow group-hover:opacity-100">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-10 flex items-center justify-between">
        <Link to="/create/profile"><Button variant="ghost"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
        <Button variant="ember" disabled={photos.length === 0} onClick={() => navigate({ to: "/create/story" })}>
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </WizardLayout>
  );
}

function EmptyDraft() {
  return (
    <div className="rounded-md border border-border bg-paper/40 p-6 text-center">
      <p className="text-sm">No active draft. <Link to="/create/profile" className="font-medium text-ember underline">Start over</Link>.</p>
    </div>
  );
}
