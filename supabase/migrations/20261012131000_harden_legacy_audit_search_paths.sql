BEGIN;

-- Essas funções são internas. Fixar o search_path evita que objetos com o
-- mesmo nome em outro schema alterem sua resolução, especialmente no helper
-- SECURITY DEFINER audit_exec_sql(text).
ALTER FUNCTION public.audit_normalize_text(text) SET search_path = public;
ALTER FUNCTION public.audit_classify_single_lead(uuid, uuid, uuid) SET search_path = public;
ALTER FUNCTION public.audit_exec_sql(text) SET search_path = public;
ALTER FUNCTION public.audit_run_dry_run(uuid, integer) SET search_path = public;
ALTER FUNCTION public.audit_get_summary(uuid) SET search_path = public;
ALTER FUNCTION public.audit_generate_report() SET search_path = public;
ALTER FUNCTION public.audit_get_func_def(text) SET search_path = public;
ALTER FUNCTION public.audit_get_func_source(text) SET search_path = public;
ALTER FUNCTION public.audit_get_source(text) SET search_path = public;
ALTER FUNCTION public.audit_apply_reativacao() SET search_path = public;

COMMIT;
