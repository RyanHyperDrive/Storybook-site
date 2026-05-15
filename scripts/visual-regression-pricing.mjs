#!/usr/bin/env node
/**
 * Visual regression for the /pricing page.
 *
 * Captures full-page + per-section screenshots at desktop (1280) and
 * mobile (390), and asserts the conversion-critical pieces are present:
 *   - Pricing hero ([data-testid="pricing-hero"]) with H1
 *   - Pricing card ([data-testid="pricing-card"]) with $29.99 + CTA
 *   - Add-ons row ([data-testid="pricing-addons"]) with 3 cards
 *   - FAQ ([data-testid="pricing-faq"]) with at least 6 questions
 *
 * Usage:
 *   PREVIEW_URL=http://localhost:8080 node scripts/visual-regression-pricing.mjs
 *
 * Requires playwright: `bunx playwright install chromium` once.
 * Screenshots saved to ./visual-regression/pricing/.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const URL = (process.env.PREVIEW_URL || "http://localhost:8080").replace(/\/$/, "");
const OUT = resolve("visual-regression", "pricing");
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
    await page.goto(`${URL}/pricing`, { waitUntil: "networkidle" });

    const hero = page.locator('[data-testid="pricing-hero"]');
    const card = page.locator('[data-testid="pricing-card"]');
    const addons = page.locator('[data-testid="pricing-addons"]');
    const faq = page.locator('[data-testid="pricing-faq"]');

    await hero.waitFor({ state: "visible", timeout: 10_000 });

    if (!(await page.getByRole("heading", { level: 1 }).first().isVisible())) {
      failures.push(`${vp.name}: H1 not visible`);
    }
    if (!(await card.isVisible())) {
      failures.push(`${vp.name}: pricing card not visible`);
    }
    if ((await card.getByText(/\$29\.99/).count()) === 0) {
      failures.push(`${vp.name}: pricing card missing $29.99`);
    }
    if (
      !(await card
        .getByRole("link", { name: /Start free character preview/i })
        .first()
        .isVisible())
    ) {
      failures.push(`${vp.name}: pricing card CTA missing`);
    }

    await addons.scrollIntoViewIfNeeded();
    if (!(await addons.isVisible())) {
      failures.push(`${vp.name}: add-ons row not visible`);
    }
    const addonCount = await addons.locator("> div > div").count();
    if (addonCount < 3) {
      failures.push(`${vp.name}: expected 3 add-on cards, found ${addonCount}`);
    }

    await faq.scrollIntoViewIfNeeded();
    if (!(await faq.isVisible())) {
      failures.push(`${vp.name}: FAQ not visible`);
    }
    const faqItems = await faq.locator('[data-state]').count();
    if (faqItems < 6) {
      failures.push(`${vp.name}: expected ≥6 FAQ items, found ${faqItems}`);
    }

    // Screenshots — scroll to top first
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    await page.screenshot({ path: resolve(OUT, `pricing-full-${vp.name}.png`), fullPage: true });
    await hero.screenshot({ path: resolve(OUT, `pricing-hero-${vp.name}.png`) });
    await card.screenshot({ path: resolve(OUT, `pricing-card-${vp.name}.png`) });
    await addons.scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
    await addons.screenshot({ path: resolve(OUT, `pricing-addons-${vp.name}.png`) });
    await faq.scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
    await faq.screenshot({ path: resolve(OUT, `pricing-faq-${vp.name}.png`) });
    console.log(`✓ ${vp.name} → full + hero + card + addons + faq captured`);
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
console.log(`\nAll /pricing regression checks passed. Screenshots: ${OUT}`);
