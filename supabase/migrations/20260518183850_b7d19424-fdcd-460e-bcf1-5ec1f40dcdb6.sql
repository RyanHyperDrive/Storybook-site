
CREATE TABLE IF NOT EXISTS public.saved_characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_book_id uuid,
  source_subject_id uuid,
  name text NOT NULL,
  age int,
  pronouns text,
  loves text,
  favorite_color text,
  favorite_activities text,
  personality_traits text,
  accessibility_details text,
  art_style text,
  character_image_path text NOT NULL,
  reference_storage_path text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_characters owner select"
  ON public.saved_characters FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "saved_characters owner insert"
  ON public.saved_characters FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_characters owner update"
  ON public.saved_characters FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_characters owner delete"
  ON public.saved_characters FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_saved_characters_user
  ON public.saved_characters(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_characters_source_subject
  ON public.saved_characters(source_subject_id)
  WHERE source_subject_id IS NOT NULL;

CREATE TRIGGER trg_saved_characters_touch
  BEFORE UPDATE ON public.saved_characters
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
