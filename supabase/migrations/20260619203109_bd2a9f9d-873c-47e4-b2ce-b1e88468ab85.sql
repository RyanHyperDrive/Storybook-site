ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS locked_at timestamptz;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS consecutive_errors int NOT NULL DEFAULT 0;