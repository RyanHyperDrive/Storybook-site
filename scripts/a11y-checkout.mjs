#!/usr/bin/env node
/**
 * Accessibility check for the /checkout/$bookId page using axe-core.
 *
 * /checkout requires an authenticated user and a real book row, so this
 * script reuses the deterministic fixtures from the /create journey
 * (mocked Supabase auth, REST, storage) to render the page in a stable
 * state without touching the real backend.
 *
 * Runs axe with WCAG 2.1 A + AA + best-practice rules at desktop (1280)
 * and mobile (390). Build fails on any `serious` or `critical` violation.
 *
 * Usage:
 *   PREVIEW_URL=http://localhost:8080 node scripts/a11y-checkout.mjs
 *
 * Env knobs:
 *   A11Y_FAIL_IMPACTS   comma list of impact levels that fail the build
 *                       (default: "serious,critical").
 *   A11Y_DISABLE_RULES  comma list of axe rule ids to skip.
 *
 * Reports per viewport are written to ./visual-regression/checkout-a11y/.
 */
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  SUPABASE_URL,
  SUPABASE_AUTH_KEY,
  FIXED_NOW_MS,
  FIXTURE_DRAFT_BOOK_ID,
  FIXTURE_TABLES,
  PLACEHOLDER_IMAGE_DATA_URL,
  fixtureAuthSession,
} from "./fixtures/create-journey.js";

const URL = (process.env.PREVIEW_URL || "http://localhost:8080").replace(/\/$/, "");
const OUT = resolve("visual-regression", "checkout-a11y");
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

// /checkout reads from `books` and `user_roles`. user_roles isn't in the
// shared fixture map (the wizard doesn't need it), so add an empty list.
const TABLES = { ...FIXTURE_TABLES, user_roles: [] };

function buildInitScript() {
  const payload = {
    nowMs: FIXED_NOW_MS,
    authKey: SUPABASE_AUTH_KEY,
    authSession: fixtureAuthSession(),
  };
  return `
    (() => {
      const P = ${JSON.stringify(payload)};
      try { localStorage.setItem(P.authKey, JSON.stringify(P.authSession)); } catch (e) {}
      const Real = Date;
      const fixed = P.nowMs;
      class FixedDate extends Real {
        constructor(...a) { if (a.length === 0) super(fixed); else super(...a); }
        static now() { return fixed; }
      }
      FixedDate.UTC = Real.UTC;
      FixedDate.parse = Real.parse;
      window.Date = FixedDate;
    })();
  `;
}

function tableFromUrl(u) {
  const m = u.pathname.match(/\/rest\/v1\/([^/?]+)/);
  return m ? m[1] : null;
}

async function installMocks(ctx) {
  await ctx.emulateMedia({ reducedMotion: "reduce" });

  await ctx.route(`${SUPABASE_URL}/rest/v1/**`, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const table = tableFromUrl(u);
    const method = req.method();
    if (method !== "GET") {
      const rows = (TABLES[table] ?? []).slice(0, 1);
      return route.fulfill({
        status: method === "DELETE" ? 204 : 200,
        contentType: "application/json",
        body: JSON.stringify(rows),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(TABLES[table] ?? []),
    });
  });

  await ctx.route(`${SUPABASE_URL}/storage/v1/object/sign/**`, async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ signedURL: PLACEHOLDER_IMAGE_DATA_URL, signedUrl: PLACEHOLDER_IMAGE_DATA_URL }),
    });
  });
  await ctx.route(`${SUPABASE_URL}/storage/v1/object/**`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
      "base64",
    );
    return route.fulfill({ status: 200, contentType: "image/png", body: png });
  });
  await ctx.route(`${SUPABASE_URL}/auth/v1/**`, async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith("/user")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fixtureAuthSession().user),
      });
    }
    if (u.pathname.endsWith("/token")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fixtureAuthSession()),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
}

async function runOne(browser, vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    reducedMotion: "reduce",
  });
  await ctx.addInitScript(buildInitScript());
  await installMocks(ctx);
  const page = await ctx.newPage();
  try {
    await page.goto(`${URL}/checkout/${FIXTURE_DRAFT_BOOK_ID}`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { level: 1 }).first().waitFor({ state: "visible", timeout: 10_000 });
    // Wait for the price line to render so the page has stabilized past
    // its loading state before axe scans it.
    await page.getByText(/\$29\.99/).first().waitFor({ state: "visible", timeout: 10_000 });

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
      resolve(OUT, `checkout-a11y-${vp.name}.json`),
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
  const tallyStr = Object.entries(tally).map(([k, n]) => `${k}=${n}`).join(", ") || "none";
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
console.log(`\nAll /checkout accessibility checks passed (no ${[...FAIL_IMPACTS].join("/")} violations).`);
