// Admin-only: poll Kie.ai for pending tasks, download successful results,
// and persist them to the public-samples Supabase Storage bucket.
// deno-lint-ignore-file no-explicit-any
import {
  corsHeaders,
  getAdminClient,
  jsonResponse,
  requireAdmin,
  requireKieKey,
} from "../_shared/sample-art.ts";

const KIE_INFO_URL = "https://api.kie.ai/api/v1/jobs/recordInfo";
const BUCKET = "public-samples";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await requireAdmin(req);
    const kieKey = requireKieKey();
    const admin = getAdminClient();

    const body = await req.json().catch(() => ({}));
    const sampleFilter: string | undefined = body.sample_key;

    let q = admin
      .from("sample_art_assets")
      .select("*")
      .in("status", ["queued", "processing"])
      .not("kie_task_id", "is", null);
    if (sampleFilter) q = q.eq("sample_key", sampleFilter);

    const { data: pending, error } = await q;
    if (error) return jsonResponse({ error: error.message }, 500);

    const results: any[] = [];
    for (const row of pending ?? []) {
      try {
        const infoRes = await fetch(
          `${KIE_INFO_URL}?taskId=${encodeURIComponent(row.kie_task_id)}`,
          { headers: { "Authorization": `Bearer ${kieKey}` } },
        );
        const infoJson: any = await infoRes.json().catch(() => ({}));
        const data = infoJson?.data ?? {};
        const state = data.state;

        if (state === "success") {
          let resultUrls: string[] = [];
          try {
            const parsed =
              typeof data.resultJson === "string"
                ? JSON.parse(data.resultJson)
                : data.resultJson;
            resultUrls = parsed?.resultUrls ?? [];
          } catch {
            resultUrls = data?.resultJson?.resultUrls ?? [];
          }
          const sourceUrl = resultUrls[0];
          if (!sourceUrl) {
            await admin
              .from("sample_art_assets")
              .update({ status: "failed", error_message: "No resultUrls in success response" })
              .eq("id", row.id);
            results.push({ id: row.id, ok: false, error: "no resultUrls" });
            continue;
          }

          // Download and upload to storage
          const imgRes = await fetch(sourceUrl);
          if (!imgRes.ok) {
            await admin
              .from("sample_art_assets")
              .update({ status: "failed", error_message: `Download failed ${imgRes.status}` })
              .eq("id", row.id);
            results.push({ id: row.id, ok: false, error: `download ${imgRes.status}` });
            continue;
          }
          const buf = new Uint8Array(await imgRes.arrayBuffer());
          const path = `samples/${row.sample_key}/${row.asset_type}.png`;
          const { error: upErr } = await admin.storage
            .from(BUCKET)
            .upload(path, buf, { contentType: "image/png", upsert: true });
          if (upErr) {
            await admin
              .from("sample_art_assets")
              .update({ status: "failed", error_message: `Upload error: ${upErr.message}` })
              .eq("id", row.id);
            results.push({ id: row.id, ok: false, error: upErr.message });
            continue;
          }
          const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
          await admin
            .from("sample_art_assets")
            .update({
              status: "success",
              source_url: sourceUrl,
              storage_path: path,
              public_url: pub.publicUrl,
              error_message: null,
            })
            .eq("id", row.id);
          results.push({ id: row.id, ok: true, public_url: pub.publicUrl });
        } else if (state === "fail" || state === "failed") {
          await admin
            .from("sample_art_assets")
            .update({
              status: "failed",
              error_message: data.failMsg || data.errorMessage || "Kie task failed",
            })
            .eq("id", row.id);
          results.push({ id: row.id, ok: false, error: "kie failed" });
        } else {
          // still processing
          results.push({ id: row.id, ok: true, state: state ?? "processing" });
        }
      } catch (e: any) {
        results.push({ id: row.id, ok: false, error: String(e?.message ?? e) });
      }
    }

    return jsonResponse({ ok: true, polled: results.length, results });
  } catch (resp) {
    if (resp instanceof Response) return resp;
    return jsonResponse({ error: String((resp as any)?.message ?? resp) }, 500);
  }
});
