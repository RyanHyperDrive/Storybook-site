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
    title: "Nova and the Treehouse Owl",
    childName: "Nova",
    dedication:
      "For Nova — who knows the best adventures start in your own backyard, with a good friend by your side.",
    pages: [
      "Nova zipped up the yellow rain jacket and climbed up to the treehouse. \"Ready?\" hooted Pip, the little owl on the railing. Nova grinned. \"Always ready with you.\"",
      "Down in the garden, the same yellow jacket bobbed between glowing wildflowers. Friendly bumblebees hummed a soft good-morning song, and the whole backyard waved back at Nova.",
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
};

