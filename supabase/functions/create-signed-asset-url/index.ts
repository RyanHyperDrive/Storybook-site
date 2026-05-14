// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";

/**
 * POST /create-signed-asset-url
 * Body: { bucket: string, path: string, expiresIn?: number }
 *
 * Returns a short-lived signed URL for a private asset, after verifying
 * the asset belongs to the calling user. Allowed buckets are whitelisted.
 */
const ALLOWED_BUCKETS = new Set([
  "raw-uploads",
  "character-sheets",
  "generated-pages",
  "pdfs",
  "storynest",
]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const { user, admin } = await requireUser(req);
    const { bucket, path, expiresIn } = await req.json();
    if (!bucket || !path) return errorResponse("bucket and path are required");
    if (!ALLOWED_BUCKETS.has(bucket)) return errorResponse("Bucket not allowed", 400);

    // Ownership check: every private asset is stored under the user's uid as
    // the first folder segment. Reject anything outside that namespace.
    const firstSegment = String(path).split("/")[0];
    if (firstSegment !== user.id) {
      return errorResponse("Not found or forbidden", 403);
    }

    const ttl = Math.min(Math.max(Number(expiresIn) || 300, 30), 3600);
    const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, ttl);
    if (error || !data) return errorResponse(error?.message ?? "Could not sign URL", 500);

    return jsonResponse({ url: data.signedUrl, expiresIn: ttl });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("create-signed-asset-url error", e);
    return errorResponse(e?.message ?? "Internal error", 500);
  }
});
