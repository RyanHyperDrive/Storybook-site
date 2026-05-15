#!/usr/bin/env node
/**
 * Visual regression for the full /create wizard journey:
 *
 *   /create/profile         (auth-optional — renders the form for guests)
 *   /create/photos          (auth-gated — renders SignInPanel for guests)
 *   /create/story           (auth-gated)
 *   /create/style           (auth-gated)
 *   /create/character-sheet (auth-gated)
 *
 * For each route, at desktop (1280) and mobile (390):
 *   - navigate, wait for either the wizard layout or the auth gate to render,
 *   - assert the page rendered SOMETHING meaningful (no blank screen / runtime
 *     error / missing nav),
 *   - capture a full-page screenshot for visual diffing.
 *
 * Auth-gated routes are expected to render the SignInPanel
 * (`[data-testid="auth-gate"]`) when this runs unauthenticated. That is still
 * valuable regression coverage: it catches the gate, page chrome, and route
 * loader from breaking.
 *
 * Usage:
 *   PREVIEW_URL=http://localhost:8080 node scripts/visual-regression-create-journey.mjs
 *
 * Requires playwright: `bunx playwright install chromium` once.
 * Screenshots saved to ./visual-regression/create-journey/.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const URL = (process.env.PREVIEW_URL || "http://localhost:8080").replace(/\/$/, "");
const OUT = resolve("visual-regression", "create-journey");
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];

/**
 * Each step lists the route + which container it should render unauthenticated.
 *   - "wizard": should always show WizardLayout (profile is auth-optional)
 *   - "either": should show wizard layout OR the auth gate
 */
const STEPS = [
  { slug: "profile",         path: "/create/profile",         expect: "wizard" },
  { slug: "photos",          path: "/create/photos",          expect: "either" },
  { slug: "story",           path: "/create/story",           expect: "either" },
  { slug: "style",           path: "/create/style",           expect: "either" },
  { slug: "character-sheet", path: "/create/character-sheet", expect: "either" },
];

async function runOne(browser, vp, step) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  const failures = [];
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });

  try {
    await page.goto(`${URL}${step.path}`, { waitUntil: "networkidle" });

    const wizard = page.locator('[data-testid="wizard-layout"]');
    const gate = page.locator('[data-testid="auth-gate"]');

    // Wait for at least one to render.
    await Promise.race([
      wizard.waitFor({ state: "visible", timeout: 10_000 }).catch(() => null),
      gate.waitFor({ state: "visible", timeout: 10_000 }).catch(() => null),
    ]);

    const wizardVisible = await wizard.isVisible().catch(() => false);
    const gateVisible = await gate.isVisible().catch(() => false);

    if (step.expect === "wizard" && !wizardVisible) {
      failures.push(`${step.slug} @ ${vp.name}: expected wizard layout, none rendered`);
    }
    if (step.expect === "either" && !wizardVisible && !gateVisible) {
      failures.push(`${step.slug} @ ${vp.name}: neither wizard nor auth gate rendered`);
    }

    // Sanity: H1 present (both wizard pages and the sign-in panel render one)
    const h1Count = await page.getByRole("heading", { level: 1 }).count();
    if (h1Count === 0) {
      failures.push(`${step.slug} @ ${vp.name}: no <h1> on page`);
    }

    // Wizard-specific: stepper should expose all 5 steps
    if (wizardVisible) {
      const stepperItems = await page
        .locator('[data-testid="wizard-stepper"] li')
        .count();
      if (stepperItems !== 5) {
        failures.push(
          `${step.slug} @ ${vp.name}: stepper has ${stepperItems} items (need 5)`,
        );
      }
    }

    if (errors.length) {
      failures.push(
        `${step.slug} @ ${vp.name}: runtime errors:\n   ${errors.join("\n   ")}`,
      );
    }

    const file = resolve(OUT, `${step.slug}-${vp.name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`✓ ${step.slug} @ ${vp.name} → ${file}`);
  } catch (e) {
    failures.push(`${step.slug} @ ${vp.name}: ${e.message}`);
  } finally {
    await ctx.close();
  }
  return failures;
}

const browser = await chromium.launch();
const allFailures = [];
try {
  for (const vp of VIEWPORTS) {
    for (const step of STEPS) {
      const f = await runOne(browser, vp, step);
      allFailures.push(...f);
    }
  }
} finally {
  await browser.close();
}

if (allFailures.length) {
  console.error("\nFAILURES:\n" + allFailures.map((f) => " - " + f).join("\n"));
  process.exit(1);
}
console.log(`\nAll /create journey checks passed. Screenshots: ${OUT}`);
