// Shared helpers for sample-art edge functions.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function getAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

/** Verify the caller is an admin. Returns userId or throws Response. */
export async function requireAdmin(req: Request): Promise<string> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    throw jsonResponse({ error: "Unauthorized" }, 401);
  }
  const token = auth.slice("Bearer ".length);
  const admin = getAdminClient();
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) {
    throw jsonResponse({ error: "Unauthorized" }, 401);
  }
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);
  const isAdmin = !!roles?.find((r: any) => r.role === "admin");
  if (!isAdmin) throw jsonResponse({ error: "Forbidden" }, 403);
  return userData.user.id;
}

export function requireKieKey(): string {
  const key = Deno.env.get("KIE_API_KEY");
  if (!key) {
    throw jsonResponse(
      {
        error: "KIE_API_KEY is not configured",
        code: "missing_kie_key",
        message:
          "Add KIE_API_KEY as a Supabase/Lovable Edge Function secret to enable sample art generation.",
      },
      503,
    );
  }
  return key;
}

export const SAMPLE_PROMPTS: Array<{
  sample_key: string;
  style_key: string;
  title: string;
  prompts: { cover: string; page_1: string; page_2: string };
}> = [
  {
    sample_key: "classic_storybook_mira",
    style_key: "classic_storybook",
    title: "Mira and the Whispering Woods",
    prompts: {
      cover:
        "A polished children's picture book cover illustration, no words or letters, no title, no typography. A warm classic storybook forest scene with a curious child explorer in a cozy red cape, soft moss, friendly fireflies, old trees, gentle golden evening light, whimsical but premium, consistent children's-book illustration, vertical 3:4 composition, leave natural quiet space for HTML title overlay.",
      page_1:
        "Same child and same classic storybook art direction, no words or letters. The child kneels beside a tiny glowing door at the base of an old tree while fireflies gather, warm forest lighting, gentle wonder, vertical 3:4.",
      page_2:
        "Same child and same classic storybook art direction, no words or letters. The child follows a trail of glowing leaves through a friendly moonlit forest, cozy magical atmosphere, vertical 3:4.",
    },
  },
  {
    sample_key: "soft_cartoon_leo",
    style_key: "soft_cartoon",
    title: "Leo Visits the Stars",
    prompts: {
      cover:
        "A polished soft cartoon children's book cover illustration, no words or letters, no title, no typography. A cheerful child astronaut floating near a friendly rocket and smiling moon, bright stars, rounded shapes, playful color, premium modern kids animation feel, vertical 3:4, leave quiet space for HTML title overlay.",
      page_1:
        "Same child astronaut and same soft cartoon art direction, no words or letters. The child waves from a tiny rocket window as colorful planets drift nearby, joyful and clean, vertical 3:4.",
      page_2:
        "Same child astronaut and same soft cartoon art direction, no words or letters. The child bounces gently across a moon path with star-shaped footprints, playful and bright, vertical 3:4.",
    },
  },
  {
    sample_key: "watercolor_pip",
    style_key: "watercolor_adventure",
    title: "The Tea Party with Pip",
    prompts: {
      cover:
        "A polished watercolor children's book cover illustration, no words or letters, no title, no typography. A gentle garden tea party with a joyful child and a small friendly stuffed-bunny-like companion named Pip, flowers, teapot, soft washes, paper texture, delicate ink accents, premium picture book look, vertical 3:4, leave quiet space for HTML title overlay.",
      page_1:
        "Same child and Pip, same watercolor art direction, no words or letters. The child pours pretend tea for Pip under a blooming garden arch, soft pastel washes, vertical 3:4.",
      page_2:
        "Same child and Pip, same watercolor art direction, no words or letters. Pip points toward a hidden path of petals leading into the garden, gentle adventure, vertical 3:4.",
    },
  },
  {
    sample_key: "manga_yuki",
    style_key: "manga_inspired",
    title: "Yuki and the Paper Dragon",
    prompts: {
      cover:
        "A polished manga-inspired children's adventure book cover illustration, no words or letters, no title, no typography. A brave child holding a folded red paper dragon that comes alive above mountain rooftops, expressive but age-appropriate, clean linework, dynamic composition, soft screen-tone texture, premium kid-friendly manga, vertical 3:4, leave quiet space for HTML title overlay.",
      page_1:
        "Same child and paper dragon, same manga-inspired art direction, no words or letters. The red paper dragon lifts from the child's hands in a swirl of wind, expressive wonder, vertical 3:4.",
      page_2:
        "Same child and paper dragon, same manga-inspired art direction, no words or letters. The child rides a trail of folded paper shapes across a moonlit village sky, dynamic but gentle, vertical 3:4.",
    },
  },
];

export const ASSET_TYPES = ["cover", "page_1", "page_2"] as const;
