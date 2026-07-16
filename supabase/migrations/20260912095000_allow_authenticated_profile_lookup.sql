BEGIN;

DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;

CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR lower(email) = lower(NULLIF(auth.jwt()->>'email', ''))
  );

COMMIT;
