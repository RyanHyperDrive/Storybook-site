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
  skin_undertone: string | null;
  hair_texture: string | null;
  nose_shape: string | null;
  lip_shape: string | null;
  eye_shape: string | null;
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
    s.skin_tone_description && `skin tone (match exactly, do not lighten): ${s.skin_tone_description}`,
    s.skin_undertone && `skin undertone: ${s.skin_undertone}`,
    (s.hair_color || s.hair_style || s.hair_texture) &&
      `hair (preserve texture exactly): ${[s.hair_color, s.hair_texture, s.hair_style].filter(Boolean).join(" ")}`,
    s.eye_color && `eyes: ${[s.eye_color, s.eye_shape].filter(Boolean).join(", ")}`,
    s.nose_shape && `nose: ${s.nose_shape}`,
    s.lip_shape && `lips: ${s.lip_shape}`,
    s.build_notes && `build: ${s.build_notes}`,
    s.accessibility_details && `accessibility: ${s.accessibility_details}`,
    s.distinguishing_features && `distinguishing: ${s.distinguishing_features}`,
    s.canonical_outfit && `default everyday outfit (use ONLY when the scene doesn't call for different clothing — e.g. pajamas at bedtime, a costume/armor/etc. when the story calls for it): ${s.canonical_outfit}`,
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
  "The child character must look like the same real child shown in the approved character sheet and cover. The thing that must stay identical on every page is the CHILD'S IDENTITY: facial structure, hair texture and color, skin tone AND undertone, eye/nose/lip shape, build, distinguishing features, and accessibility details. Do NOT lighten or desaturate skin. Do NOT straighten, loosen, or thin out textured/coily/curly hair. Do NOT narrow a wide nose, thin full lips, or anglicize features. Do not redesign the character. Do not age the character up or down. Do not change hair style/color, skin tone, or face shape. CLOTHING is NOT fixed — it should match what the current page's scene calls for (e.g. pajamas in a bedtime scene, a costume or armor when the story calls for it) and stay consistent with the previous page within the same continuous setting. Only the child's identity must never change. If you are unsure about identity, copy the reference image rendering exactly.";

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
    // Prefer vision-derived structured analysis (set by create-character-sheet
    // after the sheet image is generated). Falls back to raw-photo analysis,
    // then to brittle regex extraction over the freeform description.
    const v = (s.photo_analysis?.sheet_vision ?? {}) as Record<string, any>;
    const a = (s.photo_analysis ?? {}) as Record<string, any>;
    const pick = (visionKey: string, analysisKey: string, descKeyword: string) =>
      (typeof v[visionKey] === "string" && v[visionKey].trim())
        ? v[visionKey].trim()
        : (typeof a[analysisKey] === "string" && a[analysisKey].trim())
          ? a[analysisKey].trim()
          : extractTrait(desc, descKeyword);
    const outfitColors = Array.isArray(v.outfit_colors) ? v.outfit_colors.filter(Boolean).join(", ") : "";
    const distinguishing = Array.isArray(v.distinguishing_features) ? v.distinguishing_features.filter(Boolean).join(", ") : "";
    const accessibility = Array.isArray(v.accessibility_devices) ? v.accessibility_devices.filter(Boolean).join(", ") : "";
    return {
      subject_id: s.id,
      display_name: p?.name ?? "the child",
      role: p?.slot ?? "primary",
      age: p?.age ?? null,
      pronouns: p?.pronouns ?? null,
      art_style_key: book.art_style ?? "soft_cartoon",
      face_shape: pick("face_shape", "face_shape", "face") ?? null,
      hair_color: pick("hair_color", "hair_color", "hair color") ?? null,
      hair_style: pick("hair_style", "hair_length_and_style", "hair") ?? null,
      eye_color: pick("eye_color", "eye_color", "eye") ?? null,
      skin_tone_description: pick("skin_tone", "skin_tone_for_illustration", "skin") ?? null,
      skin_undertone: pick("skin_undertone", "skin_undertone", "undertone") ?? null,
      hair_texture: pick("hair_texture", "hair_texture", "texture") ?? null,
      nose_shape: pick("nose_shape", "nose_shape", "nose") ?? null,
      lip_shape: pick("lip_shape", "lip_shape", "lip") ?? null,
      eye_shape: pick("eye_shape", "eye_shape", "eye shape") ?? null,
      build_notes: deriveBuildNotes(p?.age ?? null, (typeof v.build === "string" && v.build) ? v.build : extractTrait(desc, "build")),
      accessibility_details: [p?.accessibility_details, accessibility].filter(Boolean).join("; ") || null,
      distinguishing_features: [p?.personality_traits, distinguishing].filter(Boolean).join("; ") || null,
      canonical_outfit: (typeof v.canonical_outfit === "string" && v.canonical_outfit)
        ? `${v.canonical_outfit}${outfitColors ? ` (colors: ${outfitColors})` : ""}`
        : (extractTrait(desc, "outfit") ?? extractTrait(desc, "wearing") ?? null),
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

/**
 * Derive an age-appropriate build description. Vision models frequently
 * mislabel older kids as "toddler build" — never trust that guess if the
 * parent told us the actual age.
 */
function deriveBuildNotes(age: number | null, visionGuess: string | null): string | null {
  const isToddlerLabel = (s: string) => /toddler|baby|infant/i.test(s);
  if (typeof age === "number" && age > 0) {
    if (age <= 3) {
      return visionGuess && !/\b(adult|teen)\b/i.test(visionGuess)
        ? visionGuess
        : `typical proportions for a ${age}-year-old toddler`;
    }
    // For non-toddlers, discard any "toddler/baby/infant" mislabel from vision.
    if (visionGuess && !isToddlerLabel(visionGuess)) return visionGuess;
    return `typical proportions for a ${age}-year-old child`;
  }
  return visionGuess ?? null;
}
