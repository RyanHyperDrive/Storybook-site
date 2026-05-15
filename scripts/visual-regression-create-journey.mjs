#!/usr/bin/env node
/**
 * Visual regression for the full /create wizard journey:
 *
 *   /create/profile         → hydrates from seeded localStorage profile draft
 *   /create/photos          → renders accepted fixture photo
 *   /create/story           → renders fixture book row
 *   /create/style           → renders fixture art_style selection
 *   /create/character-sheet → renders fixture child_subject + character image
 *
 * Determinism strategy
 * --------------------
 * Each browser context is seeded BEFORE navigation with:
 *   - a frozen clock (Date.now / new Date() pinned to FIXED_NOW_MS),
 *   - prefers-reduced-motion forced on (no entry animations),
 *   - a fixture Supabase auth session in localStorage so `useAuth()` resolves
 *     to a fake authenticated user with no network call,
 *   - a fixture profile draft + draft book id in localStorage,
 *   - mocked Supabase REST/Storage routes that always return the same
 *     fixture rows and a stable placeholder image.
 *
 * That means screenshots do not depend on the real backend, the real time,
 * randomly-generated UUIDs, or animation phase.
 *
 * Usage:
 *   PREVIEW_URL=http://localhost:8080 node scripts/visual-regression-create-journey.mjs
 *
 * Requires playwright: `bunx playwright install chromium` once.
 * Screenshots saved to ./visual-regression/create-journey/.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  SUPABASE_URL,
  SUPABASE_AUTH_KEY,
  FIXED_NOW_MS,
  FIXTURE_DRAFT_BOOK_ID,
  FIXTURE_PROFILE_DRAFT,
  FIXTURE_TABLES,
  PLACEHOLDER_IMAGE_DATA_URL,
  fixtureAuthSession,
} from "./fixtures/create-journey.js";

const URL = (process.env.PREVIEW_URL || "http://localhost:8080").replace(/\/$/, "");
const OUT = resolve("visual-regression", "create-journey");
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];

const STEPS = [
  { slug: "profile",         path: "/create/profile" },
  { slug: "photos",          path: "/create/photos" },
  { slug: "story",           path: "/create/story" },
  { slug: "style",           path: "/create/style" },
  { slug: "character-sheet", path: "/create/character-sheet" },
];

/**
 * Init script (runs in the page before any app code):
 *   - freeze Date / Date.now to FIXED_NOW_MS
 *   - seed Supabase auth session, draft id, profile draft in localStorage
 *   - force prefers-reduced-motion: reduce so transitions don't flicker
 */
function buildInitScript() {
  const payload = {
    nowMs: FIXED_NOW_MS,
    authKey: SUPABASE_AUTH_KEY,
    authSession: fixtureAuthSession(),
    draftBookId: FIXTURE_DRAFT_BOOK_ID,
    profileDraft: FIXTURE_PROFILE_DRAFT,
  };
  return `
    (() => {
      const P = ${JSON.stringify(payload)};
      try { localStorage.setItem(P.authKey, JSON.stringify(P.authSession)); } catch (e) {}
      try { localStorage.setItem("storynest:draft_book_id", P.draftBookId); } catch (e) {}
      try { localStorage.setItem("storynest:profile_draft_v2", JSON.stringify(P.profileDraft)); } catch (e) {}

      // Freeze time. new Date() with no args, Date.now(), and performance.now()
      // all collapse to the fixture moment so timestamp-derived UI is stable.
      const Real = Date;
      const fixed = P.nowMs;
      class FixedDate extends Real {
        constructor(...args) {
          if (args.length === 0) { super(fixed); } else { super(...args); }
        }
        static now() { return fixed; }
      }
      // preserve UTC/parse so libraries keep working
      FixedDate.UTC = Real.UTC;
      FixedDate.parse = Real.parse;
      window.Date = FixedDate;
    })();
  `;
}

function tableFromUrl(u) {
  // Supabase REST: /rest/v1/<table>?...
  const m = u.pathname.match(/\/rest\/v1\/([^/?]+)/);
  return m ? m[1] : null;
}

async function installMocks(ctx) {
  // CSS reduced motion
  await ctx.emulateMedia({ reducedMotion: "reduce" });

  // Supabase REST
  await ctx.route(`${SUPABASE_URL}/rest/v1/**`, async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const table = tableFromUrl(u);
    const method = req.method();

    // Writes: pretend success without changing state.
    if (method === "POST" || method === "PATCH" || method === "PUT" || method === "DELETE") {
      const rows = (FIXTURE_TABLES[table] ?? []).slice(0, 1);
      return route.fulfill({
        status: method === "DELETE" ? 204 : 200,
        contentType: "application/json",
        body: JSON.stringify(rows),
      });
    }

    // Reads: return fixture rows for the requested table.
    const rows = FIXTURE_TABLES[table] ?? [];
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(rows),
    });
  });

  // Supabase Storage signed URL endpoint → return a stable signed URL that
  // points at our placeholder data: URL.
  await ctx.route(`${SUPABASE_URL}/storage/v1/object/sign/**`, async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ signedURL: PLACEHOLDER_IMAGE_DATA_URL, signedUrl: PLACEHOLDER_IMAGE_DATA_URL }),
    });
  });

  // Any direct storage object fetch → placeholder bytes.
  await ctx.route(`${SUPABASE_URL}/storage/v1/object/**`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
      "base64",
    );
    return route.fulfill({ status: 200, contentType: "image/png", body: png });
  });

  // Auth endpoints — fully deterministic.
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

async function runOne(browser, vp, step) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  await ctx.addInitScript(buildInitScript());
  await installMocks(ctx);

  const page = await ctx.newPage();
  const failures = [];
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });

  try {
    await page.goto(`${URL}${step.path}`, { waitUntil: "networkidle" });
    await page
      .locator('[data-testid="wizard-layout"]')
      .waitFor({ state: "visible", timeout: 10_000 });

    if ((await page.getByRole("heading", { level: 1 }).count()) === 0) {
      failures.push(`${step.slug} @ ${vp.name}: no <h1>`);
    }

    const stepperItems = await page.locator('[data-testid="wizard-stepper"] li').count();
    if (stepperItems !== 5) {
      failures.push(`${step.slug} @ ${vp.name}: stepper has ${stepperItems} items (need 5)`);
    }

    // The auth gate must NOT render — fixtures are supposed to bypass it.
    if (await page.locator('[data-testid="auth-gate"]').count()) {
      failures.push(`${step.slug} @ ${vp.name}: auth gate rendered despite fixture session`);
    }

    if (errors.length) {
      failures.push(
        `${step.slug} @ ${vp.name}: runtime errors:\n   ${errors.join("\n   ")}`,
      );
    }

    const file = resolve(OUT, `${step.slug}-${vp.name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`✓ ${step.slug} @ ${vp.name} → ${file}`);
  } catch (e) {
    failures.push(`${step.slug} @ ${vp.name}: ${e.message}`);
  } finally {
    await ctx.close();
  }
  return failures;
}

const browser = await chromium.launch();
const allFailures = [];
try {
  for (const vp of VIEWPORTS) {
    for (const step of STEPS) {
      const f = await runOne(browser, vp, step);
      allFailures.push(...f);
    }
  }
} finally {
  await browser.close();
}

if (allFailures.length) {
  console.error("\nFAILURES:\n" + allFailures.map((f) => " - " + f).join("\n"));
  process.exit(1);
}
console.log(`\nAll /create journey checks passed. Screenshots: ${OUT}`);
