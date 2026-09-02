BEGIN;

-- Tabela de memória comercial persistente para follow-ups V3.
-- Armazena o estado interpretado da negociação por chat/lead,
-- permitindo que a análise anterior sirva de contexto para próximas gerações.

CREATE TABLE IF NOT EXISTS public.comm_whatsapp_commercial_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.comm_whatsapp_chats(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,

  -- Estágio e temperatura
  stage text NOT NULL DEFAULT 'outro',
  lead_temperature text NOT NULL DEFAULT 'nao_identificado',

  -- Participantes
  contact_role text NOT NULL DEFAULT 'nao_identificado',
  decision_maker text,
  stakeholders jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Bloqueio e sinais
  blocker text NOT NULL DEFAULT 'nao_identificado',
  buying_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  objections jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Fatos e contexto
  known_facts jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_commercial_event text,
  last_customer_position text,

  -- Compromisso pendente
  last_commitment jsonb,

  -- Microdecisões
  previous_microdecision text,
  pending_microdecision text,

  -- Próxima ação
  next_action_owner text NOT NULL DEFAULT 'nao_identificado',
  main_commercial_question text,

  -- Estado da estratégia anterior
  last_commercial_function text,
  last_strategy_summary text,

  -- Score de confiança da análise
  analysis_confidence numeric(3,2) DEFAULT 0.5,

  -- Rastreabilidade: qual mensagem fonte gerou este estado
  source_last_message_id uuid,
  source_last_message_at timestamptz,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_commercial_state_chat_id
  ON public.comm_whatsapp_commercial_state(chat_id);
CREATE INDEX IF NOT EXISTS idx_commercial_state_lead_id
  ON public.comm_whatsapp_commercial_state(lead_id)
  WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commercial_state_chat_updated
  ON public.comm_whatsapp_commercial_state(chat_id, updated_at DESC);

-- Unique: um estado por chat (último estado vigente)
CREATE UNIQUE INDEX IF NOT EXISTS idx_commercial_state_chat_unique
  ON public.comm_whatsapp_commercial_state(chat_id);

-- RLS: usuários autenticados podem ler/gravar
ALTER TABLE public.comm_whatsapp_commercial_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios autenticados podem gerenciar commercial state"
  ON public.comm_whatsapp_commercial_state;
CREATE POLICY "Usuarios autenticados podem gerenciar commercial state"
  ON public.comm_whatsapp_commercial_state
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Função RPC para upsert do estado comercial
CREATE OR REPLACE FUNCTION public.upsert_commercial_state(
  p_chat_id uuid,
  p_lead_id uuid,
  p_stage text,
  p_lead_temperature text,
  p_contact_role text,
  p_decision_maker text,
  p_stakeholders jsonb,
  p_blocker text,
  p_buying_signals jsonb,
  p_objections jsonb,
  p_known_facts jsonb,
  p_last_commercial_event text,
  p_last_customer_position text,
  p_last_commitment jsonb,
  p_previous_microdecision text,
  p_pending_microdecision text,
  p_next_action_owner text,
  p_main_commercial_question text,
  p_last_commercial_function text,
  p_last_strategy_summary text,
  p_analysis_confidence numeric,
  p_source_last_message_id uuid,
  p_source_last_message_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.comm_whatsapp_commercial_state (
    chat_id, lead_id, stage, lead_temperature, contact_role, decision_maker,
    stakeholders, blocker, buying_signals, objections, known_facts,
    last_commercial_event, last_customer_position, last_commitment,
    previous_microdecision, pending_microdecision, next_action_owner,
    main_commercial_question, last_commercial_function, last_strategy_summary,
    analysis_confidence, source_last_message_id, source_last_message_at
  ) VALUES (
    p_chat_id, p_lead_id, p_stage, p_lead_temperature, p_contact_role, p_decision_maker,
    p_stakeholders, p_blocker, p_buying_signals, p_objections, p_known_facts,
    p_last_commercial_event, p_last_customer_position, p_last_commitment,
    p_previous_microdecision, p_pending_microdecision, p_next_action_owner,
    p_main_commercial_question, p_last_commercial_function, p_last_strategy_summary,
    p_analysis_confidence, p_source_last_message_id, p_source_last_message_at
  )
  ON CONFLICT (chat_id) DO UPDATE SET
    lead_id = COALESCE(EXCLUDED.lead_id, comm_whatsapp_commercial_state.lead_id),
    stage = EXCLUDED.stage,
    lead_temperature = EXCLUDED.lead_temperature,
    contact_role = EXCLUDED.contact_role,
    decision_maker = EXCLUDED.decision_maker,
    stakeholders = EXCLUDED.stakeholders,
    blocker = EXCLUDED.blocker,
    buying_signals = EXCLUDED.buying_signals,
    objections = EXCLUDED.objections,
    known_facts = EXCLUDED.known_facts,
    last_commercial_event = EXCLUDED.last_commercial_event,
    last_customer_position = EXCLUDED.last_customer_position,
    last_commitment = EXCLUDED.last_commitment,
    previous_microdecision = EXCLUDED.previous_microdecision,
    pending_microdecision = EXCLUDED.pending_microdecision,
    next_action_owner = EXCLUDED.next_action_owner,
    main_commercial_question = EXCLUDED.main_commercial_question,
    last_commercial_function = EXCLUDED.last_commercial_function,
    last_strategy_summary = EXCLUDED.last_strategy_summary,
    analysis_confidence = EXCLUDED.analysis_confidence,
    source_last_message_id = EXCLUDED.source_last_message_id,
    source_last_message_at = EXCLUDED.source_last_message_at,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_commercial_state(
  uuid, uuid, text, text, text, text, jsonb, text, jsonb, jsonb, jsonb,
  text, text, jsonb, text, text, text, text, text, text, numeric, uuid, timestamptz
) TO authenticated;

-- Função RPC para carregar o estado comercial de um chat
CREATE OR REPLACE FUNCTION public.get_commercial_state(p_chat_id uuid)
RETURNS SETOF public.comm_whatsapp_commercial_state
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT * FROM public.comm_whatsapp_commercial_state WHERE chat_id = p_chat_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_commercial_state(uuid) TO authenticated;

COMMIT;
