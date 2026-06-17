// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";

/**
 * POST /validate-page
 * Body: {
 *   bookId: string,
 *   pageNumber: number,
 *   sceneDescription: string,
 *   charactersPresent?: string[],
 *   visualMustHaves?: string[],
 *   visualMustNotInclude?: string[],
 *   childDetails?: string,           // parent-provided child summary
 *   isTwins?: boolean,
 *   characterSheetUrl?: string,      // optional override
 *   pageImageUrl?: string,           // optional override; otherwise fetched from book_pages
 * }
 *
 * Asks a vision model to compare (1) approved character sheet,
 * (2) generated page image, (3) required scene, (4) parent details.
 *
 * Persists scores onto book_pages.quality_score / needs_review / review_notes
 * and returns the structured QC report.
 */

function buildSystemPrompt(ageBand: string, styleKey: string, hasCover: boolean, hasPrevPage: boolean): string {
  const refs = [
    "1. The approved character sheet (Image 1).",
    hasCover ? "2. The approved cover image (Image 2)." : "",
    hasPrevPage ? `${hasCover ? "3" : "2"}. The previous approved story page (continuity reference).` : "",
    `${1 + (hasCover ? 1 : 0) + (hasPrevPage ? 1 : 0) + 1}. The generated page image to validate.`,
  ].filter(Boolean).join("\n");
  return `You are validating a personalized children's storybook page for a child in the age band ${ageBand}, art style "${styleKey}".

Compare:
${refs}
And against the visual consistency contract, the required scene, the parent-provided child details, and the age band.

Return STRICT JSON only — no markdown, no commentary — matching this schema exactly:

{
  "character_likeness_score": 0,
  "character_consistency_score": 0,
  "cover_match_score": 0,
  "style_consistency_score": 0,
  "scene_accuracy_score": 0,
  "scene_match_score": 0,
  "age_appropriateness_score": 0,
  "age_appropriateness_issues": [],
  "correct_number_of_main_characters": true,
  "twin_distinction_ok": true,
  "safety_ok": true,
  "speech_bubble_detected": false,
  "text_inside_image_detected": false,
  "banned_content_detected": [],
  "missing_required_character_details": [],
  "wrong_character_details": [],
  "artifact_issues": [],
  "composition_issues": [],
  "head_cropped": false,
  "hair_cropped": false,
  "face_cropped": false,
  "feet_cropped": false,
  "hands_cropped": false,
  "extreme_close_up_requested": false,
  "safe_framing_ok": true,
  "missing_required_elements": [],
  "regeneration_recommended": false,
  "needs_regeneration": false,
  "regeneration_instruction": ""
}

Scoring rules:
- All scores are floats from 0.0 to 1.0.
- character_consistency_score = how faithfully the page reproduces the child's IDENTITY (face shape, hair color/texture/style, skin tone AND undertone, eye/nose/lip shape, build, distinguishing features, accessibility devices) from the character sheet, cover, and previous page. Score IDENTITY STRICTLY: any drift in face shape, hair color/texture/style, skin tone, undertone, eye color, or accessibility devices must drop the score sharply. CLOTHING is NOT part of this score — do NOT let scene-appropriate outfit changes (e.g. pajamas in a bedtime scene, a costume or armor when the story calls for it) pull this score down. Judge clothing only against what THIS page's required scene and "Must include" list call for and against continuity with the previous page when the setting is unchanged; the character sheet's default/canonical outfit is just a fallback when the scene doesn't specify clothing. character_likeness_score may mirror this for back-compat.
- cover_match_score = how faithfully the page matches the approved cover's character IDENTITY (face/hair/skin/features), NOT its clothing. ${hasCover ? "Score it strictly on identity only." : "If no cover image is provided, set this to 1.0."}
- style_consistency_score = adherence to the named art style.
- scene_match_score = how faithfully the image depicts the required scene; scene_accuracy_score may mirror this.
- speech_bubble_detected = true if ANY speech bubble, thought bubble, word balloon, blank bubble, empty bubble, or caption box is visible — even decorative empty ones.
- text_inside_image_detected = true if any readable text, letters, pseudo-text glyphs, signs, captions, or sound effect words (POW/BAM/WOW/ZAP) appear in the image.
- banned_content_detected = list of items from the BANNED CONTENT list (provided in the user message) that are visibly present in the image. Be strict and literal — if the parent said "no balloons" and a balloon is visible, list "balloons". Match synonyms (e.g. parent avoids "snakes" → flag visible serpents). Return [] if none are present.
- missing_required_character_details = list of IDENTITY attributes (e.g. "freckles", "wheelchair", "natural coily hair") that should appear but are missing. Do NOT list clothing items here unless the page's "Must include" list explicitly names them.
- wrong_character_details = list of IDENTITY attributes that are wrong (e.g. "hair is brown instead of red", "skin lightened from deep brown to tan", "coily hair rendered as loose waves"). Lightening the child's skin, desaturating skin tone, straightening or loosening textured/coily hair, narrowing a wide nose, thinning full lips, or otherwise softening ethnic features compared to the character sheet MUST be flagged here and must drop character_consistency_score to 0.4 or lower. Do NOT flag scene-appropriate clothing (e.g. pajamas in a bedtime scene, a costume during a costume scene) as a wrong character detail, and do NOT use outfit differences from the character sheet to lower character_consistency_score. If the clothing genuinely conflicts with what the page's required scene calls for, note it in "composition_issues" as an outfit/scene mismatch instead.
- "age_appropriateness_score" judges BOTH the page text (if any is implied by the scene) and the image specifically against ages ${ageBand}, NOT a generic "kid safe" standard.
  - Ages 2-3: any peril, scary creatures, darkness, weapons, or injury -> max 0.5.
  - Ages 4-6: weapons, injury, scary monsters, romantic framing, shame/punishment imagery -> max 0.6.
  - Ages 7-10: gore, sexual/romantic content, realistic violence, weapons used to harm, substance use, self-harm -> max 0.5.
- "age_appropriateness_issues" lists concrete reasons the score was reduced (or [] if 1.0).
- safety_ok = false if there is anything genuinely unsafe in the image regardless of age.

SAFE FRAMING — strict, INDEPENDENT checks. Evaluate the main child / focal character in the frame regardless of how good the rest of the image looks:
- "extreme_close_up_requested" = true ONLY if the scene description explicitly calls for an extreme close-up, portrait-only shot, or face-only crop. Otherwise false. Do NOT infer it from artistic preference.
- "head_cropped" = true if ANY portion of the top of the head/skull is cut off by the image edge — even a sliver of scalp — OR the top of the head touches the frame edge with no padding above it.
- "hair_cropped" = true if hair is cut off by any image edge (top or sides) beyond a hairline trim.
- "face_cropped" = true if any part of the face (forehead, brow, chin, ears, cheek) is cut off by the frame.
- "feet_cropped" = true if the feet, ankles, or shoes are cut off by the bottom edge in a scene where the child is standing, walking, running, jumping, dancing, or otherwise depicted full-body — UNLESS the child is clearly seated, lying down, behind an in-scene occluder (desk, blanket, water, tall grass), or the scene description explicitly calls for a waist-up / medium shot.
- "hands_cropped" = true if hands holding or interacting with a story-required object are cut off.
- "safe_framing_ok" = false if ANY of head_cropped, hair_cropped, face_cropped, OR feet_cropped (when the feet-applicable conditions above hold) is true AND extreme_close_up_requested is false. Even in an extreme close-up, head/hair/face must still be the intentional subject with comfortable padding — never an awkward partial crop.
- Any true framing-crop flag MUST also appear in "composition_issues" as a literal phrase such as "top of head cropped at frame edge", "feet cut off below the ankles in a standing pose", or "chin cropped by lower frame". Be specific.

- regeneration_recommended / needs_regeneration = true if ANY of:
    character_consistency_score < 0.88,
    cover_match_score < 0.85,
    style_consistency_score < 0.85,
    scene_match_score < 0.85,
    age_appropriateness_score < 0.95,
    text_inside_image_detected = true,
    composition_issues is non-empty,
    safe_framing_ok = false,
    head_cropped = true,
    hair_cropped = true,
    face_cropped = true,
    (feet_cropped = true AND extreme_close_up_requested = false),
    banned_content_detected is non-empty,
    (style is "comic_book" AND speech_bubble_detected = true),
    correct_number_of_main_characters = false,
    twin_distinction_ok = false,
    safety_ok = false.
- "regeneration_instruction" is a short, concrete fix the illustrator should apply. If banned_content_detected is non-empty, the instruction MUST start with "Remove: <list>". If any framing-crop flag is true, the instruction MUST start with "Reframe: " and name exactly which parts (head, hair, face, feet, hands) must be brought fully inside the frame with comfortable padding.
- "artifact_issues" lists visible defects (extra fingers, warped face, etc).
- "composition_issues" lists image-framing problems. Cropped-off head/hair/face/feet/hands is ALWAYS a regeneration issue unless extreme_close_up_requested is true — and even then, head and face must remain fully inside the frame with padding.
- "missing_required_elements" lists items from the must-include list that are absent.`;
}

