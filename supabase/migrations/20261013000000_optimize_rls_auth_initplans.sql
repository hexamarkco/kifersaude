BEGIN;

-- Avaliar auth.uid()/auth.jwt() como subconsulta permite ao PostgreSQL
-- calcular a identidade uma vez por consulta, em vez de repetir o trabalho
-- para cada linha avaliada pela politica. A expressao e a mesma e as regras
-- de acesso permanecem inalteradas.
DO $migration$
DECLARE
  policy_record record;
  next_using text;
  next_check text;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        coalesce(qual, '') LIKE '%auth.uid()%'
        OR coalesce(qual, '') LIKE '%auth.jwt()%'
        OR coalesce(with_check, '') LIKE '%auth.uid()%'
        OR coalesce(with_check, '') LIKE '%auth.jwt()%'
      )
  LOOP
    next_using := replace(
      replace(policy_record.qual, 'auth.uid()', '(select auth.uid())'),
      'auth.jwt()', '(select auth.jwt())'
    );
    IF policy_record.qual IS NOT NULL AND next_using IS DISTINCT FROM policy_record.qual THEN
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I USING (%s)',
        policy_record.policyname,
        policy_record.schemaname,
        policy_record.tablename,
        next_using
      );
    END IF;

    next_check := replace(
      replace(policy_record.with_check, 'auth.uid()', '(select auth.uid())'),
      'auth.jwt()', '(select auth.jwt())'
    );
    IF policy_record.with_check IS NOT NULL AND next_check IS DISTINCT FROM policy_record.with_check THEN
      EXECUTE format(
        'ALTER POLICY %I ON %I.%I WITH CHECK (%s)',
        policy_record.policyname,
        policy_record.schemaname,
        policy_record.tablename,
        next_check
      );
    END IF;
  END LOOP;
END;
$migration$;

NOTIFY pgrst, 'reload schema';

COMMIT;
