ALTER TABLE public.uploaded_photos
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending_quality_check',
  ADD COLUMN IF NOT EXISTS slot text;

ALTER TABLE public.uploaded_photos
  DROP CONSTRAINT IF EXISTS uploaded_photos_status_check;
ALTER TABLE public.uploaded_photos
  ADD CONSTRAINT uploaded_photos_status_check
  CHECK (status IN ('pending_quality_check','accepted','needs_replacement'));

ALTER TABLE public.uploaded_photos
  DROP CONSTRAINT IF EXISTS uploaded_photos_slot_check;
ALTER TABLE public.uploaded_photos
  ADD CONSTRAINT uploaded_photos_slot_check
  CHECK (slot IS NULL OR slot IN ('primary','sibling','together'));