const REQUIRED_KEYS = [
  "character_likeness_score",
  "style_consistency_score",
  "scene_accuracy_score",
  "age_appropriateness_score",
  "age_appropriateness_issues",
  "correct_number_of_main_characters",
  "twin_distinction_ok",
  "safety_ok",
  "artifact_issues",
  "composition_issues",
  "missing_required_elements",
  "regeneration_recommended",
  "regeneration_instruction",
];

function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map(String) : [];
}

function clamp01(n: unknown, fallback = 0): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(0, Math.min(1, x));
}

export function validate(
  obj: any,
  opts: { styleKey?: string } = {},
): { ok: true; data: any } | { ok: false; error: string } {
  if (!obj || typeof obj !== "object") return { ok: false, error: "Not an object" };
  for (const k of REQUIRED_KEYS) {
    if (!(k in obj)) return { ok: false, error: `Missing key: ${k}` };
  }
  const styleKey = opts.styleKey ?? "";
  const character_likeness_score = clamp01(obj.character_likeness_score);
  const character_consistency_score = clamp01(
    obj.character_consistency_score,
    character_likeness_score,
  );
  const scene_accuracy_score = clamp01(obj.scene_accuracy_score);
  const scene_match_score = clamp01(obj.scene_match_score, scene_accuracy_score);
  const cleaned = {
    character_likeness_score,
    character_consistency_score,
    cover_match_score: clamp01(obj.cover_match_score, 1),
    style_consistency_score: clamp01(obj.style_consistency_score),
    scene_accuracy_score,
    scene_match_score,
    age_appropriateness_score: clamp01(obj.age_appropriateness_score),
    age_appropriateness_issues: arr(obj.age_appropriateness_issues),
    correct_number_of_main_characters: Boolean(obj.correct_number_of_main_characters),
    twin_distinction_ok: Boolean(obj.twin_distinction_ok),
    safety_ok: Boolean(obj.safety_ok),
    speech_bubble_detected: Boolean(obj.speech_bubble_detected),
    text_inside_image_detected: Boolean(obj.text_inside_image_detected),
    banned_content_detected: arr(obj.banned_content_detected),
    missing_required_character_details: arr(obj.missing_required_character_details),
    wrong_character_details: arr(obj.wrong_character_details),
    artifact_issues: arr(obj.artifact_issues),
    composition_issues: arr(obj.composition_issues),
    head_cropped: Boolean(obj.head_cropped),
    hair_cropped: Boolean(obj.hair_cropped),
    face_cropped: Boolean(obj.face_cropped),
    feet_cropped: Boolean(obj.feet_cropped),
    hands_cropped: Boolean(obj.hands_cropped),
    extreme_close_up_requested: Boolean(obj.extreme_close_up_requested),
    safe_framing_ok: obj.safe_framing_ok === undefined ? true : Boolean(obj.safe_framing_ok),
    missing_required_elements: arr(obj.missing_required_elements),
    regeneration_recommended: Boolean(obj.regeneration_recommended),
    needs_regeneration: Boolean(obj.needs_regeneration ?? obj.regeneration_recommended),
    regeneration_instruction: typeof obj.regeneration_instruction === "string" ? obj.regeneration_instruction : "",
  };

  // Safe-framing hard gate: head/hair/face cropping is ALWAYS a fail (unless
  // an extreme close-up was explicitly requested, in which case the head/face
  // must still be the deliberate subject — partial crops are still rejected).
  // Feet cropping fails when the scene is a full-body / standing pose.
  const headFaceCropped = cleaned.head_cropped || cleaned.hair_cropped || cleaned.face_cropped;
  const feetCropFails = cleaned.feet_cropped && !cleaned.extreme_close_up_requested;
  const framingFail = headFaceCropped || feetCropFails || cleaned.safe_framing_ok === false;
  if (framingFail) {
    cleaned.safe_framing_ok = false;
    // Surface a concrete composition_issues entry so downstream consumers
    // (review UI, regen instruction) see why the page failed.
    const parts: string[] = [];
    if (cleaned.head_cropped) parts.push("top of head cropped at frame edge");
    if (cleaned.hair_cropped) parts.push("hair cropped at frame edge");
    if (cleaned.face_cropped) parts.push("face cropped at frame edge");
    if (feetCropFails) parts.push("feet cut off in a full-body / standing pose");
    if (parts.length && !cleaned.composition_issues.some((c) => /crop|cut off/i.test(c))) {
      cleaned.composition_issues = [...cleaned.composition_issues, ...parts];
    }
  }

  // Server-side regeneration policy. Bad/conflicting model output cannot
  // slip a low-quality page through. Character consistency, cover match,
  // age fitness, parent-banned content, safe framing, and (for comics)
  // speech bubbles are hard gates.
  const lowScore =
    cleaned.character_consistency_score < 0.88 ||
    cleaned.cover_match_score < 0.85 ||
    cleaned.style_consistency_score < 0.85 ||
    cleaned.scene_match_score < 0.85 ||
    cleaned.age_appropriateness_score < 0.95;
  const failedFlags =
    !cleaned.correct_number_of_main_characters ||
    !cleaned.twin_distinction_ok ||
    !cleaned.safety_ok ||
    cleaned.text_inside_image_detected ||
    cleaned.composition_issues.length > 0 ||
    !cleaned.safe_framing_ok ||
    framingFail ||
    cleaned.banned_content_detected.length > 0 ||
    (styleKey === "comic_book" && cleaned.speech_bubble_detected);
  if (lowScore || failedFlags) {
    cleaned.regeneration_recommended = true;
    cleaned.needs_regeneration = true;
    if (cleaned.banned_content_detected.length > 0) {
      const removeClause = `Remove: ${cleaned.banned_content_detected.join(", ")} (parent explicitly disallowed)`;
      cleaned.regeneration_instruction = cleaned.regeneration_instruction
        ? `${removeClause}. ${cleaned.regeneration_instruction}`
        : removeClause;
    } else if (framingFail) {
      const reframeParts: string[] = [];
      if (cleaned.head_cropped || cleaned.hair_cropped) reframeParts.push("full head and hair");
      if (cleaned.face_cropped) reframeParts.push("entire face");
      if (feetCropFails) reframeParts.push("both feet");
      if (cleaned.hands_cropped) reframeParts.push("hands");
      const subject = reframeParts.length ? reframeParts.join(", ") : "child's full head and body";
      const reframeClause = `Reframe: bring the ${subject} fully inside the frame with comfortable padding; do not crop the top of the head or the feet in a standing pose.`;
      cleaned.regeneration_instruction = cleaned.regeneration_instruction
        ? `${reframeClause} ${cleaned.regeneration_instruction}`
        : reframeClause;
    }
  }

  return { ok: true, data: cleaned };
}

