
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS visual_consistency_contract jsonb,
  ADD COLUMN IF NOT EXISTS cover_image_path text,
  ADD COLUMN IF NOT EXISTS cover_validation jsonb;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- allow owners to update their own payments rows (internal test coupon flow flips status without a webhook)
DROP POLICY IF EXISTS "payments owner update" ON public.payments;
CREATE POLICY "payments owner update"
  ON public.payments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
