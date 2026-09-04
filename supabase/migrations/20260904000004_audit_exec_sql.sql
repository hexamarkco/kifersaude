CREATE OR REPLACE FUNCTION public.audit_exec_sql(p_sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
BEGIN
  EXECUTE p_sql;
END;
$fn$;
