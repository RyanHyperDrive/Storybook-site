ALTER TABLE public.book_pages ADD COLUMN IF NOT EXISTS quality_metadata jsonb;
CREATE INDEX IF NOT EXISTS idx_book_pages_needs_review ON public.book_pages (needs_review) WHERE needs_review = true;
CREATE INDEX IF NOT EXISTS idx_book_pages_quality_metadata_age_band ON public.book_pages ((quality_metadata->>'age_band'));