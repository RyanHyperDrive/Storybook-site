ALTER TABLE public.child_subjects
  ADD COLUMN IF NOT EXISTS photo_analysis jsonb,
  ADD COLUMN IF NOT EXISTS photo_analyzed_at timestamptz;