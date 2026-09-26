BEGIN;

-- Registros de despacho contêm estado interno de execução das campanhas e
-- são consumidos apenas pelo worker através do service_role. Não há acesso
-- direto do frontend a esta tabela; com RLS habilitado e sem políticas para
-- anon/authenticated, uma exposição acidental não libera esses registros.
ALTER TABLE public.comm_whatsapp_campaign_step_dispatches
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.comm_whatsapp_campaign_step_dispatches FROM anon, authenticated;

COMMIT;
