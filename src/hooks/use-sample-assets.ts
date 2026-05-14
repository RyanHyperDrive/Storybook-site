import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ArtStyleKey } from "@/lib/art-styles";

export type SampleAsset = {
  id: string;
  sample_key: string;
  style_key: string;
  asset_type: "cover" | "page_1" | "page_2";
  status: string;
  public_url: string | null;
};

/** Map: { [sample_key]: { cover?: url, page_1?: url, page_2?: url } } */
export type SampleAssetMap = Record<
  string,
  Partial<Record<"cover" | "page_1" | "page_2", string>>
>;

export function useSampleAssets() {
  const [assets, setAssets] = useState<SampleAssetMap>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("sample_art_assets")
        .select("sample_key, asset_type, status, public_url")
        .eq("status", "success");
      if (!active) return;
      const map: SampleAssetMap = {};
      for (const row of (data ?? []) as any[]) {
        if (!row.public_url) continue;
        map[row.sample_key] ??= {};
        map[row.sample_key][row.asset_type as "cover" | "page_1" | "page_2"] =
          row.public_url;
      }
      setAssets(map);
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  return { assets, loaded };
}

/** Map ArtStyleKey → sample_key (mirrors src/lib/sample-prompts.ts). */
export const SAMPLE_KEY_BY_STYLE: Record<ArtStyleKey, string> = {
  classic_storybook: "classic_storybook_mira",
  soft_cartoon: "soft_cartoon_leo",
  watercolor_adventure: "watercolor_pip",
  manga_inspired: "manga_yuki",
};
