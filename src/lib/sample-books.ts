import type { ArtStyleKey } from "@/lib/art-styles";

export type SampleBook = {
  styleKey: ArtStyleKey;
  title: string;
  childName: string;
  dedication: string;
  pages: [string, string]; // 2 sample story pages
};

export const SAMPLE_BOOKS: Record<ArtStyleKey, SampleBook> = {
  classic_storybook: {
    styleKey: "classic_storybook",
    title: "Mira and the Whispering Woods",
    childName: "Mira",
    dedication:
      "For Mira — who listens for the small kind voices the rest of the world walks right past.",
    pages: [
      "Mira tied her red coat at the throat and stepped onto the soft path. The trees leaned in like grandmothers, whispering secrets only quiet children could hear.",
      "At the bend, a tiny lantern blinked twice. \"This way,\" said the firefly, in a voice the size of a thimble. Mira smiled and followed it deeper into the cozy dark.",
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
