#!/usr/bin/env node
/**
 * Quick visual regression check for the homepage "How it works" section.
 *
 * Screenshots the section at three widths (390, 430, 1280) and writes PNGs to
 * ./visual-regression/howitworks-{width}.png. Compare against the committed
 * baselines in the same directory to catch cropping or spacing regressions.
 *
 * Usage:
 *   PREVIEW_URL=http://localhost:8080 node scripts/visual-regression-howitworks.mjs
 *
 * Requires playwright: `bunx playwright install chromium` once.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const URL = process.env.PREVIEW_URL || "http://localhost:8080";
const OUT = resolve("visual-regression");
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "mobile-390", width: 390, height: 900 },
  { name: "mobile-430", width: 430, height: 900 },
  { name: "desktop-1280", width: 1280, height: 900 },
];

const SECTION_SELECTOR = '[data-testid="how-it-works"]';

const browser = await chromium.launch();
try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: "networkidle" });
    const section = await page.locator(SECTION_SELECTOR).first();
    await section.waitFor({ state: "visible", timeout: 10_000 });
    const file = resolve(OUT, `howitworks-${vp.name}.png`);
    await section.screenshot({ path: file });
    console.log(`✓ ${vp.name} → ${file}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
