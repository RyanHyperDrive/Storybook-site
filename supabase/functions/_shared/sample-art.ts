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
    sample_key: "comic_book_nova",
    style_key: "comic_book",
    title: "Nova and the Treehouse Owl",
    prompts: {
      cover:
        "A premium full-bleed children's storybook cover illustration in a cozy adventure comic book style, filling the entire canvas with no white borders or empty margins. Bold ink outlines, halftone dot shading, comic-panel energy, vivid but warm cozy palette. A cheerful kid in everyday adventure clothes — yellow rain jacket, denim shorts, sneakers, small explorer backpack — standing on a wooden treehouse platform in a sunny backyard, waving hello. A small friendly cartoon owl sidekick perches on the railing beside them. String lights, leafy branches, paper-folded pennants, soft afternoon sky. A few decorative empty speech-bubble shapes are okay if they look intentional. Absolutely no fire, no flames, no candles, no lanterns, no weapons, no peril, no superhero cape, no flying. Absolutely no readable text, no letters, no title, no typography anywhere. Vertical 4:5.",
      page_1:
        "Same kid in yellow rain jacket, denim shorts, sneakers, and small explorer backpack, and the same small friendly cartoon owl sidekick, same cozy adventure comic book art direction. Kneeling in a sunny neighborhood backyard discovering a hidden patch of glowing wildflowers and friendly bumblebees, owl peeking from a leafy branch, butterflies, garden fence, soft daylight. Absolutely no fire, no flames, no weapons, no peril, no cape, no flying. Absolutely no readable text, no letters, no speech-bubble text. Vertical 4:5.",
      page_2:
        "Same kid in yellow rain jacket, denim shorts, sneakers, and explorer backpack, and the same small friendly cartoon owl sidekick, same cozy adventure comic book art direction. Sitting cross-legged on the warm wooden floor of a backyard treehouse reading nook, surrounded by neat stacks of picture books with PLAIN BLANK COVERS and a folded paper map, owl perched on a stack of books beside them. Soft golden afternoon daylight through a round window, paper stars hanging on strings, tiny paper confetti drifting. Absolutely no fire, no flames, no candles, no lanterns, no lit objects, no weapons, no peril. Absolutely no readable text, no letters, no pseudo-text, no writing on book covers, no speech bubbles. Vertical 4:5.",
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
        "A polished manga-inspired children's adventure book cover illustration, no words or letters, no title, no typography. A brave child holding a folded red paper dragon that comes alive above mountain rooftops, expressive but age-appropriate, clean precise linework, dynamic cinematic composition, soft screentone texture, premium kid-friendly manga, vertical 4:5, leave quiet space for HTML title overlay.",
      page_1:
        "Same child and paper dragon, same manga-inspired art direction, no words or letters. The red paper dragon lifts from the child's hands in a swirl of wind, expressive wonder, vertical 4:5.",
      page_2:
        "Same child and paper dragon, same manga-inspired art direction, no words or letters. The child rides a trail of folded paper shapes across a moonlit village sky, dynamic but gentle, vertical 4:5.",
    },
  },
  {
    sample_key: "pixel_quinn",
    style_key: "pixel_art",
    title: "Quinn's Pixel Quest",
    prompts: {
      cover:
        "A premium children's 8-bit pixel art book cover illustration, no words or letters, no title, no typography, no readable text or pseudo-text glyphs. Charming retro 16-bit RPG style with crisp chunky pixels, limited cheerful palette, a brave kid pixel hero with a tiny pet pixel fox standing on a hill in front of a magical castle at dawn, glittering pixel stars, parallax pixel mountains, premium nostalgic pixel art, vertical 4:5, leave quiet pixel sky space at the top for an HTML title.",
      page_1:
        "Same kid pixel hero and pet pixel fox, same 8-bit pixel art direction, no words or letters or pseudo-text glyphs. Crossing a tiny pixel bridge over a sparkling river full of pixel fish, crisp chunky pixel blocks, limited cheerful palette, charming retro RPG feel, vertical 4:5.",
      page_2:
        "Same kid pixel hero and pet pixel fox, same 8-bit pixel art direction, no words or letters or pseudo-text glyphs. Finding a glowing pixel treasure chest in a friendly pixel forest clearing with sparkles, crisp chunky pixels, limited cheerful palette, charming retro RPG feel, vertical 4:5.",
    },
  },
];

export const ASSET_TYPES = ["cover", "page_1", "page_2"] as const;
