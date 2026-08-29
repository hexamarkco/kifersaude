/*
  # Validacao de numeros no WhatsApp antes do envio (disparo)

  CSVs grandes de prospeccao fria trazem numeros que podem nao ter WhatsApp
  (empresa fechou, numero mudou de dono, etc). Sem validar, a campanha
  desperdica envios e arrisca parecer spam. Adiciona uma etapa opcional:
  antes de qualquer mensagem, cada alvo tem seu telefone checado contra o
  WhatsApp (mesma checagem ja usada em supabase/functions/comm-whatsapp-contacts
  para validar contatos individuais); numeros sem WhatsApp sao marcados como
  'invalid' e nunca entram na fila de envio.

  - `comm_whatsapp_campaigns.validate_whatsapp_numbers`: liga a validacao
    para os alvos de CSV desta campanha. Default false (nao muda campanhas
    existentes nem exige token/latencia extra de quem nao quer).
  - `comm_whatsapp_campaign_targets.whatsapp_check_status`: 'skipped' (nao
    precisa validar - default, cobre todo alvo existente e todo alvo de CRM),
    'pending' (aguardando checagem), 'valid' ou 'invalid'.
  - O worker so admite um alvo para envio (`claim_comm_whatsapp_campaign_targets`)
    quando o check esta 'skipped' ou 'valid' - um alvo 'pending' fica de fora
    da fila ate ser validado, sem precisar de nenhum status novo em `status`
    nem mudar como os contadores da campanha (`total_targets` etc.) sao
    calculados: para efeito de contagem ele continua "pending" normalmente.
*/

BEGIN;

ALTER TABLE public.comm_whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS validate_whatsapp_numbers boolean NOT NULL DEFAULT false;

ALTER TABLE public.comm_whatsapp_campaign_targets
  ADD COLUMN IF NOT EXISTS whatsapp_check_status text NOT NULL DEFAULT 'skipped',
  ADD COLUMN IF NOT EXISTS whatsapp_checked_at timestamptz;

ALTER TABLE public.comm_whatsapp_campaign_targets
  ADD CONSTRAINT comm_whatsapp_campaign_targets_whatsapp_check_status_check
  CHECK (whatsapp_check_status IN ('skipped', 'pending', 'valid', 'invalid'));

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_campaign_targets_pending_whatsapp_check
  ON public.comm_whatsapp_campaign_targets (created_at)
  WHERE whatsapp_check_status = 'pending';

CREATE OR REPLACE FUNCTION public.claim_comm_whatsapp_campaign_targets(
  p_campaign_id uuid,
  p_limit integer DEFAULT 25,
  p_lock_token text DEFAULT gen_random_uuid()::text,
  p_lock_ttl interval DEFAULT interval '15 minutes'
)
RETURNS SETOF public.comm_whatsapp_campaign_targets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due_targets AS (
    SELECT target.id
    FROM public.comm_whatsapp_campaign_targets AS target
    WHERE target.campaign_id = p_campaign_id
      AND (
        target.status IN ('pending', 'scheduled')
        OR (target.status = 'sending' AND target.locked_at < now() - p_lock_ttl)
      )
      AND target.whatsapp_check_status IN ('skipped', 'valid')
      AND COALESCE(target.next_retry_at, target.next_send_at, '-infinity'::timestamptz) <= now()
      AND (target.locked_at IS NULL OR target.locked_at < now() - p_lock_ttl)
      AND NOT EXISTS (
        SELECT 1
        FROM public.comm_whatsapp_campaign_events AS pending_event
        WHERE pending_event.target_id = target.id
          AND pending_event.event_type IN (
            'target_provider_send_started',
            'target_provider_accepted_persistence_pending'
          )
          AND NOT (pending_event.payload ? 'recovered_at')
          AND NOT (pending_event.payload ? 'resolved_at')
      )
    ORDER BY COALESCE(target.next_send_at, target.created_at), target.created_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100)
  )
  UPDATE public.comm_whatsapp_campaign_targets AS target
  SET status = 'sending',
      locked_at = now(),
      lock_token = p_lock_token,
      error_message = NULL,
      updated_at = now()
  FROM due_targets
  WHERE target.id = due_targets.id
  RETURNING target.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_comm_whatsapp_campaign_targets(uuid, integer, text, interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_comm_whatsapp_campaign_targets(uuid, integer, text, interval) TO service_role;

COMMIT;
