CREATE TABLE public.gift_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gifter_name text,
  gifter_email text NOT NULL,
  parent_name text,
  parent_email text NOT NULL,
  child_first_name text,
  child_age integer,
  dedication_message text,
  hardcover_interest boolean NOT NULL DEFAULT false,
  stripe_session_id text,
  stripe_payment_intent_id text,
  status text NOT NULL DEFAULT 'awaiting_payment'
    CHECK (status IN ('awaiting_payment','awaiting_parent_upload','book_in_progress','complete','refunded')),
  upload_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

ALTER TABLE public.gift_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gift_orders admin read"
  ON public.gift_orders FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "gift_orders anyone insert"
  ON public.gift_orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    gifter_email IS NOT NULL
    AND parent_email IS NOT NULL
    AND length(gifter_email) BETWEEN 5 AND 320
    AND length(parent_email) BETWEEN 5 AND 320
    AND gifter_email LIKE '%_@_%.__%'
    AND parent_email LIKE '%_@_%.__%'
  );

CREATE INDEX idx_gift_orders_gifter_email ON public.gift_orders(lower(gifter_email));
CREATE INDEX idx_gift_orders_parent_email ON public.gift_orders(lower(parent_email));
CREATE INDEX idx_gift_orders_upload_token ON public.gift_orders(upload_token);