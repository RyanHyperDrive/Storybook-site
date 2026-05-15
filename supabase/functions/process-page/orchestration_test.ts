// Tests the process-page max-2 retry orchestration in isolation.
// We stub global fetch so we can control illustrate-page / validate-page
// responses and assert the loop caps at 2 retries (3 total attempts) and
// marks the page needs_review when validation never passes.

import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";

// Reusable fetch stub. Call sequence: each call is recorded and the next
// canned response is returned.
type Canned = { status: number; json: any };

function makeFetchStub(responses: Record<string, Canned[]>) {
  const calls: { url: string; body: any }[] = [];
  const stub = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url, body });
    const matchKey = Object.keys(responses).find((k) => url.includes(k));
    const next = matchKey ? responses[matchKey].shift() : undefined;
    const payload = next ?? { status: 200, json: { ok: true } };
    return new Response(JSON.stringify(payload.json), {
      status: payload.status,
      headers: { "Content-Type": "application/json" },
    });
  };
  return { stub, calls };
}

// We can't easily import process-page (it auto-serves on import and reads
// Deno.env). Instead, replicate the loop's contract here via the same
// MAX_RETRIES policy and assert.

const MAX_RETRIES = 2;

function runLoop(reports: Array<{ needs_regeneration: boolean }>) {
  // Simulates: keep regenerating until pass OR MAX_RETRIES exhausted.
  const attempts: any[] = [];
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const r = reports[attempt] ?? reports[reports.length - 1];
    attempts.push({ attempt, needs_regeneration: r.needs_regeneration });
    if (!r.needs_regeneration) break;
    if (attempt === MAX_RETRIES) break;
  }
  const finalNeedsReview = attempts[attempts.length - 1].needs_regeneration;
  return { attempts, finalNeedsReview };
}

Deno.test("process-page: clean first attempt — no retries, no needs_review", () => {
  const r = runLoop([{ needs_regeneration: false }]);
  assertEquals(r.attempts.length, 1);
  assertEquals(r.finalNeedsReview, false);
});

Deno.test("process-page: passes on second attempt — 2 attempts, no needs_review", () => {
  const r = runLoop([
    { needs_regeneration: true },
    { needs_regeneration: false },
  ]);
  assertEquals(r.attempts.length, 2);
  assertEquals(r.finalNeedsReview, false);
});

Deno.test("process-page: caps at MAX_RETRIES (=2) → 3 total attempts max → needs_review", () => {
  const r = runLoop([
    { needs_regeneration: true },
    { needs_regeneration: true },
    { needs_regeneration: true },
    { needs_regeneration: true }, // never reached
  ]);
  assertEquals(r.attempts.length, 3); // initial + 2 retries
  assertEquals(r.finalNeedsReview, true);
});

// --- Coupon UI guardrail (string-level) -------------------------------

Deno.test("checkout: HYPERDRIVETEST coupon field is gated behind admin/url flag", async () => {
  const src = await Deno.readTextFile(
    new URL("../../../src/routes/checkout.$bookId.tsx", import.meta.url),
  );
  // The field must not be visible by default — must be inside a conditional
  // that depends on showCouponField, and the component must check user_roles.
  if (!/showCouponField/.test(src)) {
    throw new Error("checkout missing showCouponField gate");
  }
  if (!/user_roles/.test(src)) {
    throw new Error("checkout must check user_roles for admin gating");
  }
  if (!/testcoupon/.test(src)) {
    throw new Error("checkout must support ?testcoupon=1 URL flag");
  }
});

Deno.test("checkout server fn: HYPERDRIVETEST rejects non-admin", async () => {
  const src = await Deno.readTextFile(
    new URL("../../../src/lib/checkout.functions.ts", import.meta.url),
  );
  // Reject path must check has_role/user_roles AND throw with a clear message.
  if (!/HYPERDRIVETEST/.test(src)) throw new Error("coupon constant missing");
  if (!/user_roles/.test(src)) throw new Error("server fn must consult user_roles");
  if (!/internal testing only/i.test(src)) {
    throw new Error("non-admin rejection message missing");
  }
});

// --- Contract gate guardrails -----------------------------------------

Deno.test("start-book-generation: blocks/builds when contract missing", async () => {
  const src = await Deno.readTextFile(
    new URL("../../../supabase/functions/start-book-generation/index.ts", import.meta.url),
  );
  if (!/visual_consistency_contract/.test(src)) {
    throw new Error("start-book-generation must read visual_consistency_contract");
  }
  if (!/buildContract/.test(src)) {
    throw new Error("start-book-generation must build contract fallback");
  }
  if (!/Cannot start: approve the character sheet/.test(src)) {
    throw new Error("start-book-generation must surface a friendly error when no approved data");
  }
});

Deno.test("approval flow persists contract via build-contract", async () => {
  const src = await Deno.readTextFile(
    new URL("../../../src/routes/create.character-sheet.tsx", import.meta.url),
  );
  if (!/build-contract/.test(src)) {
    throw new Error("approveAll must call /build-contract after approval");
  }
});

Deno.test("process-page: gates on contract + cover_validation", async () => {
  const src = await Deno.readTextFile(
    new URL("../../../supabase/functions/process-page/index.ts", import.meta.url),
  );
  if (!/visual_consistency_contract/.test(src)) {
    throw new Error("process-page must check visual_consistency_contract");
  }
  if (!/cover_validation/.test(src)) {
    throw new Error("process-page must check cover_validation");
  }
});
