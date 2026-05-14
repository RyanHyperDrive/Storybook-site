import type { ArtStyleKey } from "@/lib/art-styles";

export type SampleBook = {
  styleKey: ArtStyleKey;
  title: string;
  childName: string;
  dedication: string;
  pages: [string, string]; // 2 sample story pages
};

export const SAMPLE_BOOKS: Record<ArtStyleKey, SampleBook> = {
  comic_book: {
    styleKey: "comic_book",
    title: "Nova and the Comet Crew",
    childName: "Nova",
    dedication:
      "For Nova — who knows that being brave isn't being un-scared, it's helping the team anyway.",
    pages: [
      "Nova clipped on the bright red cape and waved from the friendly rooftop garden. \"Ready?\" giggled Sparkle, the little smiling star. Nova grinned. \"Always ready for you!\"",
      "Together they wandered the cheerful neighborhood, cheering for the bakers and the bus drivers and the tiny dogs. The whole town smiled up at their two best friends.",
    ],
  },
  soft_cartoon: {
    styleKey: "soft_cartoon",
    title: "Leo Visits the Stars",
    childName: "Leo",
    dedication:
      "For Leo — our little astronaut, who reaches for the moon every night before sleep.",
    pages: [
      "Leo zipped up his suit and pressed the big blue button. WHOOSH! The little rocket lifted off, and the stars rushed up to meet him like friends at a birthday party.",
      "On the moon, the dust felt like flour. Leo bounced once, twice, three times, and laughed so loud the craters echoed back. \"Hello!\" called the moon. \"You came!\"",
    ],
  },
  watercolor_adventure: {
    styleKey: "watercolor_adventure",
    title: "The Tea Party with Pip",
    childName: "Pip",
    dedication:
      "For Pip — who knows that the best afternoons are made of warm cups and good company.",
    pages: [
      "Pip set out four small cups under the wisteria tree. The teapot was steaming, the biscuits were stacked, and the bees had promised — promised — to be on their best behavior.",
      "First came the rabbit with a bow tie, then the snail with an umbrella, then a very polite frog. Pip poured for each one and the garden filled with soft, happy clinking.",
    ],
  },
  manga_inspired: {
    styleKey: "manga_inspired",
    title: "Yuki and the Paper Dragon",
    childName: "Yuki",
    dedication:
      "For Yuki — who folds courage out of even the smallest square of paper.",
    pages: [
      "Yuki creased the last fold and held her breath. The paper dragon trembled — once, twice — then stretched its bright red wings and lifted into the morning air.",
      "\"Climb on,\" the dragon rumbled, gentle as a kettle. Yuki gripped its neck, and together they soared above the rooftops, chasing the wind toward the far blue mountains.",
    ],
  },
  pixel_art: {
    styleKey: "pixel_art",
    title: "Quinn's Pixel Quest",
    childName: "Quinn",
    dedication:
      "For Quinn — who knows that every quest is better with a small brave friend at your side.",
    pages: [
      "Quinn stepped onto the bridge and the pixel river sparkled below. Tinker the fox hopped up beside her with a happy little chirp. \"Onward!\" Quinn whispered.",
      "Deep in the friendly forest, a tiny chest blinked with golden light. Quinn opened it slowly — and out tumbled a star, just for them, brighter than any treasure.",
    ],
  },
};
