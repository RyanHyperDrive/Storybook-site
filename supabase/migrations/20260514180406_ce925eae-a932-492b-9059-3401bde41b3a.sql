ALTER TABLE public.book_pages
  ADD COLUMN IF NOT EXISTS quality_score numeric(5,2),
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_notes text;

CREATE INDEX IF NOT EXISTS book_pages_needs_review_idx
  ON public.book_pages (needs_review)
  WHERE needs_review = true;

CREATE INDEX IF NOT EXISTS book_pages_status_idx
  ON public.book_pages (status);
