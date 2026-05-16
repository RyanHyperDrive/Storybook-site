#!/usr/bin/env node
/**
 * Visual regression for /checkout/success and /checkout/cancel.
 *
 * Uses deterministic fixtures (mocked Supabase auth, REST, storage) so
 * pages render without touching the real backend.
 *
 * Captures at desktop (1280) and mobile (390), asserting:
 *   - /checkout/success: "Payment received" heading + "Watch progress" CTA
 *   - /checkout/cancel:  "Checkout cancelled" heading + "Try again" CTA
 *
 * Usage:
 *   PREVIEW_URL=http://localhost:8080 node scripts/visual-regression-checkout-post.mjs
 *
 * Screenshots saved to ./visual-regression/checkout-post/.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  SUPABASE_URL,
  SUPABASE_AUTH_KEY,
  FIXED_NOW_MS,
  FIXTURE_DRAFT_BOOK_ID,
  fixtureAuthSession,
} from "./fixtures/create-journey.js";

const URL = (process.env.PREVIEW_URL || "http://localhost:8080").replace(/\/$/, "");
const OUT = resolve("visual-regression", "checkout-post");
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];

const FIXTURE_PAYMENT_ROW = {
  id: "00000000-0000-4000-8000-000000000100",
  user_id: fixtureAuthSession().user.id,
  book_id: FIXTURE_DRAFT_BOOK_ID,
  provider: "stripe",
  provider_session_id: "fixture-session-id",
  amount_cents: 2999,
  currency: "usd",
  status: "succeeded",
};

const FIXTURE_JOB_ROW = {
  id: "00000000-0000-4000-8000-000000000200",
  book_id: FIXTURE_DRAFT_BOOK_ID,
  user_id: fixtureAuthSession().user.id,
  kind: "book",
  status: "queued",
  progress: 5,
};

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

    if (method === "GET") {
      if (table === "payments") {
        // Return existing payment so the page skips insert and goes straight to "done"
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([FIXTURE_PAYMENT_ROW]),
        });
      }
      if (table === "jobs") {
        // Return empty so the page creates a new job
        return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }

    if (method === "PATCH" || method === "PUT") {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }

    if (method === "POST") {
      if (table === "jobs") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([FIXTURE_JOB_ROW]),
        });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }

    if (method === "DELETE") {
      return route.fulfill({ status: 204, contentType: "application/json", body: "" });
    }

    return route.continue();
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

async function runSuccess(browser, vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    reducedMotion: "reduce",
  });
  await ctx.addInitScript(buildInitScript());
  await installMocks(ctx);
  const page = await ctx.newPage();
  const failures = [];
  try {
    await page.goto(
      `${URL}/checkout/success?book_id=${FIXTURE_DRAFT_BOOK_ID}&session_id=fixture-session-id`,
      { waitUntil: "networkidle" },
    );
    await page.getByText("Payment received").first().waitFor({ state: "visible", timeout: 10_000 });

    if (!(await page.locator('[data-testid="checkout-success-done"]').isVisible())) {
      failures.push(`${vp.name}: success done-state not visible`);
    }
    if (
      !(await page.getByRole("button", { name: /Watch progress/i }).first().isVisible())
    ) {
      failures.push(`${vp.name}: 'Watch progress' button missing`);
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    await page.screenshot({ path: resolve(OUT, `checkout-success-${vp.name}.png`), fullPage: true });
    console.log(`✓ checkout-success @ ${vp.name} → captured`);

    // Verify "Watch progress" navigates to /jobs/<jobId> from the fixture.
    const expectedJobsPath = `/jobs/${FIXTURE_JOB_ROW.id}`;
    await page.getByRole("button", { name: /Watch progress/i }).first().click();
    try {
      await page.waitForURL((u) => u.pathname === expectedJobsPath, { timeout: 5_000 });
    } catch {
      const got = new URL(page.url()).pathname + new URL(page.url()).search;
      failures.push(
        `${vp.name}: 'Watch progress' should navigate to ${expectedJobsPath}, got ${got}`,
      );
    }
  } catch (e) {
    failures.push(`checkout-success @ ${vp.name}: ${e.message}`);
  } finally {
    await ctx.close();
  }
  return failures;
}

async function runCancel(browser, vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    reducedMotion: "reduce",
  });
  await ctx.addInitScript(buildInitScript());
  await installMocks(ctx);
  const page = await ctx.newPage();
  const failures = [];
  try {
    await page.goto(
      `${URL}/checkout/cancel?book_id=${FIXTURE_DRAFT_BOOK_ID}`,
      { waitUntil: "networkidle" },
    );
    await page.getByText("Checkout cancelled").first().waitFor({ state: "visible", timeout: 10_000 });

    if (!(await page.locator('[data-testid="checkout-cancel"]').isVisible())) {
      failures.push(`${vp.name}: cancel container not visible`);
    }
    if (
      !(await page.getByRole("button", { name: /Try again/i }).first().isVisible())
    ) {
      failures.push(`${vp.name}: 'Try again' button missing`);
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    await page.screenshot({ path: resolve(OUT, `checkout-cancel-${vp.name}.png`), fullPage: true });
    console.log(`✓ checkout-cancel @ ${vp.name} → captured`);
  } catch (e) {
    failures.push(`checkout-cancel @ ${vp.name}: ${e.message}`);
  } finally {
    await ctx.close();
  }
  return failures;
}

const browser = await chromium.launch();
const allFailures = [];
try {
  for (const vp of VIEWPORTS) {
    const f1 = await runSuccess(browser, vp);
    allFailures.push(...f1);
    const f2 = await runCancel(browser, vp);
    allFailures.push(...f2);
  }
} finally {
  await browser.close();
}

if (allFailures.length) {
  console.error("\nFAILURES:\n" + allFailures.map((f) => " - " + f).join("\n"));
  process.exit(1);
}
console.log(`\nAll /checkout post-flow checks passed. Screenshots: ${OUT}`);
