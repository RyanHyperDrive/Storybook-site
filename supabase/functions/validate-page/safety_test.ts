// Tests the server-side regeneration policy + age-appropriateness gate in the
// validator. We don't call the AI gateway here — we feed synthetic model
// outputs into validate() and assert the policy enforces the right outcome
// per age band. Run with: supabase--test_edge_functions { functions: ["validate-page"] }

import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { validate } from "./index.ts";

function baseReport(overrides: Record<string, unknown> = {}) {
  return {
    character_likeness_score: 0.95,
    style_consistency_score: 0.95,
    scene_accuracy_score: 0.95,
    age_appropriateness_score: 0.95,
    age_appropriateness_issues: [],
    correct_number_of_main_characters: true,
    twin_distinction_ok: true,
    safety_ok: true,
    artifact_issues: [],
    missing_required_elements: [],
    regeneration_recommended: false,
    regeneration_instruction: "",
    ...overrides,
  };
}

Deno.test("clean page passes — no regeneration", () => {
  const r = validate(baseReport());
  if (!r.ok) throw new Error(r.error);
  assertEquals(r.data.regeneration_recommended, false);
});

Deno.test("ages 2-3: scary villain forces regeneration", () => {
  // Per system prompt, ages 2-3 with peril/scary creatures caps score at 0.5.
  const r = validate(baseReport({
    age_appropriateness_score: 0.45,
    age_appropriateness_issues: ["scary villain looming over child", "dark menacing forest"],
  }));
  if (!r.ok) throw new Error(r.error);
  assertEquals(r.data.regeneration_recommended, true);
  assertEquals(r.data.age_appropriateness_score < 0.85, true);
});

Deno.test("ages 4-6: weapons / graphic danger / shame cap below threshold", () => {
  const r = validate(baseReport({
    age_appropriateness_score: 0.55,
    age_appropriateness_issues: ["sword visible in scene", "child being scolded with finger pointing"],
  }));
  if (!r.ok) throw new Error(r.error);
  assertEquals(r.data.regeneration_recommended, true);
});

Deno.test("ages 7-10: gore / realistic violence / unsafe instructions fail", () => {
  const r = validate(baseReport({
    age_appropriateness_score: 0.4,
    age_appropriateness_issues: ["visible blood on arm", "child climbing alone on cliff edge"],
  }));
  if (!r.ok) throw new Error(r.error);
  assertEquals(r.data.regeneration_recommended, true);
});

Deno.test("safety_ok=false always forces regeneration even with high scores", () => {
  const r = validate(baseReport({ safety_ok: false }));
  if (!r.ok) throw new Error(r.error);
  assertEquals(r.data.regeneration_recommended, true);
});

Deno.test("missing required age-fit field rejects payload", () => {
  const bad = baseReport();
  // deno-lint-ignore no-explicit-any
  delete (bad as any).age_appropriateness_score;
  const r = validate(bad);
  assertEquals(r.ok, false);
});

Deno.test("borderline 0.85 scores do NOT force regeneration", () => {
  const r = validate(baseReport({
    character_likeness_score: 0.85,
    style_consistency_score: 0.85,
    scene_accuracy_score: 0.85,
    age_appropriateness_score: 0.85,
  }));
  if (!r.ok) throw new Error(r.error);
  assertEquals(r.data.regeneration_recommended, false);
});

// --- Sample modal contract tests (string-level guardrails) -------------

Deno.test("sample modal: no exact page-count promise", async () => {
  const src = await Deno.readTextFile(
    new URL("../../../src/components/sample-book-modal.tsx", import.meta.url),
  );
  if (/of\s*10/i.test(src)) throw new Error("sample modal still contains 'of 10' page-count language");
  if (/PAGE\s+\d+\s+OF\s+\d+/i.test(src)) throw new Error("sample modal still contains 'PAGE N OF M'");
});

Deno.test("sample modal: distinct cover / page_1 / page_2 assets per style", async () => {
  const src = await Deno.readTextFile(
    new URL("../../../src/components/sample-book-modal.tsx", import.meta.url),
  );
  // For each of the 4 styles we expect 3 distinct asset imports (cover + 2 pages).
  for (const stem of ["comic-nova", "cartoon-leo", "watercolor-pip", "manga-yuki", "pixel-quinn"]) {
    const refs = new Set<string>();
    const re = new RegExp(`sample-${stem}(?:-page1|-page2)?\\.jpg`, "g");
    for (const m of src.matchAll(re)) refs.add(m[0]);
    if (refs.size < 3) {
      throw new Error(`Style ${stem} reuses fallback assets; expected cover + page1 + page2 (got ${refs.size})`);
    }
  }
});
