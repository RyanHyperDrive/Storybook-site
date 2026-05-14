ALTER TABLE public.child_subjects
  ADD COLUMN IF NOT EXISTS character_image_url text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS twins_distinguishable_confirmed boolean NOT NULL DEFAULT false;

ALTER TABLE public.child_subjects DROP CONSTRAINT IF EXISTS child_subjects_status_check;
ALTER TABLE public.child_subjects
  ADD CONSTRAINT child_subjects_status_check
  CHECK (status IN ('pending','generating','ready','error'));