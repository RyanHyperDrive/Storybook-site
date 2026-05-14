// Admin-only: kick off Kie.ai GPT Image 2 generation for sample marketing art.
// deno-lint-ignore-file no-explicit-any
import {
  ASSET_TYPES,
  SAMPLE_PROMPTS,
  corsHeaders,
  getAdminClient,
  jsonResponse,
  requireAdmin,
  requireKieKey,
} from "../_shared/sample-art.ts";

const KIE_CREATE_URL = "https://api.kie.ai/api/v1/jobs/createTask";
const MODEL = "gpt-image-2-text-to-image";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await requireAdmin(req);
    const kieKey = requireKieKey();

    const body = await req.json().catch(() => ({}));
    const sample_key: string | undefined = body.sample_key;
    const requested: string[] = Array.isArray(body.asset_types) && body.asset_types.length
      ? body.asset_types
      : [...ASSET_TYPES];

    if (!sample_key) return jsonResponse({ error: "sample_key required" }, 400);
    const def = SAMPLE_PROMPTS.find((s) => s.sample_key === sample_key);
    if (!def) return jsonResponse({ error: "Unknown sample_key" }, 400);

    const admin = getAdminClient();
    const results: any[] = [];

    for (const asset_type of requested) {
      if (!ASSET_TYPES.includes(asset_type as any)) continue;
      const prompt = def.prompts[asset_type as keyof typeof def.prompts];

      // Upsert pending row
      const { data: upserted, error: upsertErr } = await admin
        .from("sample_art_assets")
        .upsert(
          {
            sample_key,
            style_key: def.style_key,
            asset_type,
            prompt,
            status: "queued",
            error_message: null,
            kie_task_id: null,
            source_url: null,
          },
          { onConflict: "sample_key,asset_type" },
        )
        .select()
        .single();

      if (upsertErr) {
        results.push({ asset_type, ok: false, error: upsertErr.message });
        continue;
      }

      // Call Kie createTask
      try {
        const kieRes = await fetch(KIE_CREATE_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${kieKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: MODEL,
            input: {
              prompt,
              aspect_ratio: "3:4",
              resolution: "2K",
            },
          }),
        });
        const kieJson: any = await kieRes.json().catch(() => ({}));
        if (!kieRes.ok) {
          await admin
            .from("sample_art_assets")
            .update({
              status: "failed",
              error_message: `Kie create error ${kieRes.status}: ${JSON.stringify(kieJson).slice(0, 400)}`,
            })
            .eq("id", upserted.id);
          results.push({ asset_type, ok: false, error: `Kie ${kieRes.status}` });
          continue;
        }

        const taskId =
          kieJson?.data?.taskId ?? kieJson?.data?.task_id ?? kieJson?.taskId ?? null;
        if (!taskId) {
          await admin
            .from("sample_art_assets")
            .update({
              status: "failed",
              error_message: `Kie response missing taskId: ${JSON.stringify(kieJson).slice(0, 400)}`,
            })
            .eq("id", upserted.id);
          results.push({ asset_type, ok: false, error: "missing taskId" });
          continue;
        }

        await admin
          .from("sample_art_assets")
          .update({ status: "processing", kie_task_id: taskId })
          .eq("id", upserted.id);

        results.push({ asset_type, ok: true, taskId });
      } catch (e: any) {
        await admin
          .from("sample_art_assets")
          .update({ status: "failed", error_message: String(e?.message ?? e) })
          .eq("id", upserted.id);
        results.push({ asset_type, ok: false, error: String(e?.message ?? e) });
      }
    }

    return jsonResponse({ ok: true, sample_key, results });
  } catch (resp) {
    if (resp instanceof Response) return resp;
    return jsonResponse({ error: String((resp as any)?.message ?? resp) }, 500);
  }
});
