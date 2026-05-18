import { supabase } from "@/integrations/supabase/client";
import { setDraftId } from "@/lib/draft";

export type SavedCharacter = {
  id: string;
  user_id: string;
  source_book_id: string | null;
  source_subject_id: string | null;
  name: string;
  age: number | null;
  pronouns: string | null;
  loves: string | null;
  favorite_color: string | null;
  favorite_activities: string | null;
  personality_traits: string | null;
  accessibility_details: string | null;
  art_style: string | null;
  character_image_path: string;
  reference_storage_path: string | null;
  description: string | null;
  created_at: string;
};

/**
 * Persist an approved child + character into the user's reusable library.
 * Safe to call multiple times — the unique index on source_subject_id dedupes.
 */
export async function saveApprovedCharacter(args: {
  userId: string;
  bookId: string;
  subjectId: string;
  child: {
    name: string;
    age: number | null;
    pronouns: string | null;
    loves: string | null;
    favorite_color: string | null;
    favorite_activities: string | null;
    personality_traits: string | null;
    accessibility_details: string | null;
  };
  artStyle: string | null;
  characterImagePath: string;
  referenceStoragePath: string | null;
  description: string | null;
}) {
  const { error } = await supabase
    .from("saved_characters")
    .upsert(
      {
        user_id: args.userId,
        source_book_id: args.bookId,
        source_subject_id: args.subjectId,
        name: args.child.name,
        age: args.child.age,
        pronouns: args.child.pronouns,
        loves: args.child.loves,
        favorite_color: args.child.favorite_color,
        favorite_activities: args.child.favorite_activities,
        personality_traits: args.child.personality_traits,
        accessibility_details: args.child.accessibility_details,
        art_style: args.artStyle,
        character_image_path: args.characterImagePath,
        reference_storage_path: args.referenceStoragePath,
        description: args.description,
      },
      { onConflict: "source_subject_id" },
    );
  if (error) throw error;
}

/**
 * Create a brand-new draft book seeded from a saved character. The child
 * profile and its illustrated character are copied in as already-approved,
 * so the parent can skip straight to story + style selection.
 */
export async function startBookFromSavedCharacter(userId: string, saved: SavedCharacter) {
  // 1. New book draft, pre-populated with the saved child's details + art style.
  const { data: book, error: bookErr } = await supabase
    .from("books")
    .insert({
      user_id: userId,
      status: "draft",
      child_name: saved.name,
      child_age: saved.age,
      child_pronouns: saved.pronouns,
      child_loves: saved.loves,
      art_style: saved.art_style,
      is_twins: false,
    })
    .select()
    .single();
  if (bookErr || !book) throw bookErr ?? new Error("Could not create book");

  // 2. Child profile attached to the new book.
  const { data: childProfile, error: childErr } = await supabase
    .from("child_profiles")
    .insert({
      user_id: userId,
      book_id: book.id,
      slot: "primary",
      name: saved.name,
      age: saved.age,
      pronouns: saved.pronouns,
      loves: saved.loves,
      favorite_color: saved.favorite_color,
      favorite_activities: saved.favorite_activities,
      personality_traits: saved.personality_traits,
      accessibility_details: saved.accessibility_details,
      default_art_style: saved.art_style,
    })
    .select()
    .single();
  if (childErr || !childProfile) throw childErr ?? new Error("Could not copy child profile");

  // 3. Pre-approved child_subject pointing at the saved character image.
  const { error: subjErr } = await supabase.from("child_subjects").insert({
    user_id: userId,
    child_profile_id: childProfile.id,
    status: "ready",
    approved: true,
    character_image_url: saved.character_image_path,
    reference_storage_path: saved.reference_storage_path,
    description: saved.description,
  });
  if (subjErr) throw subjErr;

  // 4. Mirror onto the book-level character_sheets row so downstream
  //    generation jobs find the approved reference immediately.
  const { error: sheetErr } = await supabase.from("character_sheets").insert({
    book_id: book.id,
    user_id: userId,
    approved: true,
    image_url: saved.character_image_path,
    description: saved.description,
  });
  if (sheetErr) throw sheetErr;

  setDraftId(book.id);
  return book;
}
