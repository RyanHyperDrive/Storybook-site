#!/usr/bin/env node
/**
 * Accessibility check for the /pricing page using axe-core.
 *
 * Runs axe with WCAG 2.1 A + AA + best-practices rules at desktop (1280) and
 * mobile (390). Fails the build on any "serious" or "critical" violation
 * (color-contrast, button-name, ARIA, landmarks, etc.).
 *
 * Usage:
 *   PREVIEW_URL=http://localhost:8080 node scripts/a11y-pricing.mjs
 *
 * Env knobs:
 *   A11Y_FAIL_IMPACTS   comma-separated impact levels that fail the build.
 *                       Default: "serious,critical"
 *   A11Y_DISABLE_RULES  comma-separated axe rule ids to skip.
 *
 * Writes a JSON report per viewport to ./visual-regression/pricing-a11y/.
 */
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const URL = (process.env.PREVIEW_URL || "http://localhost:8080").replace(/\/$/, "");
const OUT = resolve("visual-regression", "pricing-a11y");
mkdirSync(OUT, { recursive: true });

const FAIL_IMPACTS = new Set(
  (process.env.A11Y_FAIL_IMPACTS || "serious,critical")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);
const DISABLE_RULES = (process.env.A11Y_DISABLE_RULES || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

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
  try {
    await page.goto(`${URL}/pricing`, { waitUntil: "networkidle" });
    await page.locator('[data-testid="pricing-hero"]').waitFor({ state: "visible", timeout: 10_000 });

    let builder = new AxeBuilder({ page }).withTags([
      "wcag2a",
      "wcag2aa",
      "wcag21a",
      "wcag21aa",
      "best-practice",
    ]);
    if (DISABLE_RULES.length) builder = builder.disableRules(DISABLE_RULES);

    const results = await builder.analyze();
    writeFileSync(
      resolve(OUT, `pricing-a11y-${vp.name}.json`),
      JSON.stringify(results, null, 2),
    );

    const blocking = results.violations.filter((v) => FAIL_IMPACTS.has(v.impact || ""));
    return { vp, results, blocking };
  } finally {
    await ctx.close();
  }
}

function summarize({ vp, results, blocking }) {
  const tally = results.violations.reduce((acc, v) => {
    const k = v.impact || "unknown";
    acc[k] = (acc[k] || 0) + v.nodes.length;
    return acc;
  }, {});
  const tallyStr = Object.entries(tally)
    .map(([k, n]) => `${k}=${n}`)
    .join(", ") || "none";
  console.log(`\n[${vp.name}] axe violations: ${tallyStr}`);
  for (const v of results.violations) {
    const marker = FAIL_IMPACTS.has(v.impact || "") ? "✗" : "·";
    console.log(`  ${marker} [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? "" : "s"})`);
    for (const node of v.nodes.slice(0, 3)) {
      console.log(`      target: ${node.target.join(" ")}`);
      if (node.failureSummary) {
        console.log(`      ${node.failureSummary.split("\n").join(" ")}`);
      }
    }
    if (v.nodes.length > 3) console.log(`      … +${v.nodes.length - 3} more`);
  }
  return blocking;
}

const browser = await chromium.launch();
let totalBlocking = 0;
try {
  for (const vp of VIEWPORTS) {
    try {
      const out = await runOne(browser, vp);
      const blocking = summarize(out);
      totalBlocking += blocking.length;
    } catch (e) {
      console.error(`✗ ${vp.name}: ${e.message}`);
      totalBlocking += 1;
    }
  }
} finally {
  await browser.close();
}

if (totalBlocking > 0) {
  console.error(
    `\nFAIL: ${totalBlocking} blocking accessibility violation${totalBlocking === 1 ? "" : "s"} ` +
      `(impact in {${[...FAIL_IMPACTS].join(",")}}). Reports in ${OUT}/`,
  );
  process.exit(1);
}
console.log(`\nAll /pricing accessibility checks passed (no ${[...FAIL_IMPACTS].join("/")} violations).`);
