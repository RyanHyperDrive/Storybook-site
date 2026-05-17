import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  Download,
  Heart,
  Loader2,
  Mail,
  Pencil,
  Printer,
  RefreshCcw,
  Save,
  Settings2,
  Sparkles,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import s1 from "@/assets/sample-1.jpg";
import { getArtStyle } from "@/lib/art-styles";

type BookPage = {
  id: string;
  page_number: number;
  text_content: string | null;
  image_storage_path: string | null;
  status: string;
};

type SpreadKind = "cover" | "dedication" | "story" | "ending";
type Spread = {
  key: string;
  kind: SpreadKind;
  label: string;
  pageNumberLabel: string | null;
  text: string | null;
  imageUrl: string | null;
  storyPage?: BookPage;
};

const PAGES_BUCKET = "generated-pages";
const COVER_BUCKET_HINT = "raw-uploads"; // covers may live in any bucket; we resolve via helper

export const Route = createFileRoute("/books/$bookId/")({
  component: () => (
    <AuthGate>
      <Inner />
    </AuthGate>
  ),
  head: () => ({ meta: [{ title: "Read your book — StoryNest" }] }),
});

function Inner() {
  const { bookId } = Route.useParams();
  const [book, setBook] = useState<any>(null);
  const [pages, setPages] = useState<BookPage[]>([]);
  const [imgUrls, setImgUrls] = useState<Record<string, string>>({});
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [regenBusyKey, setRegenBusyKey] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [{ data: b, error: be }, { data: ps, error: pe }] = await Promise.all([
        supabase.from("books").select("*").eq("id", bookId).maybeSingle(),
        supabase
          .from("book_pages")
          .select("*")
          .eq("book_id", bookId)
          .order("page_number", { ascending: true }),
      ]);
      if (be) throw be;
      if (pe) throw pe;
      setBook(b);
      const storyPages = (ps ?? []) as BookPage[];
      setPages(storyPages);

      // Resolve signed URLs for any private images.
      const map: Record<string, string> = {};
      await Promise.all(
        storyPages.map(async (p) => {
          if (!p.image_storage_path) return;
          const url = await resolveSignedUrl(p.image_storage_path);
          if (url) map[p.id] = url;
        }),
      );
      setImgUrls(map);

      if (b?.cover_url) {
        const cu = await resolveSignedUrl(b.cover_url);
        setCoverUrl(cu ?? b.cover_url ?? null);
      } else {
        setCoverUrl(null);
      }
    } catch (e: any) {
      setError(e.message ?? "Failed to load book.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  // Build the reader spreads: cover → dedication → story pages → ending.
  const spreads = useMemo<Spread[]>(() => {
    if (!book) return [];
    const storyPages = pages.slice(0, 10);
    const list: Spread[] = [];
    list.push({
      key: "cover",
      kind: "cover",
      label: "Cover",
      pageNumberLabel: null,
      text: book.title ?? `${book.child_name ?? "Your child"}'s storybook`,
      imageUrl: coverUrl ?? null,
    });
    list.push({
      key: "dedication",
      kind: "dedication",
      label: "Dedication",
      pageNumberLabel: null,
      text:
        book.dedication?.trim() ||
        `For ${book.child_name ?? "you"} — may every page feel like home.`,
      imageUrl: null,
    });
    storyPages.forEach((p, i) => {
      list.push({
        key: `page-${p.id}`,
        kind: "story",
        label: `Page ${i + 1}`,
        pageNumberLabel: `${i + 1}`,
        text: p.text_content,
        imageUrl: imgUrls[p.id] ?? null,
        storyPage: p,
      });
    });
    list.push({
      key: "ending",
      kind: "ending",
      label: "The End",
      pageNumberLabel: null,
      text: `The end. With love, for ${book.child_name ?? "you"}.`,
      imageUrl: null,
    });
    return list;
  }, [book, pages, imgUrls, coverUrl]);

  // Clamp index when spreads change.
  useEffect(() => {
    if (idx >= spreads.length && spreads.length > 0) setIdx(spreads.length - 1);
  }, [spreads.length, idx]);

  // Keyboard navigation.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") setIdx((i) => Math.min(spreads.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [spreads.length]);

  async function downloadPdf() {
    if (!book) return;
    if (book.ebook_url) {
      const url = await resolveSignedUrl(book.ebook_url);
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
    }
    toast.message("PDF not ready yet", {
      description: "Your downloadable PDF will appear here once assembly finishes.",
    });
  }

  const [editorOpen, setEditorOpen] = useState(false);
  const [storyEditorOpen, setStoryEditorOpen] = useState(false);
  const [coverEditorOpen, setCoverEditorOpen] = useState(false);

  async function saveTextInline(pageId: string, newText: string) {
    const { error } = await supabase
      .from("book_pages")
      .update({ text_content: newText })
      .eq("id", pageId);
    if (error) {
      toast.error(error.message);
      return false;
    }
    if (book?.story_json?.pages) {
      const pn = pages.find((p) => p.id === pageId)?.page_number;
      if (pn != null) {
        const next = {
          ...book.story_json,
          pages: book.story_json.pages.map((p: any) =>
            Number(p.page_number) === Number(pn) ? { ...p, page_text: newText } : p,
          ),
        };
        await supabase.from("books").update({ story_json: next }).eq("id", bookId);
      }
    }
    toast.success("Saved");
    await load();
    return true;
  }

  async function regenImage(opts: { pageId: string; feedback?: string; sceneOverride?: string; textOverride?: string }) {
    setRegenBusyKey(opts.pageId);
    try {
      const { data, error } = await supabase.functions.invoke("regenerate-page", { body: opts });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Page regenerated");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Could not regenerate page");
    } finally {
      setRegenBusyKey(null);
    }
  }

  async function regenCover(opts: { feedback?: string; sceneOverride?: string }) {
    setRegenBusyKey("cover");
    try {
      const { data, error } = await supabase.functions.invoke("regenerate-cover", {
        body: { bookId, ...opts },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Cover regenerated");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Could not regenerate cover");
    } finally {
      setRegenBusyKey(null);
    }
  }

  async function regenStory(opts: { themeOverride?: string; feedback?: string }) {
    setRegenBusyKey("story");
    try {
      const { data, error } = await supabase.functions.invoke("regenerate-story", {
        body: { bookId, ...opts },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Story rewritten — regenerate any page image you want refreshed.");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Could not rewrite story");
    } finally {
      setRegenBusyKey(null);
    }
  }

  if (loading) return <ReaderSkeleton />;
  if (error)
    return (
      <ReaderError
        title="We couldn't load this book"
        message={error}
      />
    );
  if (!book)
    return (
      <ReaderError
        title="Book not found"
        message="This book doesn't exist or you don't have access to it."
      />
    );

  const cur = spreads[idx];
  const style = getArtStyle(book.art_style);
  const isReady = book.status === "ready";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/library">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="h-4 w-4" /> Library
            </Button>
          </Link>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {style.name}
            </div>
            <h1 className="font-display text-xl font-semibold leading-tight">
              {book.title ?? `${book.child_name ?? "Your child"}'s storybook`}
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStoryEditorOpen(true)}
            disabled={regenBusyKey === "story"}
          >
            {regenBusyKey === "story"
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Wand2 className="h-4 w-4" />}
            Rewrite story
          </Button>
          <Button variant="outline" size="sm" onClick={downloadPdf}>
            <Download className="h-4 w-4" /> Download PDF
          </Button>
          <Link to="/books/$bookId/manage" params={{ bookId }}>
            <Button variant="ghost" size="sm">
              <Settings2 className="h-4 w-4" /> Manage
            </Button>
          </Link>
        </div>
      </div>

      {!isReady && (
        <div className="mt-6 rounded-md border border-border bg-paper/40 p-3 text-xs text-muted-foreground">
          This book is still being assembled. You can preview pages as they finish.
        </div>
      )}

      {/* Reader */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
        <div className="grid md:grid-cols-2">
          <IllustrationPane spread={cur} fallback={s1} />
          <TextPane
            spread={cur}
            childName={book.child_name}
            onSaveText={
              cur.kind === "story" && cur.storyPage
                ? (t) => saveTextInline(cur.storyPage!.id, t)
                : undefined
            }
          />
        </div>
        <ReaderControls
          idx={idx}
          total={spreads.length}
          spread={cur}
          onPrev={() => setIdx((i) => Math.max(0, i - 1))}
          onNext={() => setIdx((i) => Math.min(spreads.length - 1, i + 1))}
          onOpenImageEditor={cur.kind === "story" ? () => setEditorOpen(true) : undefined}
          onOpenCoverEditor={cur.kind === "cover" ? () => setCoverEditorOpen(true) : undefined}
          regenBusy={regenBusyKey === cur.key || (cur.kind === "cover" && regenBusyKey === "cover")}
        />
      </div>

      {/* Page strip */}
      <PageStrip spreads={spreads} idx={idx} onJump={setIdx} />

      {/* Print actions */}
      <PrintActions bookId={bookId} childName={book.child_name} />

      {/* Editors */}
      {cur.kind === "story" && cur.storyPage && (
        <PageImageEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          page={cur.storyPage}
          storyJson={book.story_json}
          busy={regenBusyKey === cur.key}
          onRegenerate={(opts) => regenImage({ pageId: cur.storyPage!.id, ...opts })}
        />
      )}
      <CoverEditor
        open={coverEditorOpen}
        onOpenChange={setCoverEditorOpen}
        storyJson={book.story_json}
        busy={regenBusyKey === "cover"}
        onRegenerate={regenCover}
      />
      <StoryRewriteEditor
        open={storyEditorOpen}
        onOpenChange={setStoryEditorOpen}
        currentTheme={book.story_theme ?? book.story_prompt ?? ""}
        busy={regenBusyKey === "story"}
        onRegenerate={regenStory}
      />
    </div>
  );
}

function IllustrationPane({ spread, fallback }: { spread: Spread; fallback: string }) {
  if (spread.kind === "dedication") {
    return (
      <div className="grid place-items-center bg-paper/60 p-10 text-center">
        <div>
          <Heart className="mx-auto h-8 w-8 text-ember" />
          <div className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">
            Dedication
          </div>
        </div>
      </div>
    );
  }
  if (spread.kind === "ending") {
    return (
      <div className="grid place-items-center bg-paper/60 p-10 text-center">
        <Sparkles className="h-8 w-8 text-ember" />
      </div>
    );
  }
  return (
    <div className="aspect-[4/5] w-full bg-muted md:aspect-auto md:min-h-[520px]">
      <img
        src={spread.imageUrl ?? fallback}
        alt={spread.label}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

function TextPane({
  spread,
  childName,
  onSaveText,
}: {
  spread: Spread;
  childName: string | null;
  onSaveText?: (text: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(spread.text ?? "");
  const [saving, setSaving] = useState(false);

  // Reset draft when navigating to a different spread.
  useEffect(() => {
    setEditing(false);
    setDraft(spread.text ?? "");
  }, [spread.key, spread.text]);

  if (spread.kind === "cover") {
    return (
      <div className="flex flex-col justify-between gap-6 p-8 md:p-12">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">A storybook</div>
        <div>
          <h2 className="font-display text-4xl font-semibold leading-tight">{spread.text}</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Starring {childName ?? "your child"}.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">Use ← → to turn pages.</div>
      </div>
    );
  }
  if (spread.kind === "dedication") {
    return (
      <div className="flex flex-col justify-center gap-4 p-8 md:p-12">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Dedication</div>
        <p className="font-display text-2xl leading-snug">{spread.text}</p>
      </div>
    );
  }
  if (spread.kind === "ending") {
    return (
      <div className="flex flex-col justify-center gap-4 p-8 md:p-12">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">The end</div>
        <p className="font-display text-2xl leading-snug">{spread.text}</p>
      </div>
    );
  }
  // Story page — editable
  return (
    <div className="flex flex-col justify-between gap-6 p-8 md:p-12">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{spread.label}</div>
        {onSaveText && !editing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft(spread.text ?? "");
              setEditing(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" /> Edit text
          </Button>
        )}
      </div>
      {editing ? (
        <div className="space-y-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={8}
            className="font-display text-xl leading-relaxed"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="ember"
              disabled={saving}
              onClick={async () => {
                if (!onSaveText) return;
                setSaving(true);
                const ok = await onSaveText(draft);
                setSaving(false);
                if (ok) setEditing(false);
              }}
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save text
            </Button>
          </div>
        </div>
      ) : (
        <div className="font-display text-xl leading-relaxed">
          {spread.text ? (
            spread.text
          ) : (
            <span className="text-sm italic text-muted-foreground">
              This page is still being illustrated. Check back in a moment.
            </span>
          )}
        </div>
      )}
      <div className="text-right text-xs tabular-nums text-muted-foreground">
        Page {spread.pageNumberLabel}
      </div>
    </div>
  );
}

function ReaderControls({
  idx,
  total,
  spread,
  onPrev,
  onNext,
  onOpenImageEditor,
  onOpenCoverEditor,
  regenBusy,
}: {
  idx: number;
  total: number;
  spread: Spread;
  onPrev: () => void;
  onNext: () => void;
  onOpenImageEditor?: () => void;
  onOpenCoverEditor?: () => void;
  regenBusy: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-paper/40 px-4 py-3">
      <Button variant="ghost" size="sm" onClick={onPrev} disabled={idx === 0}>
        <ArrowLeft className="h-4 w-4" /> Previous
      </Button>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {idx + 1} / {total}
        </span>
        {onOpenImageEditor && (
          <Button size="sm" variant="outline" onClick={onOpenImageEditor} disabled={regenBusy}>
            {regenBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCcw className="h-3.5 w-3.5" />
            )}
            Regenerate image
          </Button>
        )}
        {onOpenCoverEditor && (
          <Button size="sm" variant="outline" onClick={onOpenCoverEditor} disabled={regenBusy}>
            {regenBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCcw className="h-3.5 w-3.5" />
            )}
            Regenerate cover
          </Button>
        )}
      </div>
      <Button variant="ghost" size="sm" onClick={onNext} disabled={idx >= total - 1}>
        Next <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function PageImageEditor({
  open,
  onOpenChange,
  page,
  storyJson,
  busy,
  onRegenerate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  page: BookPage;
  storyJson: any;
  busy: boolean;
  onRegenerate: (opts: { feedback?: string; sceneOverride?: string }) => Promise<void>;
}) {
  const scenePage = (storyJson?.pages ?? []).find(
    (p: any) => Number(p.page_number) === Number(page.page_number),
  );
  const [scene, setScene] = useState<string>(scenePage?.scene_description ?? "");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (open) {
      setScene(scenePage?.scene_description ?? "");
      setFeedback("");
    }
  }, [open, scenePage?.scene_description]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Regenerate page {page.page_number} image</DialogTitle>
          <DialogDescription>
            Tweak the scene description and add feedback. The illustrator will retry with your changes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Scene description</label>
            <Textarea rows={5} value={scene} onChange={(e) => setScene(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              What should change? (optional)
            </label>
            <Textarea
              rows={3}
              placeholder="e.g. Make the dog brown and bigger, brighter lighting, no balloons."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="ember"
            disabled={busy}
            onClick={async () => {
              await onRegenerate({
                feedback: feedback.trim() || undefined,
                sceneOverride: scene.trim() && scene !== scenePage?.scene_description ? scene : undefined,
              });
              onOpenChange(false);
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Regenerate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CoverEditor({
  open,
  onOpenChange,
  storyJson,
  busy,
  onRegenerate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  storyJson: any;
  busy: boolean;
  onRegenerate: (opts: { feedback?: string; sceneOverride?: string }) => Promise<void>;
}) {
  const baseScene = storyJson?.cover?.scene_description ?? "";
  const [scene, setScene] = useState(baseScene);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (open) {
      setScene(baseScene);
      setFeedback("");
    }
  }, [open, baseScene]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Regenerate cover</DialogTitle>
          <DialogDescription>
            Adjust the cover scene or tell us what to change. We'll redraw it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Cover scene</label>
            <Textarea rows={4} value={scene} onChange={(e) => setScene(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              What should change? (optional)
            </label>
            <Textarea
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="mt-1"
              placeholder="e.g. Warmer sunset, bigger title space at the top."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="ember"
            disabled={busy}
            onClick={async () => {
              await onRegenerate({
                feedback: feedback.trim() || undefined,
                sceneOverride: scene.trim() && scene !== baseScene ? scene : undefined,
              });
              onOpenChange(false);
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Regenerate cover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StoryRewriteEditor({
  open,
  onOpenChange,
  currentTheme,
  busy,
  onRegenerate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentTheme: string;
  busy: boolean;
  onRegenerate: (opts: { themeOverride?: string; feedback?: string }) => Promise<void>;
}) {
  const [theme, setTheme] = useState(currentTheme);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    if (open) {
      setTheme(currentTheme);
      setFeedback("");
    }
  }, [open, currentTheme]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Rewrite the whole story</DialogTitle>
          <DialogDescription>
            This generates a brand-new story text. Existing illustrations stay — regenerate any page image you want refreshed after.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Story theme / prompt</label>
            <Input value={theme} onChange={(e) => setTheme(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              What should change? (optional)
            </label>
            <Textarea
              rows={4}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="mt-1"
              placeholder="e.g. Make it funnier, fewer characters, focus on bedtime, more rhyming."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="ember"
            disabled={busy}
            onClick={async () => {
              await onRegenerate({
                themeOverride: theme.trim() && theme !== currentTheme ? theme : undefined,
                feedback: feedback.trim() || undefined,
              });
              onOpenChange(false);
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Rewrite story
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PageStrip({
  spreads,
  idx,
  onJump,
}: {
  spreads: Spread[];
  idx: number;
  onJump: (i: number) => void;
}) {
  return (
    <div className="mt-4 flex gap-1 overflow-x-auto pb-2">
      {spreads.map((s, i) => (
        <button
          key={s.key}
          onClick={() => onJump(i)}
          className={[
            "min-w-[42px] rounded border px-2 py-1 text-[11px] transition-colors",
            i === idx
              ? "border-ember bg-ember text-ember-foreground"
              : "border-border bg-background hover:bg-muted",
          ].join(" ")}
          aria-label={`Go to ${s.label}`}
        >
          {s.kind === "cover"
            ? "Cover"
            : s.kind === "dedication"
              ? "Ded."
              : s.kind === "ending"
                ? "End"
                : s.pageNumberLabel}
        </button>
      ))}
    </div>
  );
}

function PrintActions({ bookId, childName }: { bookId: string; childName: string | null }) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [joined, setJoined] = useState(false);

  async function joinWaitlist(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("print_interest").insert({
        email,
        notes: `Book ${bookId} for ${childName ?? "child"}`,
      });
      if (error) throw error;
      setJoined(true);
      toast.success("You're on the print waitlist");
    } catch (e: any) {
      toast.error(e.message ?? "Could not join waitlist");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-8 grid gap-4 rounded-lg border border-border bg-paper/40 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="flex items-start gap-3">
        <Printer className="mt-0.5 h-5 w-5 text-ember" />
        <div>
          <div className="text-sm font-semibold">Order a printed copy</div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Hardcover prints are coming soon. Join the waitlist and we'll email you the moment
            they're available.
          </p>
        </div>
      </div>
      {joined ? (
        <div className="text-sm text-sage">You're on the list — thanks!</div>
      ) : (
        <form className="flex gap-2" onSubmit={joinWaitlist}>
          <input
            type="email"
            required
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-56 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          />
          <Button type="submit" size="sm" variant="ember" disabled={submitting}>
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
            Join waitlist
          </Button>
        </form>
      )}
    </div>
  );
}

function ReaderSkeleton() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse px-4 py-8">
      <div className="h-6 w-48 rounded bg-muted" />
      <div className="mt-6 grid gap-0 overflow-hidden rounded-2xl border border-border md:grid-cols-2">
        <div className="aspect-[4/5] bg-muted md:aspect-auto md:min-h-[520px]" />
        <div className="space-y-3 p-10">
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-5/6 rounded bg-muted" />
          <div className="h-4 w-4/6 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

function ReaderError({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="font-display text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <Link to="/library" className="mt-6 inline-block">
        <Button variant="outline" size="sm">Back to library</Button>
      </Link>
    </div>
  );
}

// ---------- helpers ----------

/**
 * Resolve a stored value into a viewable URL.
 * Accepts either a fully-qualified URL or a "bucket/path" / bare storage path.
 */
async function resolveSignedUrl(value: string): Promise<string | null> {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;

  // Try known private buckets in priority order.
  const candidates = [PAGES_BUCKET, "character-sheets", "pdfs", "storynest", COVER_BUCKET_HINT];
  // If value looks like "bucket/key", try that bucket first.
  const slash = value.indexOf("/");
  if (slash > 0) {
    const maybeBucket = value.slice(0, slash);
    const rest = value.slice(slash + 1);
    if (candidates.includes(maybeBucket)) {
      const { data } = await supabase.storage.from(maybeBucket).createSignedUrl(rest, 3600);
      if (data?.signedUrl) return data.signedUrl;
    }
  }
  for (const b of candidates) {
    const { data } = await supabase.storage.from(b).createSignedUrl(value, 3600);
    if (data?.signedUrl) return data.signedUrl;
  }
  return null;
}
