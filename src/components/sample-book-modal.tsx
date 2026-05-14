import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { StyleArtwork } from "@/components/style-artwork";
import { getArtStyle } from "@/lib/art-styles";
import { SAMPLE_BOOKS } from "@/lib/sample-books";
import type { ArtStyleKey } from "@/lib/art-styles";
import { useSampleAssets, SAMPLE_KEY_BY_STYLE } from "@/hooks/use-sample-assets";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-3xl overflow-y-auto p-0">
        {sample && style && (
          <>
            <DialogHeader className="border-b border-border px-5 py-4 text-left sm:px-6">
              <DialogTitle className="font-display text-xl">
                Sample book preview
              </DialogTitle>
              <DialogDescription className="text-xs">
                {style.name} · Cover, dedication, and 2 of 10 story pages — sample
                concept, not a real customer book.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 bg-paper/40 px-4 py-5 sm:px-6 sm:py-6">
              <BookFrame
                badge="Cover"
                styleKey={sample.styleKey}
                variant="cover"
                imageUrl={generated.cover}
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  A StoryNest book
                </div>
                <div className="mt-1 font-display text-xl font-semibold leading-tight text-foreground sm:text-2xl">
                  {sample.title}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Starring {sample.childName}
                </div>
              </BookFrame>

              <BookFrame badge="Dedication" plain>
                <div className="flex h-full items-center justify-center px-6 py-8 text-center">
                  <p className="font-display text-base italic leading-relaxed text-foreground sm:text-lg">
                    “{sample.dedication}”
                  </p>
                </div>
              </BookFrame>

              <BookFrame
                badge="Page 1"
                styleKey={sample.styleKey}
                variant="page-a"
                pageNumber={1}
                bodyText={sample.pages[0]}
                imageUrl={generated.page_1}
              />

              <BookFrame
                badge="Page 2"
                styleKey={sample.styleKey}
                variant="page-b"
                pageNumber={2}
                bodyText={sample.pages[1]}
                imageUrl={generated.page_2}
              />

              <p className="text-center text-[11px] text-muted-foreground">
                Stories and illustrations are created with AI and reviewed through
                parent approval and quality checks.
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BookFrame({
  badge,
  styleKey,
  variant,
  pageNumber,
  bodyText,
  plain,
  imageUrl,
  children,
}: {
  badge: string;
  styleKey?: ArtStyleKey;
  variant?: "cover" | "page-a" | "page-b";
  pageNumber?: number;
  bodyText?: string;
  plain?: boolean;
  imageUrl?: string;
  children?: React.ReactNode;
}) {
  const Art = ({ v }: { v: "cover" | "page-a" | "page-b" }) =>
    imageUrl ? (
      <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
    ) : styleKey ? (
      <StyleArtwork styleKey={styleKey} variant={v} />
    ) : null;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>{badge}</span>
        {pageNumber != null && <span>Page {pageNumber} of 10</span>}
      </div>

      {variant === "cover" && styleKey ? (
        <div className="relative">
          <div className="aspect-[4/5] w-full overflow-hidden bg-paper">
            <Art v="cover" />
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 via-background/70 to-transparent p-4 sm:p-6">
            {children}
          </div>
        </div>
      ) : variant && styleKey ? (
        <div className="grid gap-0 sm:grid-cols-5">
          <div className="sm:col-span-3">
            <div className="aspect-[4/3] w-full overflow-hidden bg-paper sm:aspect-auto sm:h-full">
              <Art v={variant} />
            </div>
          </div>
          <div className="flex min-h-[10rem] flex-col justify-center p-5 font-display text-[15px] leading-relaxed text-foreground sm:col-span-2 sm:text-base">
            {bodyText}
          </div>
        </div>
      ) : plain ? (
        <div className="min-h-[14rem]">{children}</div>
      ) : null}
    </div>
  );
}
