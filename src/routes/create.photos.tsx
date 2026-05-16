import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { WizardLayout } from "@/components/wizard-layout";
import { useAuth } from "@/hooks/use-auth";
import { ensureDraftBook, getDraftId, syncAnonymousDraftToDb } from "@/lib/draft";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  ImagePlus,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

const BUCKET = "raw-uploads";
const MAX_BYTES = 12 * 1024 * 1024; // ~12MB
type SlotKey = "primary" | "sibling" | "together";
type Status = "pending_quality_check" | "accepted" | "needs_replacement";

type ChildRow = { id: string; name: string; slot: string | null };
type PhotoRow = {
  id: string;
  storage_path: string;
  status: Status;
  slot: SlotKey | null;
  child_profile_id: string | null;
  signed?: string;
};

export const Route = createFileRoute("/create/photos")({
  component: () => (
    <AuthGate
      title="Sign in to upload your child's photo"
      message="We ask you to sign in here so your child's photo stays private to your account."
      bullets={[
        "Use a clear, well-lit photo with only the child in frame.",
        "One child per photo (we'll ask for both if you're creating for twins).",
        "Originals stay private in your account and are never used to train models.",
      ]}
    >
      <Inner />
    </AuthGate>
  ),
  head: () => ({ meta: [{ title: "Photo — Create — StoryNest" }] }),
});

