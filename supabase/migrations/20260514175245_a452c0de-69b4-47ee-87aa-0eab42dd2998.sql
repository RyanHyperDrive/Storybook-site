ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS current_step text NOT NULL DEFAULT 'photo_check';