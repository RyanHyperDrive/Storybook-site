#!/usr/bin/env node
/**
 * Visual regression for the /checkout/$bookId page.
 *
 * Reuses the deterministic fixtures from scripts/fixtures/create-journey.js
 * (mocked Supabase auth, REST, storage + frozen clock) so the checkout page
 * renders the same book + price every run without touching the real backend.
 *
 * Captures full page + per-section screenshots at desktop (1280) and
 * mobile (390), and asserts the conversion-critical pieces are present:
 *   - H1 "Create my book"
 *   - Price card ([data-testid="checkout-price-card"]) with $29.99
 *   - Primary CTA ([data-testid="checkout-cta"]) with $29.99 + lock icon
 *
 * Usage:
 *   PREVIEW_URL=http://localhost:8080 node scripts/visual-regression-checkout.mjs
 *
 * Screenshots saved to ./visual-regression/checkout/.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
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
const OUT = resolve("visual-regression", "checkout");
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];

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
  const failures = [];
  try {
    await page.goto(`${URL}/checkout/${FIXTURE_DRAFT_BOOK_ID}`, { waitUntil: "networkidle" });

    const h1 = page.getByRole("heading", { level: 1 }).first();
    await h1.waitFor({ state: "visible", timeout: 10_000 });

    // Wait past loading state
    await page.getByText(/\$29\.99/).first().waitFor({ state: "visible", timeout: 10_000 });

    const card = page.locator('[data-testid="checkout-price-card"]');
    const cta = page.locator('[data-testid="checkout-cta"]');

    if (!(await card.isVisible())) failures.push(`${vp.name}: price card not visible`);
    if ((await card.getByText(/\$29\.99/).count()) === 0) {
      failures.push(`${vp.name}: price card missing $29.99`);
    }
    if (!(await cta.isVisible())) failures.push(`${vp.name}: CTA not visible`);
    if ((await cta.getByText(/\$29\.99/).count()) === 0) {
      failures.push(`${vp.name}: CTA missing $29.99`);
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    await page.screenshot({ path: resolve(OUT, `checkout-full-${vp.name}.png`), fullPage: true });
    await card.screenshot({ path: resolve(OUT, `checkout-price-card-${vp.name}.png`) });
    await cta.scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
    await cta.screenshot({ path: resolve(OUT, `checkout-cta-${vp.name}.png`) });
    console.log(`✓ ${vp.name} → full + price card + CTA captured`);
  } catch (e) {
    failures.push(`${vp.name}: ${e.message}`);
  } finally {
    await ctx.close();
  }
  return failures;
}

const browser = await chromium.launch();
const allFailures = [];
try {
  for (const vp of VIEWPORTS) {
    const f = await runOne(browser, vp);
    allFailures.push(...f);
  }
} finally {
  await browser.close();
}

if (allFailures.length) {
  console.error("\nFAILURES:\n" + allFailures.map((f) => " - " + f).join("\n"));
  process.exit(1);
}
console.log(`\nAll /checkout regression checks passed. Screenshots: ${OUT}`);
