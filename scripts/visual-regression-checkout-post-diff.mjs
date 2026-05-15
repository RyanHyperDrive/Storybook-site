#!/usr/bin/env node
/**
 * Compare freshly-captured /checkout/success and /checkout/cancel screenshots
 * against committed baselines using pixelmatch. Fails the build when the
 * per-image diff exceeds a small threshold.
 *
 * Layout:
 *   visual-regression/checkout-post/baseline/<name>.png   ← committed
 *   visual-regression/checkout-post/<name>.png            ← from capture
 *   visual-regression/checkout-post/diff/<name>.png       ← diff artifact
 *
 * Env knobs:
 *   DIFF_PIXEL_THRESHOLD   per-pixel color tolerance (0..1). Default 0.1
 *   DIFF_RATIO_THRESHOLD   max fraction of differing pixels per image.
 *                          Default 0.005 (0.5%). Anything higher fails.
 *   UPDATE_BASELINES=1     overwrite baselines and skip diffing.
 *
 * Usage:
 *   node scripts/visual-regression-checkout-post-diff.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const ROOT = resolve("visual-regression", "checkout-post");
const BASELINE_DIR = resolve(ROOT, "baseline");
const DIFF_DIR = resolve(ROOT, "diff");

const PIXEL_THRESHOLD = Number(process.env.DIFF_PIXEL_THRESHOLD ?? 0.1);
const RATIO_THRESHOLD = Number(process.env.DIFF_RATIO_THRESHOLD ?? 0.005);
const UPDATE = process.env.UPDATE_BASELINES === "1";

mkdirSync(BASELINE_DIR, { recursive: true });
mkdirSync(DIFF_DIR, { recursive: true });

const screenshots = readdirSync(ROOT)
  .filter((f) => f.endsWith(".png"))
  .sort();

if (screenshots.length === 0) {
  console.error(
    "No screenshots in visual-regression/checkout-post/. " +
      "Run scripts/visual-regression-checkout-post.mjs first.",
  );
  process.exit(1);
}

if (UPDATE) {
  for (const name of screenshots) {
    copyFileSync(resolve(ROOT, name), resolve(BASELINE_DIR, name));
    console.log(`↻ updated baseline: ${name}`);
  }
  console.log(`\nBaselines updated (${screenshots.length} files).`);
  process.exit(0);
}

const failures = [];
let comparisons = 0;

for (const name of screenshots) {
  const actualPath = resolve(ROOT, name);
  const baselinePath = resolve(BASELINE_DIR, name);

  if (!existsSync(baselinePath)) {
    failures.push(
      `${name}: missing baseline. ` +
        "Re-run with UPDATE_BASELINES=1 once you've reviewed the screenshot.",
    );
    continue;
  }

  const actual = PNG.sync.read(readFileSync(actualPath));
  const baseline = PNG.sync.read(readFileSync(baselinePath));

  if (actual.width !== baseline.width || actual.height !== baseline.height) {
    failures.push(
      `${name}: size mismatch ` +
        `(actual ${actual.width}x${actual.height}, baseline ${baseline.width}x${baseline.height})`,
    );
    continue;
  }

  const { width, height } = actual;
  const diff = new PNG({ width, height });
  const mismatched = pixelmatch(actual.data, baseline.data, diff.data, width, height, {
    threshold: PIXEL_THRESHOLD,
  });
  const ratio = mismatched / (width * height);
  comparisons++;

  if (ratio > RATIO_THRESHOLD) {
    const diffPath = resolve(DIFF_DIR, name);
    writeFileSync(diffPath, PNG.sync.write(diff));
    failures.push(
      `${name}: ${(ratio * 100).toFixed(3)}% differing pixels ` +
        `(threshold ${(RATIO_THRESHOLD * 100).toFixed(2)}%) — diff: ${diffPath}`,
    );
  } else {
    console.log(
      `✓ ${name}  (${mismatched} px, ${(ratio * 100).toFixed(3)}%)`,
    );
  }
}

if (failures.length) {
  console.error(`\nFAILURES (${failures.length}/${comparisons + failures.length}):`);
  for (const f of failures) console.error(" - " + f);
  console.error(
    "\nIf the change is intentional, re-run locally with UPDATE_BASELINES=1 and commit the new baseline.",
  );
  process.exit(1);
}

console.log(
  `\nAll ${comparisons} screenshots within ${(RATIO_THRESHOLD * 100).toFixed(2)}% pixel tolerance.`,
);