function Inner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bookId, setBookId] = useState<string | null>(getDraftId());
  const [syncing, setSyncing] = useState(true);

  const [children, setChildren] = useState<ChildRow[]>([]);
  const [isTwins, setIsTwins] = useState(false);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [busySlot, setBusySlot] = useState<SlotKey | null>(null);

  // After sign-in: make sure we have a draft book, then sync any
  // anonymously-entered profile/story/style from localStorage into the database.
  useEffect(() => {
    if (!user) return;
    (async () => {
      setSyncing(true);
      try {
        const book = await ensureDraftBook(user.id);
        await syncAnonymousDraftToDb(user.id, book.id);
        setBookId(book.id);
      } catch (e: any) {
        toast.error(e.message ?? "Couldn't open your draft");
      } finally {
        setSyncing(false);
      }
    })();
  }, [user?.id]);

  async function refresh() {
    if (!bookId || !user) return;
    const [{ data: book }, { data: kids }, { data: rows }] = await Promise.all([
      supabase.from("books").select("is_twins").eq("id", bookId).maybeSingle(),
      supabase.from("child_profiles").select("id,name,slot").eq("book_id", bookId).order("slot"),
      supabase.from("uploaded_photos").select("*").eq("book_id", bookId).order("created_at"),
    ]);
    setIsTwins(!!book?.is_twins);
    setChildren((kids ?? []) as ChildRow[]);

    const withUrls: PhotoRow[] = await Promise.all(
      (rows ?? []).map(async (p: any) => {
        const { data: s } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(p.storage_path, 600);
        return {
          id: p.id,
          storage_path: p.storage_path,
          status: (p.status ?? "pending_quality_check") as Status,
          slot: (p.slot ?? null) as SlotKey | null,
          child_profile_id: p.child_profile_id ?? null,
          signed: s?.signedUrl,
        };
      }),
    );
    setPhotos(withUrls);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line
  }, [bookId, user?.id]);

  const slots = useMemo<SlotKey[]>(
    () => (isTwins ? ["primary", "sibling", "together"] : ["primary"]),
    [isTwins],
  );

  function childForSlot(slot: SlotKey) {
    if (slot === "together") return null;
    return children.find((c) => c.slot === slot) ?? null;
  }

  function photoForSlot(slot: SlotKey) {
    return photos.find((p) => p.slot === slot) ?? null;
  }

  async function uploadForSlot(slot: SlotKey, file: File) {
    if (!user || !bookId) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file (JPG or PNG).");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Photo is too large. Please use a file under 12MB.");
      return;
    }
    setBusySlot(slot);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/${bookId}/${slot}-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;

      // Replace existing photo for this slot.
      const existing = photoForSlot(slot);
      if (existing) {
        await supabase.storage.from(BUCKET).remove([existing.storage_path]);
        await supabase.from("uploaded_photos").delete().eq("id", existing.id);
      }

      const child = childForSlot(slot);
      const { error: dbErr } = await supabase.from("uploaded_photos").insert({
        user_id: user.id,
        book_id: bookId,
        child_profile_id: child?.id ?? null,
        slot,
        storage_bucket: BUCKET,
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
        status: "pending_quality_check" as Status,
      });
      if (dbErr) throw dbErr;
      await refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setBusySlot(null);
    }
  }

  async function setStatus(photo: PhotoRow, status: Status) {
    const { error } = await supabase
      .from("uploaded_photos")
      .update({ status })
      .eq("id", photo.id);
    if (error) return toast.error(error.message);
    refresh();
  }

  async function remove(photo: PhotoRow) {
    await supabase.storage.from(BUCKET).remove([photo.storage_path]);
    await supabase.from("uploaded_photos").delete().eq("id", photo.id);
    refresh();
  }

  async function ensureChildSubjects() {
    if (!user) return;
    // Create a child_subjects row for every child_profile that doesn't have one yet.
    const { data: existing } = await supabase
      .from("child_subjects")
      .select("child_profile_id")
      .in("child_profile_id", children.map((c) => c.id));
    const have = new Set((existing ?? []).map((r: any) => r.child_profile_id));
    const missing = children.filter((c) => !have.has(c.id));
    if (missing.length === 0) return;
    await supabase.from("child_subjects").insert(
      missing.map((c) => {
        const photo = photos.find((p) => p.child_profile_id === c.id);
        return {
          user_id: user.id,
          child_profile_id: c.id,
          reference_storage_path: photo?.storage_path ?? null,
        };
      }),
    );
  }

  async function onContinue() {
    // Require at least the primary photo. Twins additionally require the sibling slot.
    const required: SlotKey[] = isTwins ? ["primary", "sibling"] : ["primary"];
    for (const slot of required) {
      if (!photoForSlot(slot)) {
        toast.error(
          slot === "primary"
            ? "Add a photo for the main child to continue."
            : "Add a photo for the second child to continue.",
        );
        return;
      }
    }
    navigate({ to: "/create/profile" });
  }

  async function toggleTwins(v: boolean) {
    if (!bookId) return;
    setIsTwins(v);
    await supabase.from("books").update({ is_twins: v }).eq("id", bookId);
  }

  if (syncing) {
    return (
      <WizardLayout>
        <div className="grid min-h-[30vh] place-items-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </WizardLayout>
    );
  }

  if (!bookId) {
    return (
      <WizardLayout>
        <EmptyDraft />
      </WizardLayout>
    );
  }

  return (
    <WizardLayout>
      <h1 className="font-display text-3xl font-semibold">Sign in to upload your child's photo</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We ask you to sign in here so your child's photo stays private to your account. We use it
        only to design the illustrated character — originals are never used to train models.
      </p>

      <PhotoGuidance />

      <div className="mt-6 space-y-4">
        {slots.map((slot) => (
          <SlotCard
            key={slot}
            slot={slot}
            child={childForSlot(slot)}
            isTwins={isTwins}
            photo={photoForSlot(slot)}
            uploading={busySlot === slot}
            onPick={(file) => uploadForSlot(slot, file)}
            onAccept={(p) => setStatus(p, "accepted")}
            onNeedsReplacement={(p) => setStatus(p, "needs_replacement")}
            onRemove={remove}
          />
        ))}
      </div>

      <p className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage" />
        Photos are stored in your private folder. Only you (and our generation service on your
        behalf) can read them.
      </p>

      <div className="mt-10 flex items-center justify-between">
        <Link to="/create/style">
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
        <Button variant="ember" onClick={onContinue}>
          Approve their illustrated character <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </WizardLayout>
  );
}

