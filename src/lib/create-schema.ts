import { z } from "zod";

export const childSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(40),
  age: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d+$/.test(v) && +v >= 1 && +v <= 12), "Age must be 1–12"),
  pronouns: z
    .string()
    .refine((v) => { return v === "he" || v === "she"; }, "Please select Boy or Girl"),
  favorite_color: z.string().trim().max(40).optional().default(""),
  favorite_activities: z.string().trim().max(400).optional().default(""),
  loves: z.string().trim().max(400).optional().default(""),
  personality_traits: z.string().trim().max(400).optional().default(""),
  accessibility_details: z.string().trim().max(400).optional().default(""),
});

export type ChildDraft = Omit<z.infer<typeof childSchema>, "pronouns"> & {
  pronouns: string;
};

export const emptyChild: ChildDraft = {
  name: "",
  age: "",
  pronouns: "",
  favorite_color: "",
  favorite_activities: "",
  loves: "",
  personality_traits: "",
  accessibility_details: "",
};

// Reading level keys map to age bands. Legacy values are preserved so existing
// books in the database continue to load.
export const storySchema = z.object({
  title: z.string().trim().max(80).optional().default(""),
  theme: z.string().trim().min(1, "Pick a theme").max(80),
  prompt: z.string().trim().max(800).optional().default(""),
  details_include: z.string().trim().max(400).optional().default(""),
  details_avoid: z.string().trim().max(400).optional().default(""),
  dedication: z.string().trim().max(280).optional().default(""),
  reading_level: z
    .enum(["ages_2_3", "ages_4_6", "ages_7_10", "ages_3_5", "ages_4_7", "ages_6_8"])
    .default("ages_4_6"),
  guardian_consent: z.literal(true, {
    errorMap: () => ({ message: "Please confirm guardian consent to continue" }),
  }),
});

export type StoryDraft = z.infer<typeof storySchema>;

export const READING_LEVELS = [
  {
    value: "ages_2_3",
    label: "Ages 2–3 · board-book style",
    hint: "Very short, 1 simple sentence per page. At least 8 illustrated story pages.",
  },
  {
    value: "ages_4_6",
    label: "Ages 4–6 · classic picture book",
    hint: "1–3 short sentences per page. At least 10 illustrated story pages.",
  },
  {
    value: "ages_7_10",
    label: "Ages 7–10 · early-reader",
    hint: "2–5 sentences per page, richer vocabulary. At least 12 illustrated story pages.",
  },
] as const;

/** Server-side knobs derived from a reading_level. */
export function readingLevelTargets(level: string) {
  switch (level) {
    case "ages_2_3":
      return {
        ageBand: "2-3",
        minPages: 8,
        targetPages: 8,
        sentencesPerPage: "exactly 1 very short sentence (under 10 words)",
        toneNotes:
          "Board-book voice. Repetition is welcome. Tiny vocabulary. Soft, simple ideas.",
      };
    case "ages_7_10":
      return {
        ageBand: "7-10",
        minPages: 12,
        targetPages: 12,
        sentencesPerPage: "2 to 5 sentences",
        toneNotes:
          "Early-reader voice. Slightly richer vocabulary, gentle wit, light suspense, always a kind resolution.",
      };
    // legacy + new default
    case "ages_4_7":
    case "ages_3_5":
    case "ages_4_6":
    case "ages_6_8":
    default:
      return {
        ageBand: "4-6",
        minPages: 10,
        targetPages: 10,
        sentencesPerPage: "1 to 3 short read-aloud sentences",
        toneNotes:
          "Classic picture-book voice. Warm, calm, age-appropriate, positive resolution.",
      };
  }
}

export const THEMES = [
  "Bedtime adventure",
  "First day of school",
  "Big sibling",
  "Brave explorer",
  "Animal friends",
  "Outer space",
  "Underwater journey",
  "Magical forest",
] as const;
