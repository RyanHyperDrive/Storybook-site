import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { WizardLayout } from "@/components/wizard-layout";
import { getDraftId } from "@/lib/draft";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Image as ImageIcon,
  Loader2,
  PencilLine,
  RefreshCcw,
  Sparkles,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { getArtStyle } from "@/lib/art-styles";
import { saveApprovedCharacter } from "@/lib/saved-characters";

const RAW_BUCKET = "raw-uploads";

type Subject = {
  id: string;
  child_profile_id: string | null;
  description: string | null;
  reference_storage_path: string | null;
  character_image_url: string | null;
  status: "pending" | "generating" | "ready" | "error";
  error_message: string | null;
  approved: boolean;
  regenerations: number;
};
type Child = {
  id: string;
  name: string;
  slot: string | null;
  age: number | null;
  pronouns: string | null;
  favorite_color: string | null;
  favorite_activities: string | null;
  loves: string | null;
  personality_traits: string | null;
  accessibility_details: string | null;
};

export const Route = createFileRoute("/create/character-sheet")({
  component: () => (
    <AuthGate>
      <Inner />
    </AuthGate>
  ),
  head: () => ({ meta: [{ title: "Character — Create — StoryNest" }] }),
});

function Inner() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const id = getDraftId();
  const [book, setBook] = useState<any>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [refUrls, setRefUrls] = useState<Record<string, string>>({});
  const [characterUrls, setCharacterUrls] = useState<Record<string, string>>({});
  const [busyChild, setBusyChild] = useState<string | null>(null);
  const [twinsConfirmed, setTwinsConfirmed] = useState(false);
  const [approving, setApproving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const style = getArtStyle(book?.art_style);
  const isTwins = !!book?.is_twins;

  useEffect(() => {
    if (!user || id) return;
    toast.info("Let's start with your child's photo.");
    navigate({ to: "/create/photos" });
  }, [id, navigate, user]);

  async function load() {
    if (!id) return;
    setLoadError(null);
    try {
      const [{ data: b }, { data: kids }, { data: subs }] = await Promise.all([
        supabase.from("books").select("*").eq("id", id).maybeSingle(),
        supabase.from("child_profiles").select("*").eq("book_id", id).order("slot"),
        supabase
          .from("child_subjects")
          .select("*")
          .in(
            "child_profile_id",
            (
              await supabase.from("child_profiles").select("id").eq("book_id", id)
            ).data?.map((r: any) => r.id) ?? [],
          ),
      ]);
      setBook(b);
      setChildren((kids ?? []) as Child[]);
      setSubjects((subs ?? []) as Subject[]);

      const urls: Record<string, string> = {};
      const charUrls: Record<string, string> = {};
      await Promise.all(
        (subs ?? []).map(async (s: any) => {
          if (s.reference_storage_path) {
            // Request a small, resized thumbnail instead of the full-resolution
            // original upload — originals can be many MB and take a long time
            // to download over the signed URL.
            const { data } = await supabase.storage
              .from(RAW_BUCKET)
              .createSignedUrl(s.reference_storage_path, 600, {
                transform: { width: 240, height: 240, resize: "cover", quality: 75 },
              });
            if (data?.signedUrl) urls[s.id] = data.signedUrl;
          }
          if (s.character_image_url) {
            if (/^https?:\/\//i.test(s.character_image_url)) {
              charUrls[s.id] = s.character_image_url;
            } else {
              const { data } = await supabase.storage
                .from("character-sheets")
                .createSignedUrl(s.character_image_url, 600);
              if (data?.signedUrl) charUrls[s.id] = data.signedUrl;
            }
          }
        }),
      );
      setRefUrls(urls);
      setCharacterUrls(charUrls);
    } catch (e: any) {
      setLoadError(e.message ?? "Failed to load character data.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const subjectByChild = useMemo(() => {
    const m: Record<string, Subject> = {};
    for (const s of subjects) if (s.child_profile_id) m[s.child_profile_id] = s;
    return m;
  }, [subjects]);

  async function ensureSubjectFor(child: Child): Promise<Subject | null> {
    if (!user) return null;
    const existing = subjectByChild[child.id];
    const { data: photo } = await supabase
      .from("uploaded_photos")
      .select("storage_path")
      .eq("child_profile_id", child.id)
      .maybeSingle();
    if (existing) {
      if (!existing.reference_storage_path && photo?.storage_path) {
        await supabase
          .from("child_subjects")
          .update({ reference_storage_path: photo.storage_path })
          .eq("id", existing.id);
        return { ...existing, reference_storage_path: photo.storage_path };
      }
      return existing;
    }
    const { data, error } = await supabase
      .from("child_subjects")
      .insert({
        user_id: user.id,
        child_profile_id: child.id,
        reference_storage_path: photo?.storage_path ?? null,
        status: "pending",
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return null;
    }
    return data as Subject;
  }

  async function generateFor(child: Child, instruction?: string) {
    if (!user) return;
    setBusyChild(child.id);
    try {
      const subject = await ensureSubjectFor(child);
      if (!subject) return;
      if (!subject.reference_storage_path) {
        toast.error("Upload a child photo before generating their character.");
        navigate({ to: "/create/photos" });
        return;
      }
      await load();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const trimmed = (instruction ?? "").trim();
      const body: Record<string, unknown> = { childSubjectId: subject.id };
      if (trimmed) body.instruction = trimmed;
      const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-character-sheet`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const payload = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(payload?.error ?? "Character generation failed");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Generation failed");
      await load();
    } finally {
      setBusyChild(null);
    }
  }

  async function approveAll() {
    if (!id || !user) return;
    const required = children;
    for (const c of required) {
      const s = subjectByChild[c.id];
      if (!s || s.status !== "ready" || !s.character_image_url) {
        toast.error(`Generate a character for ${c.name || "your child"} first.`);
        return;
      }
    }
    if (isTwins && !twinsConfirmed) {
      toast.error("Please confirm the twins are clearly distinguishable.");
      return;
    }
    setApproving(true);
    try {
      // Approve each per-child subject.
      await Promise.all(
        required.map((c) =>
          supabase
            .from("child_subjects")
            .update({
              approved: true,
              twins_distinguishable_confirmed: isTwins ? twinsConfirmed : false,
            })
            .eq("id", subjectByChild[c.id].id),
        ),
      );

      // Persist approved child(ren) into the parent's reusable library so they
      // can start another book starring the same character without redoing
      // photo + character-sheet steps.
      await Promise.all(
        required.map(async (c) => {
          const s = subjectByChild[c.id];
          if (!s?.character_image_url || !c.name) return;
          try {
            await saveApprovedCharacter({
              userId: user.id,
              bookId: id,
              subjectId: s.id,
              child: {
                name: c.name,
                age: c.age,
                pronouns: c.pronouns,
                loves: c.loves,
                favorite_color: c.favorite_color,
                favorite_activities: c.favorite_activities,
                personality_traits: c.personality_traits,
                accessibility_details: c.accessibility_details,
              },
              artStyle: book?.art_style ?? null,
              characterImagePath: s.character_image_url,
              referenceStoragePath: s.reference_storage_path ?? null,
              description: s.description ?? null,
            });
          } catch (err) {
            console.warn("Could not save reusable character", err);
          }
        }),
      );

      // Mirror approval onto the book-level character_sheets row for downstream jobs.
      const primary = subjectByChild[children[0]?.id];
      const { data: existingSheet } = await supabase
        .from("character_sheets")
        .select("id")
        .eq("book_id", id)
        .maybeSingle();
      if (existingSheet) {
        await supabase
          .from("character_sheets")
          .update({
            approved: true,
            image_url: primary?.character_image_url ?? null,
            description: primary?.description ?? null,
          })
          .eq("id", existingSheet.id);
      } else {
        await supabase.from("character_sheets").insert({
          book_id: id,
          user_id: user.id,
          approved: true,
          image_url: primary?.character_image_url ?? null,
          description: primary?.description ?? null,
        });
      }

      await supabase
        .from("books")
        .update({ status: "awaiting_payment" })
        .eq("id", id);

      // Build & persist the visual consistency contract from approved data.
      // This is the canonical reference used by every page + cover prompt and
      // every validator call. If it fails (network/transient), the start-book-
      // generation pipeline has a fallback that rebuilds it server-side, but
      // we surface the error here so the parent isn't kept in the dark.
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/build-contract`;
        const r = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ bookId: id }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          console.warn("build-contract failed", j);
          toast.warning(
            "We're still finishing your character — please try again in a moment.",
          );
        }
      } catch (err) {
        console.warn("build-contract network error", err);
      }

      toast.success("Character approved — let's finish your book");
      navigate({ to: "/checkout/$bookId", params: { bookId: id } });
    } catch (e: any) {
      toast.error(e.message ?? "Approval failed");
    } finally {
      setApproving(false);
    }
  }

  if (!id) {
    return (
      <WizardLayout>
        <div className="grid min-h-[20vh] place-items-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </WizardLayout>
    );
  }

  return (
    <WizardLayout>
      <h1 className="font-display text-3xl font-semibold">
        {isTwins ? "Approve their illustrated characters" : "Approve their illustrated character"}
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        The character{isTwins ? "s" : ""} you approve here become{isTwins ? "" : "s"} the visual
        reference used for every page of the storybook. Take a moment to make sure{" "}
        {isTwins ? "they look like your kids" : "it feels like them"} — free regeneration if it
        doesn't feel like them.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-paper/60 px-3 py-1">
          <Sparkles className="h-3.5 w-3.5 text-ember" />
          Style: <span className="font-semibold text-foreground">{style.name}</span>
          <Link to="/create/style" className="underline-offset-4 hover:underline">
            Change
          </Link>
        </span>
        <Link to="/create/profile" className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline">
          <PencilLine className="h-3.5 w-3.5" /> Edit child details
        </Link>
      </div>

      {loading ? (
        <LoadingSkeleton count={isTwins ? 2 : 1} />
      ) : loadError ? (
        <ErrorPanel message={loadError} onRetry={load} />
      ) : children.length === 0 ? (
        <EmptyChildren />
      ) : (
        <div className="mt-8 space-y-6">
          {isTwins && (
            <div className="rounded-md border border-ember/30 bg-ember/5 p-3 text-xs text-foreground">
              <strong className="font-semibold">Twin mode:</strong> generate Child 1's character
              first, then Child 2 — the second sheet uses the first as a style anchor so both twins
              are drawn in the exact same art style while staying clearly distinguishable. If you
              uploaded a "both together" photo, we feed it in so their relative size and look match
              real life.
            </div>
          )}
          <div className={isTwins ? "grid gap-6 md:grid-cols-2" : ""}>
            {children.map((child, i) => (
              <CharacterCard
                key={child.id}
                index={i}
                child={child}
                isTwins={isTwins}
                subject={subjectByChild[child.id] ?? null}
                refUrl={subjectByChild[child.id]?.id ? refUrls[subjectByChild[child.id]!.id] : undefined}
                characterUrl={subjectByChild[child.id]?.id ? characterUrls[subjectByChild[child.id]!.id] : undefined}
                busy={busyChild === child.id}
                onGenerate={(instruction) => generateFor(child, instruction)}
              />
            ))}
          </div>

          {isTwins && (
            <label className="flex items-start gap-3 rounded-md border border-border bg-paper/40 p-4 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={twinsConfirmed}
                onChange={(e) => setTwinsConfirmed(e.target.checked)}
              />
              <span>
                I confirm the two characters are clearly distinguishable from each other (hair,
                clothing, or other features) so each child is recognizable throughout the story.
              </span>
            </label>
          )}

          <div className="rounded-md border border-border bg-background p-4 text-xs text-muted-foreground">
            Once approved, this {isTwins ? "pair becomes" : "character becomes"} the visual
            reference for every page of the storybook. You can still regenerate before approving.
          </div>

          <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link to="/create/style">
              <Button variant="ghost">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            </Link>
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <Button
                variant="ember"
                onClick={approveAll}
                disabled={approving || busyChild !== null}
              >
                {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Approve & continue
              </Button>
              <p className="text-xs text-muted-foreground">
                Approve the character, then pay. Free regeneration if it doesn't feel like them.
              </p>
            </div>
          </div>
        </div>
      )}
    </WizardLayout>
  );
}

