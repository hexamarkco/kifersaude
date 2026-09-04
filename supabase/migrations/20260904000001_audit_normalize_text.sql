CREATE OR REPLACE FUNCTION public.audit_normalize_text(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $body$
  SELECT trim(lower(regexp_replace(COALESCE($1, ''), '[^a-z0-9\s]', '', 'g')))
$body$;
