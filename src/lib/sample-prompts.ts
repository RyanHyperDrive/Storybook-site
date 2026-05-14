// Allowlisted sample books for marketing art generation.
// Server-side only. Never accept arbitrary public prompts.
import type { ArtStyleKey } from "@/lib/art-styles";

export type SampleAssetType = "cover" | "page_1" | "page_2";

export type SamplePromptDef = {
  sample_key: string;
  style_key: ArtStyleKey;
  title: string;
  prompts: Record<SampleAssetType, string>;
};

export const SAMPLE_PROMPTS: SamplePromptDef[] = [
  {
    sample_key: "comic_book_nova",
    style_key: "comic_book",
    title: "Nova and the Comet Crew",
    prompts: {
      cover:
        "A premium full-bleed children's storybook cover illustration in a cozy adventure comic book style, filling the entire canvas with no white borders or empty margins. Bold ink outlines, halftone dot shading, comic-panel energy, vivid but warm cozy palette. A cheerful kid in everyday adventure clothes — yellow rain jacket, denim shorts, sneakers, small explorer backpack — standing on a wooden treehouse platform in a sunny backyard, waving hello. A small friendly cartoon owl sidekick perches on the railing beside them. String lights, leafy branches, paper-folded pennants, soft afternoon sky. A few decorative empty speech-bubble shapes are okay if they look intentional. Absolutely no fire, no flames, no candles, no lanterns, no weapons, no peril, no superhero cape, no flying. Absolutely no readable text, no letters, no title, no typography anywhere. Vertical 4:5.",
      page_1:
        "Same kid in yellow rain jacket, denim shorts, sneakers, and small explorer backpack, and the same small friendly cartoon owl sidekick, same cozy adventure comic book art direction. Kneeling in a sunny neighborhood backyard discovering a hidden patch of glowing wildflowers and friendly bumblebees, owl peeking from a leafy branch, butterflies, garden fence, soft daylight. Absolutely no fire, no flames, no weapons, no peril, no cape, no flying. Absolutely no readable text, no letters, no speech-bubble text. Vertical 4:5.",
      page_2:
        "Same kid in yellow rain jacket, denim shorts, sneakers, and explorer backpack, and the same small friendly cartoon owl sidekick, same cozy adventure comic book art direction. Sitting cross-legged on the warm wooden floor of a backyard treehouse reading nook, surrounded by neat stacks of picture books with PLAIN BLANK COVERS and a folded paper map, owl perched on a stack of books beside them. Soft golden afternoon daylight through a round window, paper stars hanging on strings, tiny paper confetti drifting. Absolutely no fire, no flames, no candles, no lanterns, no lit objects, no weapons, no peril. Absolutely no readable text, no letters, no pseudo-text, no writing on book covers, no speech bubbles. Vertical 4:5.",
    },
  },
  {
    sample_key: "soft_cartoon_leo",
    style_key: "soft_cartoon",
    title: "Leo Visits the Stars",
    prompts: {
      cover:
        "A polished soft cartoon children's book cover illustration, no words or letters, no title, no typography. A cheerful child astronaut floating near a friendly rocket and smiling moon, bright stars, rounded shapes, playful color, premium modern preschool animation feel, vertical 4:5, leave quiet space for HTML title overlay.",
      page_1:
        "Same child astronaut and same soft cartoon art direction, no words or letters. The child waves from a tiny rocket window as colorful planets drift nearby, joyful and clean, vertical 4:5.",
      page_2:
        "Same child astronaut and same soft cartoon art direction, no words or letters. The child bounces gently across a moon path with star-shaped footprints, playful and bright, vertical 4:5.",
    },
  },
  {
    sample_key: "watercolor_pip",
    style_key: "watercolor_adventure",
    title: "The Tea Party with Pip",
    prompts: {
      cover:
        "A polished watercolor children's book cover illustration, no words or letters, no title, no typography. A gentle garden tea party with a joyful child and a small friendly stuffed-bunny-like companion named Pip, flowers, teapot, soft pastel washes, visible paper texture, delicate ink accents, premium picture book look, vertical 4:5, leave quiet space for HTML title overlay.",
      page_1:
        "Same child and Pip, same watercolor art direction, no words or letters. The child pours pretend tea for Pip under a blooming garden arch, soft pastel washes, vertical 4:5.",
      page_2:
        "Same child and Pip, same watercolor art direction, no words or letters. Pip points toward a hidden path of petals leading into the garden, gentle adventure, vertical 4:5.",
    },
  },
  {
    sample_key: "manga_yuki",
    style_key: "manga_inspired",
    title: "Yuki and the Paper Dragon",
    prompts: {
      cover:
        "A polished manga-inspired children's adventure book cover illustration, no words or letters, no title, no typography. A brave child holding a folded red paper dragon that comes alive above mountain rooftops, expressive but age-appropriate, clean precise linework, dynamic cinematic composition, soft screentone texture, premium kid-friendly manga, vertical 4:5, leave quiet space for HTML title overlay.",
      page_1:
        "Same child and paper dragon, same manga-inspired art direction, no words or letters. The red paper dragon lifts from the child's hands in a swirl of wind, expressive wonder, vertical 4:5.",
      page_2:
        "Same child and paper dragon, same manga-inspired art direction, no words or letters. The child rides a trail of folded paper shapes across a moonlit village sky, dynamic but gentle, vertical 4:5.",
    },
  },
  {
    sample_key: "pixel_quinn",
    style_key: "pixel_art",
    title: "Quinn's Pixel Quest",
    prompts: {
      cover:
        "A premium children's 8-bit pixel art book cover illustration, no words or letters, no title, no typography, no readable text or pseudo-text glyphs. Charming retro 16-bit RPG style with crisp chunky pixels, limited cheerful palette, a brave kid pixel hero with a tiny pet pixel fox standing on a hill in front of a magical castle at dawn, glittering pixel stars, parallax pixel mountains, premium nostalgic pixel art, vertical 4:5, leave quiet pixel sky space at the top for an HTML title.",
      page_1:
        "Same kid pixel hero and pet pixel fox, same 8-bit pixel art direction, no words or letters or pseudo-text glyphs. Crossing a tiny pixel bridge over a sparkling river full of pixel fish, crisp chunky pixel blocks, limited cheerful palette, charming retro RPG feel, vertical 4:5.",
      page_2:
        "Same kid pixel hero and pet pixel fox, same 8-bit pixel art direction, no words or letters or pseudo-text glyphs. Finding a glowing pixel treasure chest in a friendly pixel forest clearing with sparkles, crisp chunky pixels, limited cheerful palette, charming retro RPG feel, vertical 4:5.",
    },
  },
];

export const ASSET_TYPES: SampleAssetType[] = ["cover", "page_1", "page_2"];

export function getSamplePrompt(sample_key: string): SamplePromptDef | null {
  return SAMPLE_PROMPTS.find((s) => s.sample_key === sample_key) ?? null;
}

/** Map style_key → sample_key for homepage/modal lookup. */
export function sampleKeyForStyle(styleKey: ArtStyleKey): string {
  const found = SAMPLE_PROMPTS.find((s) => s.style_key === styleKey);
  return found?.sample_key ?? "";
}
