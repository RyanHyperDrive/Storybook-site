import { supabase } from "@/integrations/supabase/client";
import { isArtStyleKey } from "@/lib/art-styles";

const DRAFT_KEY = "storynest:draft_book_id";

export const PROFILE_LOCAL_KEY = "storynest:profile_draft_v2";
export const STORY_LOCAL_KEY = "storynest:story_draft_v1";
export const STYLE_LOCAL_KEY = "storynest:style_draft_v1";

export function getDraftId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(DRAFT_KEY);
}
export function setDraftId(id: string) {
  localStorage.setItem(DRAFT_KEY, id);
}
export function clearDraftId() {
  localStorage.removeItem(DRAFT_KEY);
}

export async function ensureDraftBook(userId: string) {
  const existing = getDraftId();
  if (existing) {
    const { data } = await supabase.from("books").select("*").eq("id", existing).maybeSingle();
    if (data && data.user_id === userId && data.status === "draft") return data;
    // Stale pointer (missing, other user, or already submitted/finished) — clear it.
    clearDraftId();
  }
  const { data, error } = await supabase
    .from("books")
    .insert({ user_id: userId, status: "draft" })
    .select()
    .single();
  if (error) throw error;
  setDraftId(data.id);
  return data;
}

function readJSON<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * After a user signs in, push any anonymous draft data
 * (profile, story, style) from localStorage into the database.
 * Safe to call multiple times — only fills fields that haven't been set yet.
 */
export async function syncAnonymousDraftToDb(userId: string, bookId: string) {
  // ---- Profile (child_profiles + legacy book columns + is_twins)
  const profile = readJSON<{
    isTwins: boolean;
    children: Array<{
      name: string;
      age: string;
      pronouns: string;
      favorite_color: string;
      favorite_activities: string;
      loves: string;
      personality_traits: string;
      accessibility_details: string;
    }>;
  }>(PROFILE_LOCAL_KEY);

  if (profile && profile.children?.[0]?.name) {
    const { data: existingKids } = await supabase
      .from("child_profiles")
      .select("id")
      .eq("book_id", bookId);
    if (!existingKids || existingKids.length === 0) {
      const primary = profile.children[0];
      const slots: Array<["primary" | "sibling", typeof primary]> = [["primary", primary]];
      if (profile.isTwins && profile.children[1]?.name) {
        slots.push(["sibling", profile.children[1]]);
      }
      await supabase
        .from("books")
        .update({
          child_name: primary.name,
          child_age: primary.age ? parseInt(primary.age) : null,
          child_pronouns: primary.pronouns || null,
          child_loves: primary.loves || null,
          is_twins: !!profile.isTwins,
        })
        .eq("id", bookId);
      await supabase.from("child_profiles").insert(
        slots.map(([slot, c]) => ({
          user_id: userId,
          book_id: bookId,
          slot,
          name: c.name,
          age: c.age ? parseInt(c.age) : null,
          pronouns: c.pronouns || null,
          favorite_color: c.favorite_color || null,
          favorite_activities: c.favorite_activities || null,
          loves: c.loves || null,
          personality_traits: c.personality_traits || null,
          accessibility_details: c.accessibility_details || null,
        })),
      );
    }
  }

  // ---- Story
  const story = readJSON<{
    title?: string;
    theme?: string;
    prompt?: string;
    detailsInclude?: string;
    detailsAvoid?: string;
    dedication?: string;
    readingLevel?: string;
    consent?: boolean;
  }>(STORY_LOCAL_KEY);

  if (story) {
    const update: Partial<{
      title: string;
      story_theme: string;
      story_prompt: string;
      details_include: string;
      details_avoid: string;
      dedication: string;
      reading_level: string;
      guardian_consent_at: string;
    }> = {};
    if (story.title) update.title = story.title;
    if (story.theme) update.story_theme = story.theme;
    if (story.prompt) update.story_prompt = story.prompt;
    if (story.detailsInclude) update.details_include = story.detailsInclude;
    if (story.detailsAvoid) update.details_avoid = story.detailsAvoid;
    if (story.dedication) update.dedication = story.dedication;
    if (story.readingLevel) update.reading_level = story.readingLevel;
    if (story.consent) update.guardian_consent_at = new Date().toISOString();
    if (Object.keys(update).length) {
      await supabase.from("books").update(update).eq("id", bookId);
    }
  }

  // ---- Style
  const styleKey = typeof window !== "undefined" ? localStorage.getItem(STYLE_LOCAL_KEY) : null;
  if (styleKey && isArtStyleKey(styleKey)) {
    await supabase.from("books").update({ art_style: styleKey }).eq("id", bookId);
  }
}
