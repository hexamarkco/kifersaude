BEGIN;

DROP POLICY IF EXISTS "Authenticated users can view system configurations"
  ON public.system_configurations;
DROP POLICY IF EXISTS "Authenticated users can view non-secret system configurations"
  ON public.system_configurations;

CREATE POLICY "Authenticated users can view non-secret system configurations"
  ON public.system_configurations
  FOR SELECT
  TO authenticated
  USING (
    lower(label) NOT IN ('supabase_service_role_key', 'service_role_key')
  );

COMMIT;
