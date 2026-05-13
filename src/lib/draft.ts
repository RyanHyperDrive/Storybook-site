import { supabase } from "@/integrations/supabase/client";

const DRAFT_KEY = "storynest:draft_book_id";

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
    if (data && data.user_id === userId) return data;
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
