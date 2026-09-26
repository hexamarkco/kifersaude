-- Mantem o texto legado de status igual ao nome atualmente referenciado por
-- status_id. A divergencia fazia filtros por nome ignorarem leads e deixava a
-- tela mostrar um status diferente do relacionamento usado pelas automacoes.
--
-- O trigger de auto-contato reage a mudancas de status. Como esta correção
-- apenas reconcilia texto histórico, ele fica temporariamente desabilitado
-- para não disparar automações nem criar jobs para leads já existentes.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.leads'::regclass
      AND tgname = 'trigger_auto_send_on_lead_change'
  ) THEN
    ALTER TABLE public.leads DISABLE TRIGGER trigger_auto_send_on_lead_change;
  END IF;
END $$;

UPDATE public.leads AS lead
SET status = status_config.nome
FROM public.lead_status_config AS status_config
WHERE lead.status_id = status_config.id
  AND lead.status IS DISTINCT FROM status_config.nome;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.leads'::regclass
      AND tgname = 'trigger_auto_send_on_lead_change'
  ) THEN
    ALTER TABLE public.leads ENABLE TRIGGER trigger_auto_send_on_lead_change;
  END IF;
END $$;
