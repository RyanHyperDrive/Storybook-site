// Shared helpers for the visual_consistency_contract pipeline.
//
// The contract is the canonical, parent-approved description of every subject
// (child / twin) in a book. It is built once after the parent approves the
// character sheet, persisted onto books.visual_consistency_contract, and then
// fed into every page illustration prompt + every validator call so the cast
// stays visually consistent from cover through the last page.

// deno-lint-ignore-file no-explicit-any

export type ContractSubject = {
  subject_id: string;
  display_name: string;
  role: string; // "primary" | "twin_a" | "twin_b" | "sibling" | ...
  age: number | null;
  pronouns: string | null;
  art_style_key: string;
  face_shape: string | null;
  hair_color: string | null;
  hair_style: string | null;
  eye_color: string | null;
  skin_tone_description: string | null;
  build_notes: string | null;
  accessibility_details: string | null;
  distinguishing_features: string | null;
  canonical_outfit: string | null;
  approved_character_sheet_image_path: string | null;
  approved_cover_image_path: string | null;
  parent_confirmed_notes: string | null;
  details_to_avoid: string | null;
};

export type VisualConsistencyContract = {
  version: 1;
  art_style_key: string;
  is_twins: boolean;
  must_remain_distinguishable: boolean;
  age_band: string;
  subjects: ContractSubject[];
  global_negatives: string[];
  built_at: string;
};

/** Build a one-line subject description for prompt injection. */
export function describeSubject(s: ContractSubject): string {
  const parts = [
    `${s.display_name}${s.age ? ` (age ${s.age})` : ""}${s.pronouns ? `, pronouns ${s.pronouns}` : ""}`,
    s.face_shape && `face: ${s.face_shape}`,
    s.skin_tone_description && `skin tone: ${s.skin_tone_description}`,
    (s.hair_color || s.hair_style) &&
      `hair: ${[s.hair_color, s.hair_style].filter(Boolean).join(" ")}`,
    s.eye_color && `eyes: ${s.eye_color}`,
    s.build_notes && `build: ${s.build_notes}`,
    s.accessibility_details && `accessibility: ${s.accessibility_details}`,
    s.distinguishing_features && `distinguishing: ${s.distinguishing_features}`,
    s.canonical_outfit && `canonical outfit: ${s.canonical_outfit}`,
    s.parent_confirmed_notes && `notes: ${s.parent_confirmed_notes}`,
    s.details_to_avoid && `avoid: ${s.details_to_avoid}`,
  ].filter(Boolean);
  return `- ${parts.join(" | ")}`;
}

/** Style-specific banned-content negatives. */
export function styleNegatives(styleKey: string): string {
  if (styleKey === "comic_book") {
    return [
      "No speech bubbles",
      "no thought bubbles",
      "no word balloons",
      "no blank bubbles",
      "no empty bubbles",
      "no caption boxes",
      "no readable text",
      "no letters",
      "no typography",
      "no signs",
      "no sound effect words (no POW, BAM, WOW, ZAP)",
      "use panel borders, halftone dots, motion lines, and starbursts instead",
    ].join(", ") + ".";
  }
  return "No readable text, no letters, no typography, no signage, no captions, no speech bubbles inside the image.";
}

/** Fixed consistency clause appended to every page prompt. */
export const CHARACTER_CONSISTENCY_CLAUSE =
  "The child character must look like the approved character sheet and cover character. Preserve the same facial structure, hair, skin tone, outfit cues, distinguishing features, and accessibility details. Do not redesign the character. Do not age the character up or down. Do not change hair style/color, skin tone, face shape, or outfit color palette.";

/** Render the contract as a prompt fragment. */
export function contractToPromptFragment(
  contract: VisualConsistencyContract | null | undefined,
): string {
  if (!contract || !Array.isArray(contract.subjects) || contract.subjects.length === 0) {
    return "";
  }
  const lines = [
    "VISUAL CONSISTENCY CONTRACT (canonical, parent-approved — must be honored exactly):",
    `Art style key: ${contract.art_style_key}`,
    contract.is_twins ? "TWINS: two distinct subjects — they must remain visually distinguishable in every frame, and each must be referred to by name." : "",
    "Subjects:",
    ...contract.subjects.map(describeSubject),
    "",
    CHARACTER_CONSISTENCY_CLAUSE,
    `Style negatives: ${styleNegatives(contract.art_style_key)}`,
  ].filter(Boolean);
  return lines.join("\n");
}

/**
 * Build a contract from DB rows. Caller must have already loaded the
 * character_sheet, child_subjects, child_profiles for this book.
 */
export function buildContract(input: {
  book: any;
  childProfiles: any[];
  childSubjects: any[];
  characterSheet: { image_url: string | null } | null;
  ageBand: string;
}): VisualConsistencyContract {
  const { book, childProfiles, childSubjects, characterSheet, ageBand } = input;
  const profilesById: Record<string, any> = {};
  for (const p of childProfiles ?? []) profilesById[p.id] = p;

  const subjects: ContractSubject[] = (childSubjects ?? []).map((s: any) => {
    const p = s.child_profile_id ? profilesById[s.child_profile_id] : null;
    const desc: string = s.description ?? "";
    return {
      subject_id: s.id,
      display_name: p?.name ?? "the child",
      role: p?.slot ?? "primary",
      age: p?.age ?? null,
      pronouns: p?.pronouns ?? null,
      art_style_key: book.art_style ?? "soft_cartoon",
      face_shape: extractTrait(desc, "face") ?? null,
      hair_color: extractTrait(desc, "hair color") ?? null,
      hair_style: extractTrait(desc, "hair") ?? null,
      eye_color: extractTrait(desc, "eye") ?? null,
      skin_tone_description: extractTrait(desc, "skin") ?? null,
      build_notes: extractTrait(desc, "build") ?? null,
      accessibility_details: p?.accessibility_details ?? null,
      distinguishing_features: p?.personality_traits ?? null,
      canonical_outfit: extractTrait(desc, "outfit") ?? extractTrait(desc, "wearing") ?? null,
      approved_character_sheet_image_path: s.character_image_url ?? characterSheet?.image_url ?? null,
      approved_cover_image_path: book.cover_image_path ?? book.cover_url ?? null,
      parent_confirmed_notes: [
        p?.favorite_color && `favorite color: ${p.favorite_color}`,
        p?.favorite_activities && `loves: ${p.favorite_activities}`,
      ].filter(Boolean).join("; ") || null,
      details_to_avoid: book.details_avoid ?? null,
    };
  });

  return {
    version: 1,
    art_style_key: book.art_style ?? "soft_cartoon",
    is_twins: !!book.is_twins,
    must_remain_distinguishable: !!book.is_twins,
    age_band: ageBand,
    subjects,
    global_negatives: [styleNegatives(book.art_style ?? "soft_cartoon")],
    built_at: new Date().toISOString(),
  };
}

function extractTrait(text: string, keyword: string): string | null {
  if (!text) return null;
  const re = new RegExp(`${keyword}[^.\\n]{0,80}`, "i");
  const m = text.match(re);
  return m ? m[0].trim() : null;
}
