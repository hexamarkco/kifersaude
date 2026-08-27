/*
  # Disparos WhatsApp: etapas agrupadas e acao de mudar status

  - Etapas de campanha ganham `stage_index` para agrupar varias mensagens sob
    o mesmo intervalo de espera (ex: 3 mensagens imediatas, depois 2 mensagens
    24h depois), no mesmo espirito do "pacote de mensagens" por etapa do
    construtor de fluxo de automacao (AutoContactFlowStep.messages).
  - Uma etapa pode agora ser do tipo 'status_change' em vez de 'message':
    ao inves de enviar uma mensagem, ela atualiza o status do lead no CRM
    antes de seguir para a proxima etapa da sequencia.
*/

BEGIN;

ALTER TABLE public.comm_whatsapp_campaign_steps
  ADD COLUMN IF NOT EXISTS stage_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS step_kind text NOT NULL DEFAULT 'message',
  ADD COLUMN IF NOT EXISTS status_to_set text;

ALTER TABLE public.comm_whatsapp_campaign_steps
  ADD CONSTRAINT comm_whatsapp_campaign_steps_stage_index_check
  CHECK (stage_index >= 0);

ALTER TABLE public.comm_whatsapp_campaign_steps
  ADD CONSTRAINT comm_whatsapp_campaign_steps_step_kind_check
  CHECK (step_kind IN ('message', 'status_change'));

ALTER TABLE public.comm_whatsapp_campaign_steps
  ADD CONSTRAINT comm_whatsapp_campaign_steps_status_to_set_check
  CHECK (step_kind <> 'status_change' OR length(btrim(COALESCE(status_to_set, ''))) > 0);

-- Uma etapa de mudanca de status nao precisa de texto nem de midia.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'comm_whatsapp_campaign_steps_message_or_media_check'
      AND conrelid = 'public.comm_whatsapp_campaign_steps'::regclass
  ) THEN
    ALTER TABLE public.comm_whatsapp_campaign_steps
      DROP CONSTRAINT comm_whatsapp_campaign_steps_message_or_media_check;
  END IF;
END $$;

ALTER TABLE public.comm_whatsapp_campaign_steps
  ADD CONSTRAINT comm_whatsapp_campaign_steps_message_or_media_check
  CHECK (
    step_kind = 'status_change'
    OR length(btrim(message_text)) > 0
    OR media_url IS NOT NULL
  );

-- Backfill: cada etapa existente vira seu proprio estagio (comportamento
-- identico ao que ja tinham, um envio por estagio).
UPDATE public.comm_whatsapp_campaign_steps
SET stage_index = step_index
WHERE stage_index = 0 AND step_index <> 0;

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_campaign_steps_campaign_stage
  ON public.comm_whatsapp_campaign_steps (campaign_id, stage_index, step_index);

COMMIT;