async function signed(admin: any, bucket: string, path: string): Promise<string | null> {
  const { data } = await admin.storage.from(bucket).createSignedUrl(path, 60 * 5);
  return data?.signedUrl ?? null;
}

async function resolveImageRef(admin: any, bucket: string, value: unknown): Promise<string | undefined> {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw) || raw.startsWith("data:")) return raw;
  return (await signed(admin, bucket, raw)) ?? undefined;
}

/**
 * Synonym / compound-form expansion for parent-banned terms. The goal is to
 * reduce false negatives where the model sees "balloon animals" but the
 * parent only wrote "balloons". Keys are lowercased canonical roots; values
 * are extra surface forms to surface to the vision model.
 *
 * This is intentionally conservative — only well-known compound/plural/visual
 * variants of the same underlying object. We do NOT add unrelated items
 * (a lantern is not a balloon) to avoid false positives.
 */
const BANNED_SYNONYM_MAP: Record<string, string[]> = {
  balloon: ["balloons", "balloon animal", "balloon animals", "water balloon", "water balloons", "hot air balloon", "hot-air balloon", "balloon arch", "party balloon", "party balloons", "helium balloon"],
  snake: ["snakes", "serpent", "serpents", "python", "boa", "cobra", "viper"],
  spider: ["spiders", "tarantula", "tarantulas", "arachnid", "arachnids", "spider web", "cobweb"],
  clown: ["clowns", "jester", "harlequin"],
  gun: ["guns", "pistol", "rifle", "handgun", "firearm", "firearms", "shotgun", "toy gun", "water gun"],
  knife: ["knives", "blade", "dagger", "switchblade"],
  sword: ["swords", "saber", "katana", "cutlass"],
  blood: ["bleeding", "bloody", "gore"],
  fire: ["fires", "flame", "flames", "bonfire", "campfire"],
  smoking: ["cigarette", "cigarettes", "cigar", "vape", "vaping", "pipe smoking"],
  alcohol: ["beer", "wine", "liquor", "cocktail", "drinking glass with alcohol"],
  monster: ["monsters", "creature", "beast", "demon"],
  ghost: ["ghosts", "specter", "phantom", "spirit"],
  witch: ["witches", "warlock", "sorceress"],
  skull: ["skulls", "skeleton", "skeletons", "bones"],
  bee: ["bees", "wasp", "wasps", "hornet", "hornets"],
  dog: ["dogs", "puppy", "puppies"],
  cat: ["cats", "kitten", "kittens"],
};

