#!/usr/bin/env node
/**
 * Visual + interaction regression for the "Five art styles" sample reader modal.
 *
 * For each of the 5 sample styles:
 *   1. Open homepage, scroll to #examples, click sample card.
 *   2. Step Cover → Dedication → Page 1 → Page 2.
 *   3. Screenshot Page 1 + Page 2 at desktop (1280) and mobile (390).
 *   4. Assert the [data-testid="modal-illustration"] image is non-blank
 *      (color variance + non-near-white-pixel ratio).
 *   5. Assert footer trust line + "Start free character preview" CTA visible.
 *
 * COMIC BOOK NOTE: Comic art must remain free of speech bubbles, word balloons,
 * caption boxes, sound-effect words, blank bubbles, or any readable embedded
 * text inside the artwork. This script can't OCR for that — it is enforced by
 * prompt + asset review. Inspect the saved comic_book-*.png screenshots whenever
 * those assets change.
 *
 * Usage:
 *   PREVIEW_URL=http://localhost:8080 node scripts/visual-regression-sample-modal.mjs
 *
 * Requires playwright: `bunx playwright install chromium` once.
 * Screenshots saved to ./visual-regression/sample-modal/.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const URL = process.env.PREVIEW_URL || "http://localhost:8080";
const OUT = resolve("visual-regression", "sample-modal");
mkdirSync(OUT, { recursive: true });

const STYLES = [
  "comic_book",
  "soft_cartoon",
  "watercolor_adventure",
  "manga_inspired",
  "pixel_art",
];

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];

const FOOTER_TRUST_RE = /Fictional sample preview/i;
const FOOTER_CTA_RE = /Start free character preview/i;

/**
 * Inside the page: draw the modal illustration <img> into an offscreen canvas
 * and report metrics so we can assert it isn't a near-blank cream/white panel.
 */
async function illustrationMetrics(page) {
  return await page.evaluate(() => {
    const block = document.querySelector('[data-testid="modal-illustration"]');
    if (!block) return { ok: false, reason: "no-block" };
    const imgs = Array.from(block.querySelectorAll("img")).filter(
      (i) => i.complete && i.naturalWidth > 1 && i.naturalHeight > 1 && getComputedStyle(i).visibility !== "hidden",
    );
    if (imgs.length === 0) return { ok: false, reason: "no-loaded-img" };
    const img = imgs[imgs.length - 1]; // top-most rendered
    const W = 64, H = 64;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    try {
      ctx.drawImage(img, 0, 0, W, H);
    } catch (e) {
      return { ok: false, reason: "draw-failed:" + e.message };
    }
    const { data } = ctx.getImageData(0, 0, W, H);
    let total = 0, nonBlank = 0;
    let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      total++;
      // "blank cream/white": all channels > 235 and roughly equal
      const isNearWhite = r > 232 && g > 228 && b > 218 && Math.max(r, g, b) - Math.min(r, g, b) < 18;
      if (!isNearWhite) nonBlank++;
      if (r < minR) minR = r; if (r > maxR) maxR = r;
      if (g < minG) minG = g; if (g > maxG) maxG = g;
      if (b < minB) minB = b; if (b > maxB) maxB = b;
    }
    const nonBlankRatio = nonBlank / total;
    const range = Math.max(maxR - minR, maxG - minG, maxB - minB);
    return { ok: true, nonBlankRatio, range, src: img.currentSrc || img.src };
  });
}

function assertNonBlank(label, m) {
  if (!m.ok) throw new Error(`${label}: illustration not measurable (${m.reason})`);
  // Require both: lots of non-cream pixels AND meaningful color variance
  if (m.nonBlankRatio < 0.55) {
    throw new Error(`${label}: illustration looks mostly blank (nonBlankRatio=${m.nonBlankRatio.toFixed(2)}, src=${m.src})`);
  }
  if (m.range < 60) {
    throw new Error(`${label}: illustration has too little color variance (range=${m.range}, src=${m.src})`);
  }
}

async function clickNext(page) {
  // The header pager shows "X / N". Click the bottom-bar Next (visible mobile + desktop).
  await page.getByRole("button", { name: /^next page$/i }).last().click();
}

async function runOne(browser, vp, styleKey) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  const failures = [];
  try {
    await page.goto(URL, { waitUntil: "networkidle" });
    await page.locator('[data-testid="samples"]').scrollIntoViewIfNeeded();
    await page.locator(`[data-testid="sample-card-${styleKey}"]`).first().click();
    const dialog = page.locator('[role="dialog"]').first();
    await dialog.waitFor({ state: "visible", timeout: 10_000 });

    // Cover (index 0) → Dedication → Page 1 → Page 2
    await clickNext(page); // dedication
    await clickNext(page); // page 1
    await page.waitForTimeout(400);
    const m1 = await illustrationMetrics(page);
    assertNonBlank(`${styleKey} ${vp.name} page1`, m1);
    await page.screenshot({
      path: resolve(OUT, `${styleKey}-${vp.name}-page1.png`),
      clip: await dialog.boundingBox().then((b) => b && { x: b.x, y: b.y, width: b.width, height: Math.min(b.height, vp.height) }),
    });

    await clickNext(page); // page 2
    await page.waitForTimeout(400);
    const m2 = await illustrationMetrics(page);
    assertNonBlank(`${styleKey} ${vp.name} page2`, m2);
    await page.screenshot({
      path: resolve(OUT, `${styleKey}-${vp.name}-page2.png`),
      clip: await dialog.boundingBox().then((b) => b && { x: b.x, y: b.y, width: b.width, height: Math.min(b.height, vp.height) }),
    });

    // Footer trust + CTA still present
    if (!(await dialog.getByText(FOOTER_TRUST_RE).first().isVisible())) {
      failures.push(`${styleKey} ${vp.name}: footer trust line missing`);
    }
    if (!(await dialog.getByRole("link", { name: FOOTER_CTA_RE }).first().isVisible())) {
      failures.push(`${styleKey} ${vp.name}: footer CTA missing`);
    }

    console.log(`✓ ${styleKey} ${vp.name} (page1 nonBlank=${m1.nonBlankRatio.toFixed(2)} range=${m1.range}, page2 nonBlank=${m2.nonBlankRatio.toFixed(2)} range=${m2.range})`);
  } finally {
    await ctx.close();
  }
  return failures;
}

const browser = await chromium.launch();
const allFailures = [];
try {
  for (const vp of VIEWPORTS) {
    for (const style of STYLES) {
      try {
        const f = await runOne(browser, vp, style);
        allFailures.push(...f);
      } catch (e) {
        allFailures.push(`✗ ${style} ${vp.name}: ${e.message}`);
        console.error(`✗ ${style} ${vp.name}: ${e.message}`);
      }
    }
  }
} finally {
  await browser.close();
}

if (allFailures.length) {
  console.error("\nFAILURES:\n" + allFailures.map((f) => " - " + f).join("\n"));
  process.exit(1);
}
console.log(`\nAll sample-modal regression checks passed. Screenshots: ${OUT}`);
