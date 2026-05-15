import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import { StyleArtwork } from "@/components/style-artwork";
import { getArtStyle } from "@/lib/art-styles";
import { SAMPLE_BOOKS } from "@/lib/sample-books";
import type { ArtStyleKey } from "@/lib/art-styles";
import { useSampleAssets, SAMPLE_KEY_BY_STYLE } from "@/hooks/use-sample-assets";
import { cn } from "@/lib/utils";
import sampleComic from "@/assets/sample-comic-nova.jpg";
import sampleComicP1 from "@/assets/sample-comic-nova-page1.jpg";
import sampleComicP2 from "@/assets/sample-comic-nova-page2.jpg";
import sampleCartoon from "@/assets/sample-cartoon-leo.jpg";
import sampleCartoonP1 from "@/assets/sample-cartoon-leo-page1.jpg";
import sampleCartoonP2 from "@/assets/sample-cartoon-leo-page2.jpg";
import sampleWatercolor from "@/assets/sample-watercolor-pip.jpg";
import sampleWatercolorP1 from "@/assets/sample-watercolor-pip-page1.jpg";
import sampleWatercolorP2 from "@/assets/sample-watercolor-pip-page2.jpg";
import sampleManga from "@/assets/sample-manga-yuki.jpg";
import sampleMangaP1 from "@/assets/sample-manga-yuki-page1.jpg";
import sampleMangaP2 from "@/assets/sample-manga-yuki-page2.jpg";
import samplePixel from "@/assets/sample-pixel-quinn.jpg";
import samplePixelP1 from "@/assets/sample-pixel-quinn-page1.jpg";
import samplePixelP2 from "@/assets/sample-pixel-quinn-page2.jpg";

const FALLBACK_ASSETS: Record<ArtStyleKey, { cover: string; page_1: string; page_2: string }> = {
  comic_book: { cover: sampleComic, page_1: sampleComicP1, page_2: sampleComicP2 },
  soft_cartoon: { cover: sampleCartoon, page_1: sampleCartoonP1, page_2: sampleCartoonP2 },
  watercolor_adventure: { cover: sampleWatercolor, page_1: sampleWatercolorP1, page_2: sampleWatercolorP2 },
  manga_inspired: { cover: sampleManga, page_1: sampleMangaP1, page_2: sampleMangaP2 },
  pixel_art: { cover: samplePixel, page_1: samplePixelP1, page_2: samplePixelP2 },
};

type Spread =
  | { kind: "cover"; label: string; imageUrl?: string; variant: "cover" }
  | { kind: "dedication"; label: string; text: string }
  | { kind: "page"; label: string; pageNumber: number; imageUrl?: string; variant: "page-a" | "page-b"; bodyText: string };

