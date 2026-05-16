// MVP art style system for StoryNest.
// The selected style_key is stored on books and reused across character sheet
// generation, page image generation, sample previews, and validation.
//
// MVP launch styles (4): Watercolor, Soft Cartoon, Comic Book, Manga.
// Pixel art is intentionally removed for MVP — kid-book trust >> retro novelty.
//
// Image model assumption: GPT Image 2 via Kie.ai. Keep model selection
// environment-driven (read at the server boundary, never in the browser):
//   IMAGE_PROVIDER=kie
//   IMAGE_PRIMARY_TEXT_TO_IMAGE_MODEL=gpt-image-2-text-to-image
//   IMAGE_PRIMARY_IMAGE_TO_IMAGE_MODEL=gpt-image-2-image-to-image
//
// Hard product rules baked in here:
//   - Only the keys below are selectable.
//   - No arbitrary free-text style input.
//   - No named artist / studio / franchise references in anchors.
//   - All page text, titles, captions are rendered by the app — never baked
//     into the image. Anchors include "no readable text in image".

export type ArtStyleKey =
  | "comic_book"
  | "soft_cartoon"
  | "watercolor_adventure"
  | "manga_inspired";

export type ArtStyle = {
  key: ArtStyleKey;
  name: string;
  /** Parent-facing one-liner shown on cards. */
  description: string;
  /** Occasion-based "Best for…" chip shown on sample cards. */
  parentTag: string;
  /** Prompt anchor appended to every image generation for consistency. */
  aiAnchor: string;
  /** Tailwind classes for the sample placeholder gradient. */
  sampleTone: string;
  sampleAccent: string;
  /** A representative sample book title for marketing/sample sections. */
  sampleTitle: string;
};

export const ART_STYLES: ArtStyle[] = [
  {
    key: "watercolor_adventure",
    name: "Watercolor",
    description:
      "Delicate paper texture and soft pastel washes — a dreamy bedtime-book feel.",
    parentTag: "Best for bedtime",
    aiAnchor:
      "Children's book watercolor illustration, soft pastel washes, visible warm paper texture, gentle ink accents, expressive but subtle character design, premium bedtime story feel, no readable text in image.",
    sampleTone: "from-accent via-paper to-paper",
    sampleAccent: "bg-ember/20",
    sampleTitle: "The Tea Party with Pip",
  },
  {
    key: "soft_cartoon",
    name: "Soft Cartoon",
    description:
      "Rounded, playful, modern preschool animation — bright, friendly, easy to love.",
    parentTag: "Best for big feelings",
    aiAnchor:
      "Soft modern cartoon illustration for a children's storybook, clean rounded shapes, large expressive eyes, friendly proportions, bright balanced colors, smooth gradients, premium preschool animation feel, consistent character design, no readable text in image.",
    sampleTone: "from-sage/25 via-sage/10 to-paper",
    sampleAccent: "bg-sage/30",
    sampleTitle: "Leo Visits the Stars",
  },
  {
    key: "comic_book",
    name: "Comic Book",
    description:
      "Bold ink lines, halftone dots, and friendly action panels — a cozy Saturday-morning comic.",
    parentTag: "Best for brave moments",
    aiAnchor:
      "Children's adventure comic book illustration, bold ink outlines, halftone dot shading, motion lines, starbursts, panel-border framing, expressive poses, vivid but cozy kid-friendly colors, consistent character design, premium kid-friendly comic art. No speech bubbles, no thought bubbles, no word balloons, no blank bubbles, no empty bubbles, no caption boxes, no readable text, no letters, no typography, no signs, no sound effect words (no POW, BAM, WOW, ZAP), no weapons, no fire, no scary peril.",
    sampleTone: "from-ember/30 via-ember/10 to-paper",
    sampleAccent: "bg-ember/30",
    sampleTitle: "Nova and the Treehouse Owl",
  },
  {
    key: "manga_inspired",
    name: "Manga",
    description:
      "Expressive eyes, clean linework, and cinematic composition — softened for young readers.",
    parentTag: "Best for new sibling",
    aiAnchor:
      "Manga-inspired children's storybook illustration, expressive large eyes, clean precise linework, dynamic cinematic composition, soft screentone shading, age-appropriate gentle mood, consistent character design, no readable text in image.",
    sampleTone: "from-sage/20 via-ember/10 to-paper",
    sampleAccent: "bg-sage/25",
    sampleTitle: "Yuki and the Paper Dragon",
  },
];

/**
 * Sample style keys that we intentionally HIDE from the visible marketing
 * gallery while still letting the style itself be picked in /create/style.
 *
 * comic_book / Nova: bundled sample assets currently drift in jacket color
 * and scene composition vs the one-sentence story text. Hiding the card
 * until we regenerate consistent Nova assets. Style is still selectable.
 */
export const HIDDEN_GALLERY_SAMPLE_STYLES: ReadonlySet<ArtStyleKey> = new Set<
  ArtStyleKey
>(["comic_book"]);

/** Styles previewed as "coming later" — not selectable in MVP. */
export const COMING_SOON_STYLES: { name: string }[] = [
  { name: "Hand-Drawn Doodle" },
  { name: "Paper Cutout" },
  { name: "Plush 3D" },
  { name: "Crayon Sketchbook" },
];

export const DEFAULT_ART_STYLE_KEY: ArtStyleKey = "soft_cartoon";

const STYLE_KEYS = new Set<ArtStyleKey>(ART_STYLES.map((s) => s.key));

export function isArtStyleKey(value: unknown): value is ArtStyleKey {
  return typeof value === "string" && STYLE_KEYS.has(value as ArtStyleKey);
}

export function getArtStyle(key: string | null | undefined): ArtStyle {
  if (key && isArtStyleKey(key)) {
    return ART_STYLES.find((s) => s.key === key)!;
  }
  return ART_STYLES.find((s) => s.key === DEFAULT_ART_STYLE_KEY)!;
}

/** Styles that should appear on the public /examples gallery + home samples. */
export const VISIBLE_GALLERY_STYLES: ArtStyle[] = ART_STYLES.filter(
  (s) => !HIDDEN_GALLERY_SAMPLE_STYLES.has(s.key),
);
