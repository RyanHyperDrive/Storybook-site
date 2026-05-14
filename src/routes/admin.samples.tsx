import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldAlert, RefreshCw, Wand2, Image as ImageIcon, AlertTriangle } from "lucide-react";
import { SAMPLE_PROMPTS, ASSET_TYPES, type SampleAssetType } from "@/lib/sample-prompts";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/samples")({
  component: () => (
    <AuthGate>
      <Inner />
    </AuthGate>
  ),
  head: () => ({ meta: [{ title: "Sample Art — Admin" }] }),
});

type Asset = {
  id: string;
  sample_key: string;
  asset_type: SampleAssetType;
  status: string;
  public_url: string | null;
  error_message: string | null;
  kie_task_id: string | null;
  updated_at: string;
};

function Inner() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [missingKey, setMissingKey] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("sample_art_assets")
      .select("id, sample_key, asset_type, status, public_url, error_message, kie_task_id, updated_at");
    setAssets((data ?? []) as Asset[]);
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const admin = !!data?.find((r) => r.role === "admin");
      setIsAdmin(admin);
      if (admin) await load();
    })();
  }, [user, load]);

  const callFn = useCallback(
    async (fn: "generate-sample-art" | "poll-sample-art", body: any, label: string) => {
      setBusy(label);
      try {
        const { data, error } = await supabase.functions.invoke(fn, { body });
        if (error) {
          // Try to read JSON body for structured error
          const ctx = (error as any).context;
          let parsed: any = null;
          try {
            parsed = ctx ? await ctx.json() : null;
          } catch {}
          if (parsed?.code === "missing_kie_key") {
            setMissingKey(true);
            toast.error("Kie API key not configured.");
          } else {
            toast.error(parsed?.error || error.message);
          }
        } else {
          if ((data as any)?.code === "missing_kie_key") {
            setMissingKey(true);
            toast.error("Kie API key not configured.");
          } else {
            setMissingKey(false);
            toast.success(`${label} done`);
          }
        }
      } catch (e: any) {
        toast.error(String(e?.message ?? e));
      } finally {
        setBusy(null);
        await load();
      }
    },
    [load],
  );

  if (isAdmin === null)
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  if (!isAdmin)
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-3 font-display text-2xl font-semibold">Admins only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account doesn't have admin access.
        </p>
      </div>
    );

  const byKey = (sampleKey: string) =>
    Object.fromEntries(
      assets
        .filter((a) => a.sample_key === sampleKey)
        .map((a) => [a.asset_type, a]),
    ) as Partial<Record<SampleAssetType, Asset>>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Sample art</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate and manage marketing sample images via Kie.ai GPT Image 2.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => callFn("poll-sample-art", {}, "Poll all")}
          disabled={busy !== null}
        >
          {busy === "Poll all" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Poll all pending
        </Button>
      </div>

      {missingKey && (
        <div className="mt-6 flex items-start gap-3 rounded-md border border-ember/40 bg-ember/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ember" />
          <div>
            <div className="font-semibold">Kie API key not configured.</div>
            <p className="mt-1 text-muted-foreground">
              Add <code className="font-mono">KIE_API_KEY</code> as a Supabase /
              Lovable Edge Function secret to enable sample art generation. The
              public site will continue showing fallback SVG art until then.
            </p>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-6">
        {SAMPLE_PROMPTS.map((s) => {
          const map = byKey(s.sample_key);
          const missing = ASSET_TYPES.filter((t) => map[t]?.status !== "success");
          return (
            <div key={s.sample_key} className="rounded-lg border border-border bg-background p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {s.style_key}
                  </div>
                  <h2 className="font-display text-lg font-semibold">{s.title}</h2>
                  <code className="text-xs text-muted-foreground">{s.sample_key}</code>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="ember"
                    disabled={busy !== null || missing.length === 0}
                    onClick={() =>
                      callFn(
                        "generate-sample-art",
                        { sample_key: s.sample_key, asset_types: missing },
                        `Generate ${s.sample_key}`,
                      )
                    }
                  >
                    <Wand2 className="mr-2 h-4 w-4" />
                    Generate missing ({missing.length})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() =>
                      callFn(
                        "generate-sample-art",
                        { sample_key: s.sample_key, asset_types: ["cover"] },
                        `Regen cover ${s.sample_key}`,
                      )
                    }
                  >
                    Regenerate cover
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() =>
                      callFn(
                        "generate-sample-art",
                        { sample_key: s.sample_key, asset_types: ["page_1", "page_2"] },
                        `Regen pages ${s.sample_key}`,
                      )
                    }
                  >
                    Regenerate pages
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() =>
                      callFn(
                        "poll-sample-art",
                        { sample_key: s.sample_key },
                        `Poll ${s.sample_key}`,
                      )
                    }
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Poll
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {ASSET_TYPES.map((t) => {
                  const a = map[t];
                  return (
                    <div key={t} className="rounded-md border border-border p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {t}
                        </div>
                        <StatusBadge status={a?.status} />
                      </div>
                      <div className="mt-2 aspect-[3/4] overflow-hidden rounded bg-paper">
                        {a?.public_url ? (
                          <img
                            src={a.public_url}
                            alt={`${t} preview`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="grid h-full place-items-center text-muted-foreground">
                            <ImageIcon className="h-6 w-6 opacity-50" />
                          </div>
                        )}
                      </div>
                      {a?.error_message && (
                        <p className="mt-2 line-clamp-3 text-[11px] text-ember">{a.error_message}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const s = status ?? "missing";
  const cls =
    s === "success"
      ? "bg-sage/15 text-sage"
      : s === "failed"
        ? "bg-ember/15 text-ember"
        : s === "processing" || s === "queued"
          ? "bg-foreground/10 text-foreground"
          : "bg-muted text-muted-foreground";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {s}
    </span>
  );
}