function PhotoGuidance() {
  const dos = [
    "Clear, well-lit photo of the face",
    "Simple, uncluttered background",
    "One child per photo (unless creating twins)",
    "Mostly front-facing, eyes visible",
  ];
  const donts = [
    "Sunglasses, masks, or heavy filters",
    "Blurry or low-resolution photos",
    "Group photos with other people",
    "School uniforms with visible school names or logos",
  ];
  return (
    <>
    <div className="mt-6 grid gap-3 rounded-lg border border-border bg-paper/40 p-4 sm:grid-cols-2">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Camera className="h-4 w-4 text-ember" /> What works best
        </div>
        <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          {dos.map((d) => (
            <li key={d} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage" />
              {d}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="h-4 w-4 text-ember" /> Please avoid
        </div>
        <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          {donts.map((d) => (
            <li key={d} className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              {d}
            </li>
          ))}
        </ul>
      </div>
    </div>
    <p className="mt-3 text-xs text-muted-foreground">
      You can add optional details (glasses, wheelchair, hearing aids, birthmarks, hairstyle,
      clothing preferences, etc.) in the next step so the illustrated character feels right.
    </p>
    </>
  );
}

function SlotCard({
  slot,
  child,
  isTwins,
  photo,
  uploading,
  onPick,
  onAccept,
  onNeedsReplacement,
  onRemove,
}: {
  slot: SlotKey;
  child: ChildRow | null;
  isTwins: boolean;
  photo: PhotoRow | null;
  uploading: boolean;
  onPick: (file: File) => void;
  onAccept: (p: PhotoRow) => void;
  onNeedsReplacement: (p: PhotoRow) => void;
  onRemove: (p: PhotoRow) => void;
}) {
  const label =
    slot === "together"
      ? "Both together (optional)"
      : isTwins
        ? slot === "primary"
          ? `Child 1${child?.name ? ` — ${child.name}` : ""}`
          : `Child 2${child?.name ? ` — ${child.name}` : ""}`
        : child?.name
          ? `${child.name}'s photo`
          : "Your child's photo";

  const helper =
    slot === "together"
      ? "A photo of both children together helps with shared scenes. Skip if you don't have one."
      : "One face, mostly front-facing, no sunglasses.";

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{label}</div>
          <p className="mt-0.5 text-xs text-muted-foreground">{helper}</p>
        </div>
        {photo && <StatusBadge status={photo.status} />}
      </div>

      <div className="mt-3 grid grid-cols-[120px_1fr] gap-4">
        <div className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
          {photo?.signed ? (
            <img src={photo.signed} alt={label} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-muted-foreground">
              <ImagePlus className="h-5 w-5" />
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 grid place-items-center bg-background/70">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-border bg-paper/60 px-3 py-1.5 text-sm hover:border-ember hover:bg-ember/5">
            <ImagePlus className="h-4 w-4" />
            {photo ? "Replace photo" : "Upload photo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPick(f);
                e.currentTarget.value = "";
              }}
            />
          </label>

          {photo && (
            <div className="flex flex-wrap items-center gap-2">
              {photo.status !== "accepted" && (
                <Button size="sm" variant="outline" onClick={() => onAccept(photo)}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Mark as good
                </Button>
              )}
              {photo.status !== "needs_replacement" && (
                <Button size="sm" variant="ghost" onClick={() => onNeedsReplacement(photo)}>
                  <RefreshCcw className="h-3.5 w-3.5" /> Needs replacement
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onRemove(photo)}
                aria-label="Remove photo"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; className: string; icon: React.ReactNode }> = {
    pending_quality_check: {
      label: "Pending quality check",
      className: "border-border bg-muted text-foreground",
      icon: <Loader2 className="h-3 w-3" />,
    },
    accepted: {
      label: "Accepted",
      className: "border-sage/40 bg-sage/10 text-sage",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    needs_replacement: {
      label: "Needs replacement",
      className: "border-amber-500/40 bg-amber-500/10 text-amber-700",
      icon: <AlertTriangle className="h-3 w-3" />,
    },
  };
  const m = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${m.className}`}
    >
      {m.icon}
      {m.label}
    </span>
  );
}

function EmptyDraft() {
  return (
    <div className="rounded-md border border-border bg-paper/40 p-6 text-center">
      <p className="text-sm">
        No active draft.{" "}
        <Link to="/create/profile" className="font-medium text-ember underline">
          Start over
        </Link>
        .
      </p>
    </div>
  );
}
