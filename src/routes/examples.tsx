import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, Heart, ShieldCheck } from "lucide-react";
import sampleCartoon from "@/assets/sample-cartoon-leo.jpg";
import sampleWatercolor from "@/assets/sample-watercolor-pip.jpg";
import sampleManga from "@/assets/sample-manga-yuki.jpg";
import { VISIBLE_GALLERY_STYLES, type ArtStyleKey } from "@/lib/art-styles";
import { SampleBookModal } from "@/components/sample-book-modal";
import { StyleArtwork } from "@/components/style-artwork";
import { useSampleAssets, SAMPLE_KEY_BY_STYLE } from "@/hooks/use-sample-assets";

// Local fallback covers (visible styles only — Comic/Nova is hidden from the
// public gallery until its assets are regenerated for consistency).
const COVER_FALLBACK: Partial<Record<ArtStyleKey, string>> = {
  watercolor_adventure: sampleWatercolor,
  soft_cartoon: sampleCartoon,
  manga_inspired: sampleManga,
};

// Structured diversity TODOs — kept as data so the visible gallery never
// renders placeholder/blank cards, but the intent is captured for the next
// asset pass. When real assets land, move these into VISIBLE_GALLERY_STYLES
// data or a dedicated sample list.
const DIVERSITY_TODOS = [
  // TODO(asset): Black child sample — recommended style: soft_cartoon, theme: new sibling
  { id: "todo-black-child", note: "Black child starring sample" },
  // TODO(asset): Latina child sample — recommended style: watercolor_adventure, theme: grandparents
  { id: "todo-latina-child", note: "Latina child starring sample" },
  // TODO(asset): twins sample — needs is_twins flow + 2-character consistency
  { id: "todo-twins", note: "Twins starring sample" },
];

export const Route = createFileRoute("/examples")({
  head: () => ({
    meta: [
      { title: "Examples — StoryNest" },
      {
        name: "description",
        content:
          "See real sample StoryNest books. Each one is a custom cover, dedication, and 10 story pages, personalized for ages 4–7.",
      },
      { property: "og:title", content: "Examples — StoryNest" },
      {
        property: "og:description",
        content:
          "Browse sample personalized children's books. Tap a cover to flip through the story.",
      },
    ],
  }),
  component: ExamplesPage,
});

function ExamplesPage() {
  const [openKey, setOpenKey] = useState<ArtStyleKey | null>(null);
  const { assets } = useSampleAssets();

  return (
    <div className="overflow-x-hidden">
      <SampleBookModal
        styleKey={openKey}
        open={openKey !== null}
        onOpenChange={(v) => !v && setOpenKey(null)}
      />

      <section className="bg-warm-grad">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <div className="max-w-2xl">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ember">Examples</div>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-5xl">
              Real sample books, start to finish.
            </h1>
            <p className="mt-4 text-base text-muted-foreground">
              Tap any cover to flip through the cover, dedication, and the first two illustrated pages. Every StoryNest book is a custom cover + dedication + 10 story pages, personalized for ages 4–7.
            </p>
          </div>

          <div data-testid="examples-included" className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-border bg-background/70 px-4 py-3 text-xs text-foreground/80 sm:text-sm">
            <span className="inline-flex items-center gap-1.5"><BookOpen className="h-4 w-4 text-ember" /> Custom cover + dedication + 10 story pages</span>
            <span className="hidden h-4 w-px bg-border sm:inline-block" />
            <span className="inline-flex items-center gap-1.5"><Heart className="h-4 w-4 text-ember" /> Personalized for ages 4–7</span>
            <span className="hidden h-4 w-px bg-border sm:inline-block" />
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-sage" /> Parent-approved character before checkout</span>
          </div>
        </div>
      </section>

      <section data-testid="examples-gallery" className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {VISIBLE_GALLERY_STYLES.map((s) => (
            <button
              type="button"
              key={s.key}
              data-testid={`example-card-${s.key}`}
              onClick={() => setOpenKey(s.key)}
              className="group relative flex flex-col text-left focus:outline-none"
              aria-label={`Preview sample book in ${s.name} style`}
            >
              <div className="relative">
                <span aria-hidden className="absolute inset-y-1.5 right-[-3px] w-[3px] rounded-r-sm bg-foreground/10" />
                <span aria-hidden className="absolute inset-y-3 right-[-6px] w-[2px] rounded-r-sm bg-foreground/5" />
                <div className="relative overflow-hidden rounded-md border border-border bg-background shadow-[0_14px_30px_-18px_oklch(0.22_0.03_260/0.55)] transition-all duration-300 group-hover:-translate-y-1 group-focus-visible:ring-2 group-focus-visible:ring-ember">
                  <span aria-hidden className="absolute inset-y-0 left-0 z-10 w-[6px] bg-gradient-to-b from-foreground/25 via-foreground/10 to-foreground/25" />
                  <div className="relative aspect-[3/4] overflow-hidden bg-paper">
                    {(() => {
                      const dbCover = assets[SAMPLE_KEY_BY_STYLE[s.key]]?.cover;
                      const cover = dbCover ?? COVER_FALLBACK[s.key];
                      return cover ? (
                        <img
                          src={cover}
                          alt={`${s.sampleTitle} — finished StoryNest sample cover in ${s.name} style`}
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                          loading="lazy"
                          width={1024}
                          height={1280}
                        />
                      ) : (
                        <StyleArtwork styleKey={s.key} variant="cover" />
                      );
                    })()}

                    {/* top wordmark band */}
                    <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-foreground/55 via-foreground/15 to-transparent px-3 pb-6 pt-2">
                      <div className="text-[9px] font-semibold uppercase tracking-[0.22em] text-background/95">
                        A StoryNest Book
                      </div>
                    </div>

                    {/* bottom title block — typeset like a real cover */}
                    <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-foreground/85 via-foreground/55 to-transparent px-3 pb-4 pt-12">
                      <div className="font-display text-[1.05rem] font-semibold leading-[1.1] tracking-tight text-background drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)] sm:text-[1.15rem]">
                        {s.sampleTitle}
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-background/85">
                        <span className="h-px w-4 bg-background/70" />
                        Featuring your child
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 px-0.5">
                <div className="font-display text-[13px] font-medium text-foreground/80">
                  {s.name} edition
                </div>
                <div className="inline-flex items-center rounded-full bg-sage/15 px-2 py-0.5 text-[10px] font-medium text-sage">
                  {s.parentTag}
                </div>
              </div>
            </button>
          ))}
        </div>

        <p className="mt-6 max-w-3xl text-xs text-muted-foreground">
          Sample covers are fictional generated previews — not real customer children. Your own book stars your child as an illustrated character that you approve before we generate any story pages.
        </p>

        {/* Diversity asset TODOs — intentionally not rendered as cards so we
            never publish blank/placeholder samples. See DIVERSITY_TODOS. */}
        {process.env.NODE_ENV !== "production" && (
          <ul data-testid="diversity-todos" className="sr-only">
            {DIVERSITY_TODOS.map((t) => (
              <li key={t.id}>{t.note}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-paper/60">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:py-16">
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Ready to see your child as the hero?
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Free character preview · pay $29.99 only after you approve.
          </p>
          <Link to="/create" className="mt-5 inline-block">
            <Button variant="ember" size="lg">
              Start free character preview
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
