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

function buildSystemPrompt(ageBand: string): string {
  return `You are validating a personalized children's storybook page for a child in the age band ${ageBand}.

Compare:
1. The approved character sheet.
2. The generated page image.
3. The required page scene.
4. The parent-provided child details.

Return STRICT JSON only — no markdown, no commentary — matching this schema exactly:

{
  "character_likeness_score": 0,
  "style_consistency_score": 0,
  "scene_accuracy_score": 0,
  "age_appropriateness_score": 0,
  "age_appropriateness_issues": [],
  "correct_number_of_main_characters": true,
  "twin_distinction_ok": true,
  "safety_ok": true,
  "artifact_issues": [],
  "missing_required_elements": [],
  "regeneration_recommended": false,
  "regeneration_instruction": ""
}

Scoring rules:
- All four scores are floats from 0.0 to 1.0.
- "age_appropriateness_score" judges BOTH the page text (if any is implied by the scene) and the image specifically against ages ${ageBand}, NOT a generic "kid safe" standard. Score lower for: scary/peril imagery, weapons, injury/blood/gore, body-horror, romantic or suggestive framing, mature themes, unsafe activities depicted approvingly, or vocabulary/conflict outside the band.
  - Ages 2-3: any peril, scary creatures, darkness, weapons, or injury -> max 0.5.
  - Ages 4-6: weapons, injury, scary monsters, romantic framing, shame/punishment imagery -> max 0.6.
  - Ages 7-10: gore, sexual/romantic content, realistic violence, weapons used to harm, substance use, self-harm -> max 0.5.
- "age_appropriateness_issues" lists concrete reasons the score was reduced (or [] if 1.0).
- safety_ok = false if there is anything genuinely unsafe in the image regardless of age.
- Recommend regeneration (regeneration_recommended = true) if character_likeness_score, style_consistency_score, or scene_accuracy_score is below 0.85, OR age_appropriateness_score is below 0.85, OR if the wrong number of main characters appears, OR twin_distinction_ok is false, OR safety_ok is false.
- "regeneration_instruction" is a short, concrete fix the illustrator should apply
  (e.g. "Restore the red striped scarf and match hair length to the character sheet"; or "Remove the sword — replace with a wooden walking stick to stay age-appropriate for ${ageBand}").
  Empty string if no regeneration is needed.
- "artifact_issues" lists visible defects (extra fingers, warped face, text in image, etc).
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
  "missing_required_elements",
  "regeneration_recommended",
  "regeneration_instruction",
];

function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map(String) : [];
}

function clamp01(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

export function validate(obj: any): { ok: true; data: any } | { ok: false; error: string } {
  if (!obj || typeof obj !== "object") return { ok: false, error: "Not an object" };
  for (const k of REQUIRED_KEYS) {
    if (!(k in obj)) return { ok: false, error: `Missing key: ${k}` };
  }
  const cleaned = {
    character_likeness_score: clamp01(obj.character_likeness_score),
    style_consistency_score: clamp01(obj.style_consistency_score),
    scene_accuracy_score: clamp01(obj.scene_accuracy_score),
    age_appropriateness_score: clamp01(obj.age_appropriateness_score),
    age_appropriateness_issues: arr(obj.age_appropriateness_issues),
    correct_number_of_main_characters: Boolean(obj.correct_number_of_main_characters),
    twin_distinction_ok: Boolean(obj.twin_distinction_ok),
    safety_ok: Boolean(obj.safety_ok),
    artifact_issues: arr(obj.artifact_issues),
    missing_required_elements: arr(obj.missing_required_elements),
    regeneration_recommended: Boolean(obj.regeneration_recommended),
    regeneration_instruction: typeof obj.regeneration_instruction === "string" ? obj.regeneration_instruction : "",
  };

  // Enforce the regeneration policy server-side too, so bad/conflicting model output
  // can't slip a low-quality page through. Age-appropriateness is a hard gate.
  const lowScore =
    cleaned.character_likeness_score < 0.85 ||
    cleaned.style_consistency_score < 0.85 ||
    cleaned.scene_accuracy_score < 0.85 ||
    cleaned.age_appropriateness_score < 0.85;
  const failedFlags = !cleaned.correct_number_of_main_characters || !cleaned.twin_distinction_ok || !cleaned.safety_ok;
  if (lowScore || failedFlags) cleaned.regeneration_recommended = true;

  return { ok: true, data: cleaned };
}

async function signed(admin: any, bucket: string, path: string): Promise<string | null> {
  const { data } = await admin.storage.from(bucket).createSignedUrl(path, 60 * 5);
  return data?.signedUrl ?? null;
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
      .select("id, user_id, is_twins, child_name, child_age, child_pronouns, child_loves, details_include, details_avoid, reading_level")
      .eq("id", bookId)
      .maybeSingle();
    if (bookErr) return errorResponse(bookErr.message, 500);
    if (!book || book.user_id !== user.id) return errorResponse("Book not found or forbidden", 403);

    const lvl = String(readingLevel ?? book.reading_level ?? "ages_4_6");
    const ageBand =
      lvl === "ages_2_3" || lvl === "ages_3_5" ? "2-3" :
      lvl === "ages_7_10" || lvl === "ages_6_8" ? "7-10" :
      "4-6";

    // Resolve page image URL.
    let pageUrl = pageImageUrl as string | undefined;
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
    let sheetUrl = characterSheetUrl as string | undefined;
    if (!sheetUrl) {
      const { data: sheet } = await admin
        .from("character_sheets")
        .select("image_url, approved")
        .eq("book_id", bookId)
        .eq("approved", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      sheetUrl = sheet?.image_url ?? undefined;
    }
    if (!sheetUrl) return errorResponse("No approved character sheet found for this book", 412);

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

    const userText = [
      `Required scene: ${sceneDescription}`,
      `Target age band: ${ageBand} (score age_appropriateness against this band specifically, NOT a generic "kid safe" standard)`,
      `Characters that should be present: ${arr(charactersPresent).join(", ") || "(main character only)"}`,
      `Must include: ${arr(visualMustHaves).join(", ") || "(none)"}`,
      `Must NOT include: ${arr(visualMustNotInclude).join(", ") || "(none)"}`,
      `Twins book: ${(isTwins ?? book.is_twins) ? "yes" : "no"}`,
      `Parent-provided child details:\n${childSummary || "(none)"}`,
      "",
      "Image 1 = approved character sheet. Image 2 = generated page image. Score the page against the sheet, the scene, the parent details, and the age band. Return strict JSON only.",
    ].join("\n");

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
          { role: "system", content: buildSystemPrompt(ageBand) },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: sheetUrl } },
              { type: "image_url", image_url: { url: pageUrl } },
            ],
          },
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

    const check = validate(parsed);
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
      missing_required_elements: report.missing_required_elements,
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
