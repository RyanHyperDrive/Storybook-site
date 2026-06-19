// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";

/**
 * POST /drive-book
 * Body: { jobId: string, attempt?: number }
 *
 * Server-side background driver. Loops run-book-step using the caller's JWT
 * so generation continues even if the browser tab is closed. Self-continues
 * via EdgeRuntime.waitUntil up to a hard cap on attempts.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const MAX_ATTEMPTS = 30;
const MAX_ITERATIONS_PER_INVOCATION = 12;
const MAX_WALL_MS = 90_000;

declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void } | undefined;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "method" }, 200);

  const authHeader = req.headers.get("Authorization") ?? "";

  try {
    const { user, admin } = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const jobId: string | undefined = body?.jobId;
    const attempt: number = typeof body?.attempt === "number" ? body.attempt : 0;
    if (!jobId) return jsonResponse({ ok: false, error: "jobId required" }, 200);

    const { data: job } = await admin.from("jobs").select("id,user_id,status").eq("id", jobId).maybeSingle();
    if (!job) return jsonResponse({ ok: false, error: "not found" }, 200);
    if (job.user_id !== user.id) return jsonResponse({ ok: false, error: "forbidden" }, 200);

    let currentStatus = job.status as string;
    const start = Date.now();

    for (let i = 0; i < MAX_ITERATIONS_PER_INVOCATION; i++) {
      if (currentStatus === "done" || currentStatus === "error") break;
      if (Date.now() - start > MAX_WALL_MS) break;

      try {
        await fetch(`${SUPABASE_URL}/functions/v1/run-book-step`, {
          method: "POST",
          headers: { Authorization: authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        });
      } catch (_e) {
        // swallow; loop will re-check status
      }

      const { data: updated } = await admin
        .from("jobs")
        .select("status")
        .eq("id", jobId)
        .maybeSingle();
      currentStatus = (updated?.status as string) ?? currentStatus;
    }

    const finished = currentStatus === "done" || currentStatus === "error";

    if (!finished && attempt < MAX_ATTEMPTS) {
      const next = fetch(`${SUPABASE_URL}/functions/v1/drive-book`, {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, attempt: attempt + 1 }),
      }).catch(() => {});
      try {
        if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
          EdgeRuntime.waitUntil(next as unknown as Promise<unknown>);
        }
      } catch (_e) { /* ignore */ }
      return jsonResponse({ ok: true, continuing: true, attempt: attempt + 1 });
    }

    return jsonResponse({ ok: true, done: finished, status: currentStatus });
  } catch (err) {
    if (err instanceof Response) {
      // auth failure — return 200 so client doesn't surface; backup poll continues
      return jsonResponse({ ok: false, error: "auth" }, 200);
    }
    return jsonResponse({ ok: false, error: (err as Error)?.message ?? "error" }, 200);
  }
});
