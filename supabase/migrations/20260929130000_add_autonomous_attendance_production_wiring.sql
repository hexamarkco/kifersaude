/*
  # Atendimento autonomo no inbox real (acionado pela automacao de Abordagem)

  Ate agora o atendimento autonomo da IA (playbook autonomous_attendance)
  so existia isolado em /chat (sandbox). Esta migracao liga a IA ao inbox
  real do WhatsApp, mas SEMPRE de forma explicita, por chat, nunca global:

  - comm_whatsapp_chats ganha autonomous_attendance_status
    ('inactive' | 'active' | 'handed_off'), default 'inactive'. Todo chat
    existente (leads ja atendidos, clientes tirando duvida, conversas
    pessoais) continua 100% manual — nada muda de comportamento pra eles.
  - So fica 'active' quando uma etapa "Ativar atendimento autonomo" de um
    fluxo de Abordagem roda pra aquele lead (nova acao de fluxo, ver
    leads-api). So esse chat especifico passa a ter a IA respondendo.
  - Enquanto 'active', cada mensagem inbound nesse chat agenda (com
    debounce) uma resposta da IA via ai_autonomous_reply_jobs — mesmo
    padrao de fila+cron ja usado por auto_contact_flow_jobs. Mensagem
    nova do lead empurra o agendamento pra frente, pra IA responder so
    depois que ele para de digitar.
  - Quando a IA sinaliza handoff (fim da qualificacao, recusa de
    cotacao, fora de escopo ou precisa de humano), o worker marca o chat
    como 'handed_off' — a IA para de responder ali, e o restante do
    atendimento (cotacao, etc.) volta a ser 100% manual, como sempre foi.
*/

BEGIN;

ALTER TABLE public.comm_whatsapp_chats
  ADD COLUMN IF NOT EXISTS autonomous_attendance_status text NOT NULL DEFAULT 'inactive'
    CHECK (autonomous_attendance_status IN ('inactive', 'active', 'handed_off'));

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_chats_autonomous_attendance_status
  ON public.comm_whatsapp_chats (autonomous_attendance_status)
  WHERE autonomous_attendance_status <> 'inactive';

