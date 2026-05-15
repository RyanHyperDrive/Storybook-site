#!/usr/bin/env node
/**
 * Visual regression for the /create guided landing page.
 *
 * Captures full-section screenshots at desktop (1280) and mobile (390), and
 * asserts the key conversion-critical building blocks are present and visible:
 *   - Headline + primary CTA "Start free character preview"
 *   - $29.99 pricing line near the CTA
 *   - Trust grid (4 items: private photos, no model training, parent-approved,
 *     free regeneration)
 *   - "What happens after you start" pipeline strip
 *   - Journey preview panel (photo → character → book) with at least 3 images
 *   - 5 step cards
 *
 * Mobile-first viewport check: headline, CTA, and trust strip must be
 * rendered above the fold-equivalent (top ~1400px of mobile content).
 *
 * Usage:
 *   PREVIEW_URL=http://localhost:8080 node scripts/visual-regression-create.mjs
 *
 * Requires playwright: `bunx playwright install chromium` once.
 * Screenshots saved to ./visual-regression/create/.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const URL = (process.env.PREVIEW_URL || "http://localhost:8080").replace(/\/$/, "");
const OUT = resolve("visual-regression", "create");
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];

const TRUST_TEXTS = [
  /Private child photos/i,
  /Not used to train models/i,
  /Parent-approved character before payment/i,
  /Free regeneration if it looks off/i,
];

const PIPELINE_TEXTS = [
  /About child/i,
  /Photo upload/i,
  /Story \+ style/i,
  /Approve character/i,
  /Pay \(only now\)/i,
  /Ready in 10[–-]20 min/i,
];

async function runOne(browser, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  const failures = [];
  try {
    await page.goto(`${URL}/create`, { waitUntil: "networkidle" });
    await page.locator('[data-testid="create-landing"]').waitFor({ state: "visible", timeout: 10_000 });

    // Headline
    if (!(await page.getByRole("heading", { level: 1 }).first().isVisible())) {
      failures.push(`${vp.name}: H1 not visible`);
    }

    // Primary CTA — at least one visible
    const ctas = page.getByRole("link", { name: /Start free character preview/i });
    if ((await ctas.count()) === 0 || !(await ctas.first().isVisible())) {
      failures.push(`${vp.name}: primary CTA missing`);
    }

    // $29.99 line near CTA
    if ((await page.getByText(/\$29\.99/).count()) === 0) {
      failures.push(`${vp.name}: $29.99 pricing line missing`);
    }

    // Trust grid
    const trustGrid = page.locator('[data-testid="trust-grid"]');
    if (!(await trustGrid.isVisible())) {
      failures.push(`${vp.name}: trust grid not visible`);
    }
    for (const re of TRUST_TEXTS) {
      if ((await trustGrid.getByText(re).count()) === 0) {
        failures.push(`${vp.name}: trust grid missing item ${re}`);
      }
    }

    // Pipeline strip
    for (const re of PIPELINE_TEXTS) {
      if ((await page.getByText(re).count()) === 0) {
        failures.push(`${vp.name}: pipeline strip missing item ${re}`);
      }
    }

    // Journey preview panel + at least 3 images inside
    const journey = page.locator('[data-testid="journey-preview"]');
    if (!(await journey.isVisible())) {
      failures.push(`${vp.name}: journey preview not visible`);
    }
    const journeyImgs = await journey.locator("img").count();
    if (journeyImgs < 3) {
      failures.push(`${vp.name}: journey preview has only ${journeyImgs} images (need ≥3)`);
    }

    // 5 step cards
    const stepHeads = await page.getByText(/^Step [1-5]$/).count();
    if (stepHeads < 5) {
      failures.push(`${vp.name}: expected 5 step cards, found ${stepHeads}`);
    }

    // Mobile fold check — headline + CTA + trust grid live in the top portion.
    if (vp.name.startsWith("mobile")) {
      const headlineBox = await page.getByRole("heading", { level: 1 }).first().boundingBox();
      const ctaBox = await ctas.first().boundingBox();
      const trustBox = await trustGrid.boundingBox();
      const FOLD = 1400; // mobile-first: must be reachable without long scrolling
      for (const [label, box] of [["headline", headlineBox], ["CTA", ctaBox], ["trust grid", trustBox]]) {
        if (!box) {
          failures.push(`${vp.name}: ${label} has no bounding box`);
        } else if (box.y > FOLD) {
          failures.push(`${vp.name}: ${label} below mobile fold (y=${Math.round(box.y)})`);
        }
      }
    }

    // Full-page screenshot for diffing
    const file = resolve(OUT, `create-${vp.name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`✓ ${vp.name} → ${file}`);
  } finally {
    await ctx.close();
  }
  return failures;
}

const browser = await chromium.launch();
const allFailures = [];
try {
  for (const vp of VIEWPORTS) {
    try {
      const f = await runOne(browser, vp);
      allFailures.push(...f);
    } catch (e) {
      allFailures.push(`✗ ${vp.name}: ${e.message}`);
      console.error(`✗ ${vp.name}: ${e.message}`);
    }
  }
} finally {
  await browser.close();
}

if (allFailures.length) {
  console.error("\nFAILURES:\n" + allFailures.map((f) => " - " + f).join("\n"));
  process.exit(1);
}
console.log(`\nAll /create regression checks passed. Screenshots: ${OUT}`);
