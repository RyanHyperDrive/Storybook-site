#!/usr/bin/env node
/**
 * Visual regression for the /examples page (desktop + mobile).
 *
 * Captures hero + gallery screenshots and asserts:
 *   - H1 visible
 *   - "Custom cover + dedication + 10 story pages" visible
 *   - "ages 4–7" visible
 *   - At least 3 gallery cards rendered
 *   - No "Pixel" art-style text and no "Quinn" sample is present
 *
 * Usage:
 *   PREVIEW_URL=http://localhost:8080 node scripts/visual-regression-examples.mjs
 *
 * Requires playwright: `bunx playwright install chromium` once.
 * Screenshots saved to ./visual-regression/examples/.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const URL = (process.env.PREVIEW_URL || "http://localhost:8080").replace(/\/$/, "");
const OUT = resolve("visual-regression", "examples");
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];

async function runOne(browser, vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  const failures = [];
  try {
    await page.goto(URL + "/examples", { waitUntil: "networkidle" });

    if (!(await page.getByRole("heading", { level: 1 }).first().isVisible())) {
      failures.push(`${vp.name}: H1 not visible`);
    }

    const included = page.locator('[data-testid="examples-included"]');
    await included.waitFor({ state: "visible", timeout: 10_000 });

    if ((await included.getByText(/Custom cover \+ dedication \+ 10 story pages/i).count()) === 0) {
      failures.push(`${vp.name}: missing "Custom cover + dedication + 10 story pages"`);
    }
    if ((await included.getByText(/ages\s*4[\u2013-]7/i).count()) === 0) {
      failures.push(`${vp.name}: missing "ages 4–7" copy`);
    }

    const gallery = page.locator('[data-testid="examples-gallery"]');
    await gallery.scrollIntoViewIfNeeded();
    const cardCount = await gallery.locator('[data-testid^="example-card-"]').count();
    if (cardCount < 3) {
      failures.push(`${vp.name}: expected ≥3 example cards, found ${cardCount}`);
    }

    // Forbidden: pixel style + Quinn pixel sample must be gone everywhere on the page.
    const bodyText = (await page.locator("body").innerText()).toLowerCase();
    if (/\bpixel\b/.test(bodyText)) {
      failures.push(`${vp.name}: "Pixel" copy still present on /examples`);
    }
    if (/\bquinn\b/.test(bodyText)) {
      failures.push(`${vp.name}: "Quinn" sample still present on /examples`);
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    await page.screenshot({ path: resolve(OUT, `examples-fold-${vp.name}.png`), fullPage: false });
    await page.screenshot({ path: resolve(OUT, `examples-full-${vp.name}.png`), fullPage: true });
    await gallery.screenshot({ path: resolve(OUT, `examples-gallery-${vp.name}.png`) });
    console.log(`✓ ${vp.name} → fold + full + gallery captured (${cardCount} cards)`);
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
console.log(`\nAll /examples regression checks passed. Screenshots: ${OUT}`);
