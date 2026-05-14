// MVP art style system for StoryNest.
// The selected style_key is stored on books and reused across character sheet
// generation, page image generation, sample previews, and validation.
//
// Image model assumption: GPT Image 2 via Kie.ai. Keep model selection
// environment-driven (read at the server boundary, never in the browser):
//   IMAGE_PROVIDER=kie
//   IMAGE_PRIMARY_TEXT_TO_IMAGE_MODEL=gpt-image-2-text-to-image
//   IMAGE_PRIMARY_IMAGE_TO_IMAGE_MODEL=gpt-image-2-image-to-image
//
// Hard product rules baked in here:
//   - Only the four MVP keys below are selectable.
//   - No arbitrary free-text style input.
//   - No named artist / studio / franchise references in anchors.
//   - All page text, titles, captions are rendered by the app — never baked
//     into the image. Anchors include "no readable text in image".

export type ArtStyleKey =
  | "classic_storybook"
  | "soft_cartoon"
  | "watercolor_adventure"
  | "manga_inspired";

export type ArtStyle = {
  key: ArtStyleKey;
  name: string;
  /** Parent-facing one-liner shown on cards. */
  description: string;
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
    key: "classic_storybook",
    name: "Classic Storybook",
    description:
      "Warm, timeless picture-book artwork with soft detail and cozy colors.",
    aiAnchor:
      "Warm classic children's book illustration, soft natural lighting, gentle linework, cozy colors, expressive faces, consistent character design, premium picture-book feel, no readable text in image.",
    sampleTone: "from-ember/25 via-ember/10 to-paper",
    sampleAccent: "bg-ember/30",
    sampleTitle: "Mira and the Whispering Woods",
  },
  {
    key: "soft_cartoon",
    name: "Soft Cartoon",
    description:
      "Clean, bright, expressive cartoon artwork that keeps the character easy to recognize.",
    aiAnchor:
      "Soft modern cartoon illustration for a children's storybook, clean shapes, expressive face, friendly proportions, bright but balanced colors, consistent character design, no readable text in image.",
    sampleTone: "from-sage/25 via-sage/10 to-paper",
    sampleAccent: "bg-sage/30",
    sampleTitle: "Leo Visits the Stars",
  },
  {
    key: "watercolor_adventure",
    name: "Watercolor Adventure",
    description:
      "Gentle watercolor-style scenes with a dreamy bedtime-book feeling.",
    aiAnchor:
      "Children's book watercolor illustration, soft washes, warm paper texture, gentle edges, cozy light, expressive but subtle character design, premium bedtime story feel, no readable text in image.",
    sampleTone: "from-accent via-paper to-paper",
    sampleAccent: "bg-ember/20",
    sampleTitle: "The Tea Party with Pip",
  },
  {
    key: "manga_inspired",
    name: "Manga-Inspired",
    description:
      "Expressive, energetic storybook art inspired by manga, softened for young children.",
    aiAnchor:
      "Manga-inspired children's storybook illustration, expressive eyes, clean linework, dynamic but gentle poses, warm age-appropriate mood, consistent character design, no readable text in image.",
    sampleTone: "from-sage/20 via-ember/10 to-paper",
    sampleAccent: "bg-sage/25",
    sampleTitle: "Yuki and the Paper Dragon",
  },
];

/** Styles previewed as "coming later" — not selectable in MVP. */
export const COMING_SOON_STYLES: { name: string }[] = [
  { name: "Pixel Adventure / 8-bit" },
  { name: "Hand-Drawn Doodle" },
  { name: "Paper Cutout" },
  { name: "Plush 3D" },
  { name: "Comic Book" },
];

export const DEFAULT_ART_STYLE_KEY: ArtStyleKey = "classic_storybook";

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
