/*
  # Monitoramento de SLA e priorização de agendamentos do WhatsApp

  - Cria tabelas para armazenar métricas de SLA por conversa e registrar alertas.
  - Adiciona visão auxiliar para calcular o estado atual do SLA diretamente a partir de whatsapp_messages.
  - Habilita um resumo agregado de whatsapp_scheduled_messages por período, status e prioridade.
  - Introduz prioridade configurável nos agendamentos para permitir reordenação manual.
*/

-- Garante função utilitária para atualizar colunas updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tabela com métricas consolidadas por chat
CREATE TABLE IF NOT EXISTS public.whatsapp_chat_sla_metrics (
  chat_id uuid PRIMARY KEY REFERENCES public.whatsapp_chats(id) ON DELETE CASCADE,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  last_message_at timestamptz,
  last_response_ms bigint,
  pending_inbound_count integer NOT NULL DEFAULT 0,
  waiting_since timestamptz,
  waiting_minutes integer,
  sla_status text NOT NULL DEFAULT 'healthy' CHECK (sla_status IN ('healthy', 'warning', 'critical')),
  sla_breach_started_at timestamptz,
  longest_waiting_response_ms bigint,
  last_alert_status text,
  last_alert_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_chat_sla_metrics_last_message_idx
  ON public.whatsapp_chat_sla_metrics (last_message_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS whatsapp_chat_sla_metrics_status_idx
  ON public.whatsapp_chat_sla_metrics (sla_status, waiting_since);

DROP TRIGGER IF EXISTS trg_whatsapp_chat_sla_metrics_updated_at ON public.whatsapp_chat_sla_metrics;
CREATE TRIGGER trg_whatsapp_chat_sla_metrics_updated_at
  BEFORE UPDATE ON public.whatsapp_chat_sla_metrics
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.whatsapp_chat_sla_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read WhatsApp SLA metrics" ON public.whatsapp_chat_sla_metrics;
CREATE POLICY "Authenticated users can read WhatsApp SLA metrics"
  ON public.whatsapp_chat_sla_metrics
  FOR SELECT
  TO authenticated
  USING (true);

-- Registro de alertas gerados pelo monitoramento
CREATE TABLE IF NOT EXISTS public.whatsapp_chat_sla_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.whatsapp_chats(id) ON DELETE CASCADE,
  sla_status text NOT NULL CHECK (sla_status IN ('healthy', 'warning', 'critical')),
  pending_inbound_count integer NOT NULL DEFAULT 0,
  waiting_since timestamptz,
  waiting_minutes integer,
  alert_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_chat_sla_alerts_chat_idx
  ON public.whatsapp_chat_sla_alerts (chat_id, created_at DESC);

ALTER TABLE public.whatsapp_chat_sla_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read WhatsApp SLA alerts" ON public.whatsapp_chat_sla_alerts;
CREATE POLICY "Authenticated users can read WhatsApp SLA alerts"
  ON public.whatsapp_chat_sla_alerts
  FOR SELECT
  TO authenticated
  USING (true);

-- Visão com cálculo automático das métricas de SLA
CREATE OR REPLACE VIEW public.whatsapp_chat_sla_snapshot AS
WITH last_events AS (
  SELECT
    chat_id,
    MAX(moment) FILTER (WHERE from_me = false) AS last_inbound_at,
    MAX(moment) FILTER (WHERE from_me = true) AS last_outbound_at,
    MAX(moment) AS last_message_at
  FROM public.whatsapp_messages
  GROUP BY chat_id
),
pending_messages AS (
  SELECT
    le.chat_id,
    COUNT(*) AS pending_inbound_count,
    MIN(m.moment) AS oldest_pending_inbound_at
  FROM last_events le
  JOIN public.whatsapp_messages m
    ON m.chat_id = le.chat_id
   AND m.from_me = false
   AND (le.last_outbound_at IS NULL OR m.moment > le.last_outbound_at)
  GROUP BY le.chat_id
)
SELECT
  le.chat_id,
  le.last_inbound_at,
  le.last_outbound_at,
  le.last_message_at,
  CASE
    WHEN le.last_inbound_at IS NOT NULL AND le.last_outbound_at IS NOT NULL
      AND le.last_outbound_at >= le.last_inbound_at
    THEN EXTRACT(EPOCH FROM (le.last_outbound_at - le.last_inbound_at)) * 1000
    ELSE NULL
  END AS last_response_ms,
  COALESCE(pm.pending_inbound_count, 0) AS pending_inbound_count,
  pm.oldest_pending_inbound_at AS waiting_since,
  CASE
    WHEN pm.oldest_pending_inbound_at IS NOT NULL THEN
      FLOOR(EXTRACT(EPOCH FROM (now() - pm.oldest_pending_inbound_at)) / 60)
    ELSE NULL
  END AS waiting_minutes
FROM last_events le
LEFT JOIN pending_messages pm ON pm.chat_id = le.chat_id;

-- Novos campos de prioridade para agendamentos
ALTER TABLE public.whatsapp_scheduled_messages
  ADD COLUMN IF NOT EXISTS priority_level text NOT NULL DEFAULT 'normal'
    CHECK (priority_level IN ('low', 'normal', 'high', 'urgent')),
  ADD COLUMN IF NOT EXISTS priority_order integer NOT NULL DEFAULT 0;

-- Normaliza ordens existentes
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY scheduled_send_at, created_at) - 1 AS rn
  FROM public.whatsapp_scheduled_messages
)
UPDATE public.whatsapp_scheduled_messages AS t
SET priority_order = ordered.rn
FROM ordered
WHERE ordered.id = t.id;

CREATE INDEX IF NOT EXISTS whatsapp_scheduled_messages_priority_idx
  ON public.whatsapp_scheduled_messages (priority_level, priority_order, scheduled_send_at);

-- Visão agregada por período, status e prioridade
CREATE OR REPLACE VIEW public.whatsapp_scheduled_messages_period_summary AS
SELECT
  date_trunc('hour', scheduled_send_at) AS period_start,
  date_trunc('hour', scheduled_send_at) + interval '1 hour' AS period_end,
  priority_level,
  status,
  COUNT(*) AS message_count,
  MIN(scheduled_send_at) AS next_scheduled_at
FROM public.whatsapp_scheduled_messages
GROUP BY 1, 2, 3, 4
ORDER BY period_start ASC, priority_level ASC, status ASC;
