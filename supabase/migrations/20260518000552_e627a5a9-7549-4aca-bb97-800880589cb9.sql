CREATE TABLE IF NOT EXISTS public.waitlist_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (length(email) >= 5 AND length(email) <= 320 AND email LIKE '%_@_%.__%'),
  source text NOT NULL CHECK (source IN ('hardcover','gift_edition','exit_intent')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "waitlist admin read"
  ON public.waitlist_signups
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "waitlist anyone insert"
  ON public.waitlist_signups
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL
    AND length(email) BETWEEN 5 AND 320
    AND source IN ('hardcover','gift_edition','exit_intent')
  );