function singularize(s: string): string {
  const lower = s.toLowerCase();
  if (lower.endsWith("ies") && lower.length > 4) return lower.slice(0, -3) + "y";
  if (lower.endsWith("ses") || lower.endsWith("xes") || lower.endsWith("zes")) return lower.slice(0, -2);
  if (lower.endsWith("s") && !lower.endsWith("ss") && lower.length > 3) return lower.slice(0, -1);
  return lower;
}

function expandBannedTerm(term: string): string[] {
  const out = new Set<string>();
  const original = term.trim();
  if (!original) return [];
  out.add(original);
  const lower = original.toLowerCase();
  out.add(lower);
  const root = singularize(lower);
  if (BANNED_SYNONYM_MAP[root]) {
    for (const v of BANNED_SYNONYM_MAP[root]) out.add(v);
  }
  // Also include keyed compound entries where the root appears as a token
  // (e.g. parent typed "balloon animals" → root "balloon animal" → fall back
  // to the "balloon" group).
  for (const key of Object.keys(BANNED_SYNONYM_MAP)) {
    if (lower.split(/\s+/).includes(key) || lower.split(/\s+/).includes(key + "s")) {
      for (const v of BANNED_SYNONYM_MAP[key]) out.add(v);
    }
  }
  return Array.from(out);
}