function CharacterCard({
  index,
  child,
  isTwins,
  subject,
  refUrl,
  characterUrl,
  busy,
  onGenerate,
}: {
  index: number;
  child: Child;
  isTwins: boolean;
  subject: Subject | null;
  refUrl: string | undefined;
  characterUrl: string | undefined;
  busy: boolean;
  onGenerate: (instruction?: string) => void | Promise<void>;
}) {
  const [instruction, setInstruction] = useState("");
  const label = isTwins
    ? `Child ${index + 1}${child.name ? ` — ${child.name}` : ""}`
    : child.name || "Your child";

  const status = subject?.status ?? "pending";

  const hasCharacter = !!subject?.character_image_url;
  const primaryLabel = hasCharacter
    ? "Regenerate character"
    : status === "generating" || busy
      ? "Generating…"
      : "Generate character";

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{label}</div>
          <ChildSummary child={child} />
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Primary CTA — promoted to the top so parents know exactly what to
          tap, especially on mobile where the old button sat below the fold. */}
      {!hasCharacter && (
        <div className="mt-3 rounded-md border border-ember/30 bg-ember/5 p-3">
          <p className="text-xs font-medium text-foreground">
            Tap below to illustrate {child.name || "your child"} in the chosen art style.
          </p>
          <Button
            variant="ember"
            size="lg"
            onClick={() => onGenerate()}
            disabled={busy || status === "generating"}
            className="mt-2 w-full text-base shadow-sm"
          >
            {busy || status === "generating" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {primaryLabel}
          </Button>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Takes about 30–60 seconds. Free regeneration if it doesn't feel like them.
          </p>
        </div>
      )}


      <div className="mt-4 grid grid-cols-[88px_1fr] gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Reference</div>
          <div className="mt-1 aspect-square overflow-hidden rounded-md border border-border bg-muted">
            {refUrl ? (
              <img src={refUrl} alt={`${label} reference`} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-muted-foreground">
                <ImageIcon className="h-4 w-4" />
              </div>
            )}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Character</div>
          <div className="relative mt-1 aspect-[4/5] overflow-hidden rounded-md border border-border bg-muted">
            {status === "ready" && characterUrl ? (
              <img
                src={characterUrl}
                alt={`${label} character`}
                className="h-full w-full object-cover"
              />
            ) : status === "generating" || busy ? (
              <div className="grid h-full place-items-center text-center text-xs text-muted-foreground">
                <div>
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  <div className="mt-2">Illustrating {child.name || "character"}…</div>
                  <div className="mt-0.5 text-[10px]">This usually takes 30–60 seconds.</div>
                </div>
              </div>
            ) : status === "error" ? (
              <div className="grid h-full place-items-center px-3 text-center text-xs text-destructive">
                <div>
                  <AlertTriangle className="mx-auto h-5 w-5" />
                  <div className="mt-2">{subject?.error_message || "Generation failed."}</div>
                </div>
              </div>
            ) : (
              <div className="grid h-full place-items-center px-3 text-center text-xs text-muted-foreground">
                <div>
                  <Sparkles className="mx-auto h-5 w-5" />
                  <div className="mt-2">No character yet — generate to preview.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {subject?.description && status === "ready" && (
        <p className="mt-3 rounded-md bg-paper/40 p-3 text-xs text-muted-foreground">
          {subject.description}
        </p>
      )}

      {hasCharacter && (
        <div className="mt-4 rounded-md border border-ember/30 bg-ember/5 p-3">
          <label className="text-xs font-medium text-foreground">
            Want to change something? (optional)
          </label>
          <Input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g. make his hair a lighter brown, add small glasses, bigger smile"
            className="mt-2 bg-background"
            disabled={busy}
          />
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Type a small change in plain English. We'll redraw just that and keep everything else the same.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="ember"
              onClick={async () => {
                const text = instruction.trim();
                if (!text) return;
                await onGenerate(text);
                setInstruction("");
              }}
              disabled={busy || !instruction.trim()}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              Regenerate with changes
            </Button>
            <Button size="sm" variant="outline" onClick={() => onGenerate()} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
              Regenerate
            </Button>
            <Link to="/create/profile">
              <Button size="sm" variant="ghost">
                <PencilLine className="h-3.5 w-3.5" /> Edit details
              </Button>
            </Link>
            {(subject?.regenerations ?? 0) > 0 && (
              <span className="text-[11px] text-muted-foreground">
                Regenerations: {subject!.regenerations} (free)
              </span>
            )}
          </div>
        </div>
      )}
      {!hasCharacter && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link to="/create/profile">
            <Button size="sm" variant="ghost">
              <PencilLine className="h-3.5 w-3.5" /> Edit details
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

function ChildSummary({ child }: { child: Child }) {
  const bits = [
    child.age ? `${child.age} yrs` : null,
    child.pronouns,
    child.favorite_color ? `loves ${child.favorite_color}` : null,
    child.personality_traits,
  ].filter(Boolean);
  if (bits.length === 0) return null;
  return <p className="mt-0.5 text-xs text-muted-foreground">{bits.join(" · ")}</p>;
}

function StatusBadge({ status }: { status: Subject["status"] }) {
  const map: Record<Subject["status"], { label: string; className: string; icon: React.ReactNode }> = {
    pending: {
      label: "Not generated",
      className: "border-border bg-muted text-foreground",
      icon: <Sparkles className="h-3 w-3" />,
    },
    generating: {
      label: "Generating",
      className: "border-border bg-paper/60 text-foreground",
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
    },
    ready: {
      label: "Ready to review",
      className: "border-sage/40 bg-sage/10 text-sage",
      icon: <Check className="h-3 w-3" />,
    },
    error: {
      label: "Error",
      className: "border-destructive/40 bg-destructive/10 text-destructive",
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

function LoadingSkeleton({ count }: { count: number }) {
  return (
    <div className={`mt-8 ${count > 1 ? "grid gap-6 md:grid-cols-2" : ""}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg border border-border bg-background p-4">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="mt-4 grid grid-cols-[88px_1fr] gap-4">
            <div className="aspect-square rounded-md bg-muted" />
            <div className="aspect-[4/5] rounded-md bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mt-8 rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm">
      <div className="flex items-center gap-2 font-semibold text-destructive">
        <AlertTriangle className="h-4 w-4" /> Couldn't load character data
      </div>
      <p className="mt-2 text-muted-foreground">{message}</p>
      <Button className="mt-4" size="sm" variant="outline" onClick={onRetry}>
        <RefreshCcw className="h-3.5 w-3.5" /> Try again
      </Button>
    </div>
  );
}

function EmptyChildren() {
  return (
    <div className="mt-8 rounded-lg border border-border bg-paper/40 p-6 text-center text-sm">
      <p>
        We don't have a child profile yet for this draft.{" "}
        <Link to="/create/profile" className="font-medium text-ember underline">
          Add child details
        </Link>{" "}
        to continue.
      </p>
    </div>
  );
}

function EmptyDraft() {
  return (
    <div className="rounded-md border border-border bg-paper/40 p-6 text-center text-sm">
      We need your child's photo before we can make their illustrated character.{" "}
      <Link to="/create/photos" className="font-medium text-ember underline">
        Upload a photo
      </Link>
      .
    </div>
  );
}
