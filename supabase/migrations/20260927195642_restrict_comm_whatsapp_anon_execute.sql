BEGIN;

-- Inbox RPCs are called with an authenticated Supabase session. Leaving the
-- explicit anon grant in place allows unauthenticated clients to read or
-- mutate CRM data through SECURITY DEFINER functions, even when PUBLIC has
-- already been revoked.
DO $migration$
DECLARE
  function_row record;
BEGIN
  FOR function_row IN
    SELECT
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS identity_arguments
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'comm_whatsapp%'
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon',
      function_row.proname,
      function_row.identity_arguments
    );
  END LOOP;
END;
$migration$;

COMMIT;