export function SampleBookModal({
  styleKey,
  open,
  onOpenChange,
}: {
  styleKey: ArtStyleKey | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const sample = styleKey ? SAMPLE_BOOKS[styleKey] : null;
  const style = styleKey ? getArtStyle(styleKey) : null;
  const { assets } = useSampleAssets();
  const sampleKey = styleKey ? SAMPLE_KEY_BY_STYLE[styleKey] : null;
  const generated = sampleKey ? assets[sampleKey] ?? {} : {};
  const fallback = styleKey ? FALLBACK_ASSETS[styleKey] : undefined;

  const spreads = useMemo<Spread[]>(() => {
    if (!sample || !style) return [];
    return [
      {
        kind: "cover",
        label: "Cover",
        imageUrl: generated.cover ?? fallback?.cover,
        variant: "cover",
      },
      { kind: "dedication", label: "Dedication", text: sample.dedication },
      {
        kind: "page",
        label: `Page 1 · ${style.name}`,
        pageNumber: 1,
        imageUrl: generated.page_1 ?? fallback?.page_1,
        variant: "page-a",
        bodyText: sample.pages[0],
      },
      {
        kind: "page",
        label: `Page 2 · ${style.name}`,
        pageNumber: 2,
        imageUrl: generated.page_2 ?? fallback?.page_2,
        variant: "page-b",
        bodyText: sample.pages[1],
      },
    ];
  }, [sample, style, generated.cover, generated.page_1, generated.page_2, fallback]);

  const [index, setIndex] = useState(0);
  const total = spreads.length;
  const prevBtnRef = useRef<HTMLButtonElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);

  // Reset to first spread whenever the book changes / modal opens
  useEffect(() => {
    if (open) setIndex(0);
  }, [open, styleKey]);

  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(
    () => setIndex((i) => Math.min(total - 1, i + 1)),
    [total],
  );

  // Keyboard arrow nav (Escape is already handled by Dialog)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, goPrev, goNext]);

  const current = spreads[index];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[92vh] sm:w-[calc(100vw-1.5rem)] sm:max-w-3xl sm:rounded-lg"
      >
        {sample && style && current && (
          <>
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-4 py-3 sm:px-6">
              <div className="min-w-0 pr-8">
                <DialogTitle className="truncate font-display text-base font-semibold sm:text-lg">
                  {sample.title}
                </DialogTitle>
                <DialogDescription className="truncate text-[11px] sm:text-xs">
                  Sample preview · {style.name} · Starring {sample.childName}
                </DialogDescription>
              </div>
              <div
                className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold tabular-nums text-muted-foreground"
                aria-live="polite"
              >
                {index + 1} / {total}
              </div>
            </div>

            {/* Body — flips between spreads */}
            <div className="relative flex-1 overflow-y-auto bg-paper/40">
              <div className="mx-auto w-full max-w-2xl px-3 py-4 sm:px-6 sm:py-6">
                <div className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {current.label}
                </div>
                <Spread current={current} styleKey={sample.styleKey} sampleTitle={sample.title} childName={sample.childName} />
              </div>

              {/* Side arrows (desktop) */}
              <button
                ref={prevBtnRef}
                type="button"
                aria-label="Previous page"
                onClick={goPrev}
                disabled={index === 0}
                className={cn(
                  "absolute left-2 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/90 p-2 shadow-sm backdrop-blur transition hover:bg-background sm:flex",
                  "disabled:cursor-not-allowed disabled:opacity-30",
                )}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                ref={nextBtnRef}
                type="button"
                aria-label="Next page"
                onClick={goNext}
                disabled={index === total - 1}
                className={cn(
                  "absolute right-2 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/90 p-2 shadow-sm backdrop-blur transition hover:bg-background sm:flex",
                  "disabled:cursor-not-allowed disabled:opacity-30",
                )}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Mobile pager controls + dot indicator */}
            <div className="shrink-0 border-t border-border bg-background px-3 py-2.5 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goPrev}
                  disabled={index === 0}
                  aria-label="Previous page"
                  className="min-w-[88px]"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" /> Prev
                </Button>

                <div className="flex items-center gap-1.5" role="tablist" aria-label="Pages">
                  {spreads.map((s, i) => (
                    <button
                      key={s.label}
                      type="button"
                      role="tab"
                      aria-selected={i === index}
                      aria-label={`Go to ${s.label}`}
                      onClick={() => setIndex(i)}
                      className={cn(
                        "h-2 w-2 rounded-full transition",
                        i === index ? "w-5 bg-foreground" : "bg-muted-foreground/30 hover:bg-muted-foreground/50",
                      )}
                    />
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={goNext}
                  disabled={index === total - 1}
                  aria-label="Next page"
                  className="min-w-[88px]"
                >
                  Next <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Footer CTA + trust */}
            <div className="shrink-0 border-t border-border bg-background px-4 py-3 sm:px-6 sm:py-4">
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] leading-snug text-muted-foreground sm:max-w-[60%]">
                  Fictional sample preview. Your book uses your child's approved character — no payment until you approve it.
                </p>
                <Link to="/create/profile" onClick={() => onOpenChange(false)} className="shrink-0">
                  <Button variant="ember" size="sm" className="w-full sm:w-auto">
                    Start free character preview
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-sage">
                <ShieldCheck className="h-3 w-3 shrink-0" />
                Parent-approved character before payment · Free regeneration if it looks off.
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Spread({
  current,
  styleKey,
  sampleTitle,
  childName,
}: {
  current: Spread;
  styleKey: ArtStyleKey;
  sampleTitle: string;
  childName: string;
}) {
  if (current.kind === "cover") {
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-background shadow-sm">
        <div className="aspect-[4/5] w-full overflow-hidden bg-paper">
          {current.imageUrl ? (
            <img src={current.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <StyleArtwork styleKey={styleKey} variant="cover" />
          )}
        </div>
        <div className="border-t border-border bg-background p-4 sm:p-6">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            A StoryNest book
          </div>
          <div className="mt-1 font-display text-xl font-semibold leading-tight text-foreground sm:text-2xl">
            {sampleTitle}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">Starring {childName}</div>
        </div>
      </div>
    );
  }

  if (current.kind === "dedication") {
    return (
      <div className="relative flex min-h-[20rem] items-center justify-center overflow-hidden rounded-lg border border-border bg-gradient-to-br from-paper via-background to-paper/60 px-6 py-12 shadow-sm sm:min-h-[24rem]">
        {/* Decorative corner flourishes */}
        <div className="pointer-events-none absolute left-4 top-4 h-6 w-6 border-l-2 border-t-2 border-ember/40" />
        <div className="pointer-events-none absolute right-4 top-4 h-6 w-6 border-r-2 border-t-2 border-ember/40" />
        <div className="pointer-events-none absolute bottom-4 left-4 h-6 w-6 border-b-2 border-l-2 border-ember/40" />
        <div className="pointer-events-none absolute bottom-4 right-4 h-6 w-6 border-b-2 border-r-2 border-ember/40" />
        <p className="max-w-md text-center font-display text-lg italic leading-relaxed text-foreground sm:text-xl">
          “{current.text}”
        </p>
      </div>
    );
  }

  // Story page — premium book spread. Illustration is the dominant visual element.
  const firstLetter = current.bodyText.trim().charAt(0);
  const restOfText = current.bodyText.trim().slice(1);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background shadow-sm">
      <div className="flex flex-col sm:grid sm:min-h-[26rem] sm:grid-cols-12">
        {/* Illustration panel — large on both mobile & desktop */}
        <div className="relative sm:col-span-7">
          <div className="aspect-[4/3] w-full overflow-hidden bg-paper sm:aspect-auto sm:h-full sm:min-h-[26rem]">
            {current.imageUrl ? (
              <img
                src={current.imageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <StyleArtwork styleKey={styleKey} variant={current.variant} />
            )}
          </div>
          {/* Subtle inner page-edge shadow toward the spine on desktop */}
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-6 bg-gradient-to-l from-foreground/10 to-transparent sm:block" />
        </div>

        {/* Story text panel — feels like a real book page */}
        <div className="relative flex flex-col justify-center bg-gradient-to-br from-paper/40 via-background to-background p-6 sm:col-span-5 sm:p-8">
          <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-6 bg-gradient-to-r from-foreground/10 to-transparent sm:block" />
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Page {current.pageNumber}
          </div>
          <p className="font-display text-[15px] leading-[1.7] text-foreground sm:text-base">
            <span className="float-left mr-2 mt-1 font-display text-4xl font-semibold leading-none text-ember sm:text-5xl">
              {firstLetter}
            </span>
            {restOfText}
          </p>
        </div>
      </div>
    </div>
  );
}