CREATE TABLE IF NOT EXISTS public.ai_autonomous_reply_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.comm_whatsapp_chats(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'cancelled', 'failed')),
  scheduled_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_autonomous_reply_jobs_due
  ON public.ai_autonomous_reply_jobs (status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_ai_autonomous_reply_jobs_chat
  ON public.ai_autonomous_reply_jobs (chat_id);

-- So pode existir um job 'pending' por chat: novas mensagens inbound
-- reagendam (empurram scheduled_at) esse mesmo job em vez de empilhar.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_autonomous_reply_jobs_pending_chat
  ON public.ai_autonomous_reply_jobs (chat_id)
  WHERE status = 'pending';

ALTER TABLE public.ai_autonomous_reply_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage ai autonomous reply jobs" ON public.ai_autonomous_reply_jobs;
CREATE POLICY "Service role can manage ai autonomous reply jobs"
  ON public.ai_autonomous_reply_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view ai autonomous reply jobs" ON public.ai_autonomous_reply_jobs;
CREATE POLICY "Authenticated users can view ai autonomous reply jobs"
  ON public.ai_autonomous_reply_jobs
  FOR SELECT
  TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS trg_ai_autonomous_reply_jobs_updated_at ON public.ai_autonomous_reply_jobs;
CREATE TRIGGER trg_ai_autonomous_reply_jobs_updated_at
  BEFORE UPDATE ON public.ai_autonomous_reply_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Chamada pelo webhook a cada mensagem inbound: so agenda/reagenda se o
-- chat estiver com atendimento autonomo ativo (senao e um no-op — todo
-- outro chat do numero continua sem nenhum efeito).
CREATE OR REPLACE FUNCTION public.schedule_ai_autonomous_reply_job(
  p_chat_id uuid,
  p_delay_seconds integer DEFAULT 60
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_status text;
  v_lead_id uuid;
BEGIN
  SELECT autonomous_attendance_status, lead_id
    INTO v_status, v_lead_id
    FROM public.comm_whatsapp_chats
    WHERE id = p_chat_id;

  IF v_status IS DISTINCT FROM 'active' OR v_lead_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.ai_autonomous_reply_jobs (chat_id, lead_id, scheduled_at)
  VALUES (p_chat_id, v_lead_id, now() + make_interval(secs => GREATEST(p_delay_seconds, 1)))
  ON CONFLICT (chat_id) WHERE status = 'pending'
  DO UPDATE SET scheduled_at = EXCLUDED.scheduled_at, updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.schedule_ai_autonomous_reply_job(uuid, integer) TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  END IF;
END $$;

DO $$
DECLARE
  function_url text;
  service_role_key text;
  has_label boolean := false;
  has_value boolean := false;
  has_config_key boolean := false;
  has_config_value boolean := false;
BEGIN
  BEGIN
    function_url := NULLIF(trim(both '"' FROM COALESCE(current_setting('app.settings.supabase_url', true), '')), '');
  EXCEPTION WHEN OTHERS THEN
    function_url := NULL;
  END;

  BEGIN
    service_role_key := NULLIF(trim(both '"' FROM COALESCE(current_setting('app.settings.supabase_service_role_key', true), '')), '');
  EXCEPTION WHEN OTHERS THEN
    service_role_key := NULL;
  END;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_configurations' AND column_name = 'label'
  ) INTO has_label;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_configurations' AND column_name = 'value'
  ) INTO has_value;

  IF function_url IS NULL AND has_label AND has_value THEN
    EXECUTE $sql$
      SELECT NULLIF(trim(both '"' FROM value), '')
      FROM system_configurations
      WHERE label = 'supabase_url'
      LIMIT 1
    $sql$ INTO function_url;
  END IF;

  IF service_role_key IS NULL AND has_label AND has_value THEN
    EXECUTE $sql$
      SELECT NULLIF(trim(both '"' FROM value), '')
      FROM system_configurations
      WHERE label = 'supabase_service_role_key'
      LIMIT 1
    $sql$ INTO service_role_key;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_configurations' AND column_name = 'config_key'
  ) INTO has_config_key;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_configurations' AND column_name = 'config_value'
  ) INTO has_config_value;

  IF function_url IS NULL AND has_config_key AND has_config_value THEN
    EXECUTE $sql$
      SELECT NULLIF(trim(both '"' FROM config_value::text), '')
      FROM system_configurations
      WHERE config_key = 'supabase_url'
      LIMIT 1
    $sql$ INTO function_url;
  END IF;

  IF service_role_key IS NULL AND has_config_key AND has_config_value THEN
    EXECUTE $sql$
      SELECT NULLIF(trim(both '"' FROM config_value::text), '')
      FROM system_configurations
      WHERE config_key = 'supabase_service_role_key'
      LIMIT 1
    $sql$ INTO service_role_key;
  END IF;

  IF function_url IS NOT NULL THEN
    function_url := rtrim(function_url, '/') || '/functions/v1/ai-autonomous-reply-worker';
  END IF;

  IF function_url IS NULL OR service_role_key IS NULL THEN
    RAISE NOTICE 'ai-autonomous-reply-worker cron not configured (missing settings).';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-ai-autonomous-reply-jobs') THEN
    PERFORM cron.unschedule('process-ai-autonomous-reply-jobs');
  END IF;

  PERFORM cron.schedule(
    'process-ai-autonomous-reply-jobs',
    '* * * * *',
    format(
      'SELECT net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', %L), body := jsonb_build_object(''source'', ''cron''), timeout_milliseconds := 30000);',
      function_url,
      'Bearer ' || service_role_key
    )
  );
END $$;

COMMIT;
