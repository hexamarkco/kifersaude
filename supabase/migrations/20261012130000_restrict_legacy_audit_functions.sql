BEGIN;

-- As rotinas audit_* abaixo pertencem a scripts internos legados e não são
-- chamadas pelo frontend nem pelas Edge Functions atuais. Remover o EXECUTE
-- público é especialmente importante para audit_exec_sql(text), que executa
-- SQL recebido como parâmetro com privilégios do definidor.
REVOKE EXECUTE ON FUNCTION
  public.audit_normalize_text(text),
  public.audit_classify_single_lead(uuid, uuid, uuid),
  public.audit_exec_sql(text),
  public.audit_run_dry_run(uuid, integer),
  public.audit_get_summary(uuid),
  public.audit_generate_report(),
  public.audit_get_func_def(text),
  public.audit_get_func_source(text),
  public.audit_get_source(text),
  public.audit_apply_reativacao()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.audit_normalize_text(text),
  public.audit_classify_single_lead(uuid, uuid, uuid),
  public.audit_exec_sql(text),
  public.audit_run_dry_run(uuid, integer),
  public.audit_get_summary(uuid),
  public.audit_generate_report(),
  public.audit_get_func_def(text),
  public.audit_get_func_source(text),
  public.audit_get_source(text),
  public.audit_apply_reativacao()
TO service_role;

COMMIT;