/**
 * Map each detected item back to the canonical banned term the parent wrote,
 * when the model returned a synonym/variant instead. Falls back to the raw
 * detected string if no group matches.
 */
function normalizeDetectedBanned(
  detected: unknown[],
  groups: { canonical: string; variants: string[] }[],
): string[] {
  const out = new Set<string>();
  for (const item of detected) {
    if (typeof item !== "string") continue;
    const lower = item.trim().toLowerCase();
    if (!lower) continue;
    let mapped: string | null = null;
    for (const g of groups) {
      if (g.variants.some((v) => v.toLowerCase() === lower || lower.includes(v.toLowerCase()))) {
        mapped = g.canonical;
        break;
      }
    }
    out.add(mapped ?? item.trim());
  }
  return Array.from(out);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const { user, admin } = await requireUser(req);
    const body = await req.json();
    const {
      bookId,
      pageNumber,
      sceneDescription,
      charactersPresent,
      visualMustHaves,
      visualMustNotInclude,
      childDetails,
      isTwins,
      characterSheetUrl,
      pageImageUrl,
      readingLevel,
    } = body ?? {};

    if (!bookId) return errorResponse("bookId is required");
    if (!Number.isInteger(pageNumber) || pageNumber < 1) return errorResponse("pageNumber must be a positive integer");
    if (typeof sceneDescription !== "string" || !sceneDescription.trim()) {
      return errorResponse("sceneDescription is required");
    }

    // Verify book ownership and pull reading_level so we can score against the
    // child's actual age band rather than a generic "kid safe" standard.
    const { data: book, error: bookErr } = await admin
      .from("books")
      .select("id, user_id, is_twins, child_name, child_age, child_pronouns, child_loves, details_include, details_avoid, reading_level, art_style, visual_consistency_contract, cover_image_path, cover_url")
      .eq("id", bookId)
      .maybeSingle();
    if (bookErr) return errorResponse(bookErr.message, 500);
    if (!book || book.user_id !== user.id) return errorResponse("Book not found or forbidden", 403);
    const styleKey = String(book.art_style ?? "");

    const lvl = String(readingLevel ?? book.reading_level ?? "ages_4_6");
    const ageBand =
      lvl === "ages_2_3" || lvl === "ages_3_5" ? "2-3" :
      lvl === "ages_7_10" || lvl === "ages_6_8" ? "7-10" :
      "4-6";

    // Resolve page image URL.
    let pageUrl = await resolveImageRef(admin, "generated-pages", pageImageUrl);
    let pageRow: any = null;
    if (!pageUrl) {
      const { data: page } = await admin
        .from("book_pages")
        .select("id, image_storage_path")
        .eq("book_id", bookId)
        .eq("page_number", pageNumber)
        .maybeSingle();
      pageRow = page;
      if (page?.image_storage_path) {
        pageUrl = (await signed(admin, "generated-pages", page.image_storage_path)) ?? undefined;
      }
    }
    if (!pageUrl) return errorResponse("No page image found for this page", 412);

    // Resolve character sheet URL.
    let sheetUrl = await resolveImageRef(admin, "character-sheets", characterSheetUrl);
    if (!sheetUrl) {
      const { data: sheet } = await admin
        .from("character_sheets")
        .select("image_url, approved")
        .eq("book_id", bookId)
        .eq("approved", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const sheetVal = sheet?.image_url ?? undefined;
      if (sheetVal) {
        sheetUrl = await resolveImageRef(admin, "character-sheets", sheetVal);
      }
    }
    if (!sheetUrl) return errorResponse("No approved character sheet found for this book", 412);

    // Resolve optional cover image (secondary canonical look).
    let coverUrl: string | undefined;
    if (book.cover_image_path) {
      coverUrl = await resolveImageRef(admin, "generated-pages", book.cover_image_path);
    } else if (book.cover_url) {
      coverUrl = await resolveImageRef(admin, "generated-pages", book.cover_url);
    }

    // Resolve previous approved page as a continuity reference for outfit,
    // hairstyle, palette, and character proportions across adjacent scenes.
    let prevPageUrl: string | undefined;
    const { data: prevPage } = await admin
      .from("book_pages")
      .select("image_storage_path")
      .eq("book_id", bookId)
      .lt("page_number", pageNumber)
      .eq("status", "ready")
      .not("image_storage_path", "is", null)
      .order("page_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prevPage?.image_storage_path) {
      prevPageUrl = await resolveImageRef(admin, "generated-pages", prevPage.image_storage_path);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return errorResponse("LOVABLE_API_KEY not configured", 500);

    const childSummary = childDetails ?? [
      book.child_name && `Name: ${book.child_name}`,
      book.child_age && `Age: ${book.child_age}`,
      book.child_pronouns && `Pronouns: ${book.child_pronouns}`,
      book.child_loves && `Loves: ${book.child_loves}`,
      book.details_include && `Include: ${book.details_include}`,
      book.details_avoid && `Avoid: ${book.details_avoid}`,
    ].filter(Boolean).join("\n");

    const contractJson = book.visual_consistency_contract
      ? JSON.stringify(book.visual_consistency_contract)
      : "(none)";

    // Explicit BANNED CONTENT list = parent's details_avoid + the page's
    // per-scene must-not-include. The vision model is asked to flag each
    // visibly present item by name so the orchestrator can regenerate.
    const parentAvoid = typeof book.details_avoid === "string" && book.details_avoid.trim()
      ? book.details_avoid.split(/[,;\n]+/).map((s: string) => s.trim()).filter(Boolean)
      : [];
    const sceneAvoid = arr(visualMustNotInclude);
    const bannedList = Array.from(new Set([...parentAvoid, ...sceneAvoid]));
    // Expand each banned term with common synonyms / compound variants so the
    // vision model catches things like "balloon animals" when parent said
    // "balloons". The canonical term stays first; the model is asked to
    // report whichever variant is visible.
    const bannedGroups = bannedList.map((term) => ({
      canonical: term,
      variants: expandBannedTerm(term),
    }));
    const bannedListText = bannedGroups.length
      ? bannedGroups
          .map((g) =>
            g.variants.length > 1
              ? `- ${g.canonical} (also flag: ${g.variants.slice(1).join(", ")})`
              : `- ${g.canonical}`,
          )
          .join("\n")
      : "- (none)";

    const userText = [
      `Required scene: ${sceneDescription}`,
      `Art style key: ${styleKey}`,
      `Target age band: ${ageBand} (score age_appropriateness against this band specifically, NOT a generic "kid safe" standard)`,
      `Characters that should be present: ${arr(charactersPresent).join(", ") || "(main character only)"}`,
      `Must include: ${arr(visualMustHaves).join(", ") || "(none)"}`,
      `BANNED CONTENT (parent-disallowed + scene-disallowed). Flag each visibly present item by its CANONICAL name in "banned_content_detected", even if you see only a synonym, compound form, plural/singular, or close visual variant. Examples: "balloons" covers "balloon animals", "water balloons", "balloon arch", "hot-air balloon"; "snakes" covers "serpents", "boa", "python"; "guns" covers "pistol", "rifle", "toy gun". Do NOT flag items that are only thematically similar (e.g. a round lantern is not a balloon).\n${bannedListText}`,
      `Twins book: ${(isTwins ?? book.is_twins) ? "yes — twins must remain visually distinguishable" : "no"}`,
      `Parent-provided child details:\n${childSummary || "(none)"}`,
      `Visual consistency contract (JSON): ${contractJson}`,
      "",
      `Image order: Image 1 = approved character sheet.${coverUrl ? " Image 2 = approved cover." : ""}${prevPageUrl ? ` Image ${coverUrl ? 3 : 2} = previous approved story page continuity reference.` : ""} Image ${1 + (coverUrl ? 1 : 0) + (prevPageUrl ? 1 : 0) + 1} = generated page image to validate.`,
      "Score the page against the sheet, the cover if provided, the previous page if provided, the contract, the scene, the parent details, the style, the age band, and the BANNED CONTENT list. Return strict JSON only.",
    ].join("\n");

    const validatorContent: any[] = [
      { type: "text", text: userText },
      { type: "image_url", image_url: { url: sheetUrl } },
    ];
    if (coverUrl) validatorContent.push({ type: "image_url", image_url: { url: coverUrl } });
    if (prevPageUrl) validatorContent.push({ type: "image_url", image_url: { url: prevPageUrl } });
    validatorContent.push({ type: "image_url", image_url: { url: pageUrl } });

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSystemPrompt(ageBand, styleKey, !!coverUrl, !!prevPageUrl) },
          { role: "user", content: validatorContent },
        ],
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      if (aiRes.status === 429) return errorResponse("Rate limit exceeded, try again shortly", 429);
      if (aiRes.status === 402) return errorResponse("AI credits exhausted", 402);
      return errorResponse(`AI gateway error: ${text}`, 502);
    }

    const payload = await aiRes.json();
    const raw: string = payload?.choices?.[0]?.message?.content ?? "";
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch (e) {
        return errorResponse(`Validator did not return valid JSON: ${(e as Error).message}`, 502);
      }
    }

    // Map any synonym/variant the model reported back to the canonical
    // banned term the parent originally wrote. This keeps regeneration
    // instructions and persisted notes aligned with the user-facing wording.
    if (Array.isArray(parsed?.banned_content_detected)) {
      parsed.banned_content_detected = normalizeDetectedBanned(
        parsed.banned_content_detected,
        bannedGroups,
      );
    }

    const check = validate(parsed, { styleKey });
    if (!check.ok) return errorResponse(`Validator schema check failed: ${check.error}`, 502);
    const report = check.data;

    // Persist QC outcome onto the page row. Aggregate now includes age fitness.
    const aggregateScore =
      (report.character_likeness_score +
        report.style_consistency_score +
        report.scene_accuracy_score +
        report.age_appropriateness_score) / 4;
    const reviewNotes = [
      report.regeneration_instruction,
      report.age_appropriateness_score < 0.85
        ? `Age-fit (band ${ageBand}) ${report.age_appropriateness_score.toFixed(2)}: ${report.age_appropriateness_issues.join("; ") || "below threshold"}`
        : "",
      report.artifact_issues.length ? `Artifacts: ${report.artifact_issues.join("; ")}` : "",
      report.composition_issues.length ? `Composition: ${report.composition_issues.join("; ")}` : "",
      report.missing_required_elements.length ? `Missing: ${report.missing_required_elements.join("; ")}` : "",
    ].filter(Boolean).join(" | ") || null;

    const qualityMetadata = {
      age_band: ageBand,
      reading_level: lvl,
      scores: {
        character_likeness: report.character_likeness_score,
        style_consistency: report.style_consistency_score,
        scene_accuracy: report.scene_accuracy_score,
        age_appropriateness: report.age_appropriateness_score,
        aggregate: Number(aggregateScore.toFixed(4)),
      },
      flags: {
        correct_number_of_main_characters: report.correct_number_of_main_characters,
        twin_distinction_ok: report.twin_distinction_ok,
        safety_ok: report.safety_ok,
        regeneration_recommended: report.regeneration_recommended,
      },
      age_appropriateness_issues: report.age_appropriateness_issues,
      artifact_issues: report.artifact_issues,
      composition_issues: report.composition_issues,
      missing_required_elements: report.missing_required_elements,
      wrong_character_details: report.wrong_character_details,
      missing_required_character_details: report.missing_required_character_details,
      banned_content_detected: report.banned_content_detected,
      regeneration_instruction: report.regeneration_instruction,
      validated_at: new Date().toISOString(),
    };

    const { error: updErr } = await admin
      .from("book_pages")
      .update({
        quality_score: Number((aggregateScore * 100).toFixed(2)),
        needs_review: report.regeneration_recommended,
        review_notes: reviewNotes,
        quality_metadata: qualityMetadata,
      })
      .eq("book_id", bookId)
      .eq("page_number", pageNumber);
    if (updErr) console.warn("validate-page persist warning:", updErr.message);

    return jsonResponse({ ok: true, bookId, pageNumber, ageBand, report });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("validate-page error", e);
    return errorResponse(e?.message ?? "Internal error", 500);
  }
});
