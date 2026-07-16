BEGIN;

DROP POLICY IF EXISTS "Authenticated users can view system configurations"
  ON public.system_configurations;
DROP POLICY IF EXISTS "Authenticated users can view non-secret system configurations"
  ON public.system_configurations;

DO $$
DECLARE
  key_expression text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'system_configurations'
      AND column_name = 'config_key'
  ) THEN
    key_expression := 'lower(coalesce(config_key::text, ''''))';
  ELSE
    key_expression := 'lower(coalesce(label::text, ''''))';
  END IF;

  EXECUTE format(
    'CREATE POLICY %I ON public.system_configurations FOR SELECT TO authenticated USING (%s NOT IN (''supabase_service_role_key'', ''service_role_key''))',
    'Authenticated users can view non-secret system configurations',
    key_expression
  );
END;
$$;

COMMIT;
