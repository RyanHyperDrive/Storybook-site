#!/usr/bin/env node
/**
 * Visual regression for the homepage above-the-fold hero and the
 * "How it works" first-steps section, on desktop and mobile.
 *
 * For each viewport, captures:
 *   - homepage above-the-fold viewport screenshot
 *   - hero section full screenshot ([data-testid="hero"])
 *   - "How it works" section screenshot ([data-testid="how-it-works"])
 *
 * Also asserts the conversion-critical pieces are present:
 *   - H1 visible
 *   - "Start free character preview" CTA in hero
 *   - $29.99 price line in hero
 *   - 4 trust bullets in hero (Private photos, Not used to train models,
 *     Parent-approved, Free regeneration)
 *   - "How it works" headline + 4 numbered steps
 *
 * Usage:
 *   PREVIEW_URL=http://localhost:8080 node scripts/visual-regression-home.mjs
 *
 * Requires playwright: `bunx playwright install chromium` once.
 * Screenshots saved to ./visual-regression/home/.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const URL = (process.env.PREVIEW_URL || "http://localhost:8080").replace(/\/$/, "");
const OUT = resolve("visual-regression", "home");
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];

const HERO_TRUST_TEXTS = [
  /Private child photos/i,
  /Not used to train models/i,
  /Parent-approved character/i,
  /Free regeneration/i,
];

async function runOne(browser, vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  const failures = [];
  try {
    await page.goto(URL + "/", { waitUntil: "networkidle" });

    const hero = page.locator('[data-testid="hero"]');
    await hero.waitFor({ state: "visible", timeout: 10_000 });

    // H1
    if (!(await page.getByRole("heading", { level: 1 }).first().isVisible())) {
      failures.push(`${vp.name}: H1 not visible`);
    }

    // Primary CTA in hero
    const cta = hero.getByRole("link", { name: /Start free character preview/i }).first();
    if (!(await cta.isVisible())) {
      failures.push(`${vp.name}: hero CTA missing`);
    }

    // $29.99 price
    if ((await hero.getByText(/\$29\.99/).count()) === 0) {
      failures.push(`${vp.name}: hero $29.99 price missing`);
    }

    // Trust bullets
    for (const re of HERO_TRUST_TEXTS) {
      if ((await hero.getByText(re).count()) === 0) {
        failures.push(`${vp.name}: hero trust bullet missing ${re}`);
      }
    }

    // How it works section
    const how = page.locator('[data-testid="how-it-works"]');
    await how.scrollIntoViewIfNeeded();
    if (!(await how.isVisible())) {
      failures.push(`${vp.name}: how-it-works section not visible`);
    }
    if ((await how.getByRole("heading", { level: 2 }).count()) === 0) {
      failures.push(`${vp.name}: how-it-works H2 missing`);
    }
    // 4 numbered steps inside the section
    let stepCount = 0;
    for (const n of [1, 2, 3, 4]) {
      stepCount += await how.getByText(new RegExp(`^${n}$`)).count();
    }
    if (stepCount < 4) {
      failures.push(`${vp.name}: how-it-works expected 4 step numbers, found ${stepCount}`);
    }

    // Screenshots — scroll back to top for the fold capture
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    await page.screenshot({ path: resolve(OUT, `home-fold-${vp.name}.png`), fullPage: false });
    await hero.screenshot({ path: resolve(OUT, `home-hero-${vp.name}.png`) });
    await how.screenshot({ path: resolve(OUT, `home-howitworks-${vp.name}.png`) });
    console.log(`✓ ${vp.name} → fold + hero + how-it-works captured`);
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
console.log(`\nAll homepage regression checks passed. Screenshots: ${OUT}`);
