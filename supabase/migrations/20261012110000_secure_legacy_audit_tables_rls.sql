BEGIN;

-- Estas tabelas guardam resultados internos de auditorias antigas. O frontend
-- atual não as consulta; os scripts de manutenção usam o service_role.
ALTER TABLE public.audit_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_run_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_results ENABLE ROW LEVEL SECURITY;

-- Sem políticas para anon/authenticated, nenhuma sessão do produto acessa
-- dados de leads e telefones armazenados nos relatórios de auditoria.
REVOKE ALL ON TABLE public.audit_runs, public.audit_run_targets, public.audit_results
  FROM anon, authenticated;

COMMIT;
