import { z } from "zod";

export const childSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(40),
  age: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d+$/.test(v) && +v >= 1 && +v <= 12), "Age must be 1–12"),
  pronouns: z.string().trim().max(40).optional().default(""),
  favorite_color: z.string().trim().max(40).optional().default(""),
  favorite_activities: z.string().trim().max(400).optional().default(""),
  loves: z.string().trim().max(400).optional().default(""),
  personality_traits: z.string().trim().max(400).optional().default(""),
  accessibility_details: z.string().trim().max(400).optional().default(""),
});

export type ChildDraft = z.infer<typeof childSchema>;

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

export const storySchema = z.object({
  title: z.string().trim().max(80).optional().default(""),
  theme: z.string().trim().min(1, "Pick a theme").max(80),
  prompt: z.string().trim().max(800).optional().default(""),
  details_include: z.string().trim().max(400).optional().default(""),
  details_avoid: z.string().trim().max(400).optional().default(""),
  dedication: z.string().trim().max(280).optional().default(""),
  reading_level: z.enum(["ages_3_5", "ages_4_7", "ages_6_8"]).default("ages_4_7"),
  guardian_consent: z.literal(true, {
    errorMap: () => ({ message: "Please confirm guardian consent to continue" }),
  }),
});

export type StoryDraft = z.infer<typeof storySchema>;

export const READING_LEVELS = [
  { value: "ages_3_5", label: "Ages 3–5 · short sentences" },
  { value: "ages_4_7", label: "Ages 4–7 · default" },
  { value: "ages_6_8", label: "Ages 6–8 · richer vocabulary" },
] as const;

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
