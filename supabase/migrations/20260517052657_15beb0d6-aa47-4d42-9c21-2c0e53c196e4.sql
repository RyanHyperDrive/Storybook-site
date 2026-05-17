ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS audit jsonb NOT NULL DEFAULT '{"events":[],"totals":{"validations":0,"failures":0,"retries":0}}'::jsonb,
  ADD COLUMN IF NOT EXISTS total_retries integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_validations integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_failures integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS jobs_audit_gin_idx ON public.jobs USING gin (audit);