BEGIN;

ALTER TABLE public.comm_whatsapp_messages
  ADD COLUMN IF NOT EXISTS delivery_status_checked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_messages_delivery_status_recheck
  ON public.comm_whatsapp_messages (delivery_status_checked_at ASC NULLS FIRST, message_at ASC)
  WHERE direction = 'outbound'
    AND external_message_id IS NOT NULL
    AND delivery_status IN ('pending', 'queued', 'sending', 'sent', 'delivered');

CREATE OR REPLACE FUNCTION public.comm_whatsapp_mark_delivery_status_observed()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.direction = 'outbound'
     AND (TG_OP = 'INSERT' OR NEW.delivery_status IS DISTINCT FROM OLD.delivery_status) THEN
    NEW.delivery_status_checked_at := now();
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_mark_delivery_status_observed() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_comm_whatsapp_mark_delivery_status_observed
  ON public.comm_whatsapp_messages;
CREATE TRIGGER trg_comm_whatsapp_mark_delivery_status_observed
  BEFORE INSERT OR UPDATE OF delivery_status ON public.comm_whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.comm_whatsapp_mark_delivery_status_observed();

CREATE OR REPLACE FUNCTION public.comm_whatsapp_status_rank(p_status text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(NULLIF(btrim(COALESCE(p_status, '')), ''))
    WHEN 'pending' THEN 0
    WHEN 'queued' THEN 0
    WHEN 'sending' THEN 0
    WHEN 'sent' THEN 1
    WHEN 'received' THEN 1
    WHEN 'failed' THEN 2
    WHEN 'error' THEN 2
    WHEN 'delivered' THEN 3
    WHEN 'read' THEN 4
    WHEN 'seen' THEN 4
    WHEN 'viewed' THEN 4
    WHEN 'played' THEN 5
    WHEN 'deleted' THEN 6
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_invoke_message_status_reconciliation()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  v_request_id bigint;
  v_supabase_url text;
  v_service_role_key text;
BEGIN
  v_supabase_url := NULLIF(
    trim(both '"' FROM COALESCE(current_setting('app.settings.supabase_url', true), '')),
    ''
  );
  IF v_supabase_url IS NULL THEN
    SELECT NULLIF(trim(both '"' FROM config_value::text), '')
    INTO v_supabase_url
    FROM public.system_configurations
    WHERE config_key = 'supabase_url'
    LIMIT 1;
  END IF;
  IF v_supabase_url IS NULL THEN
    v_supabase_url := NULLIF(current_setting('supabase.url', true), '');
  END IF;

  v_service_role_key := NULLIF(
    trim(both '"' FROM COALESCE(current_setting('app.settings.supabase_service_role_key', true), '')),
    ''
  );
  IF v_service_role_key IS NULL THEN
    SELECT NULLIF(trim(both '"' FROM config_value::text), '')
    INTO v_service_role_key
    FROM public.system_configurations
    WHERE config_key = 'supabase_service_role_key'
    LIMIT 1;
  END IF;

  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RAISE WARNING 'Configuração do reconciliador de status WhatsApp não encontrada.';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := rtrim(v_supabase_url, '/') || '/functions/v1/comm-whatsapp-refresh-message-status',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key
    ),
    body := jsonb_build_object('source', 'cron', 'limit', 12),
    timeout_milliseconds := 120000
  )
  INTO v_request_id;

  RETURN v_request_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Falha ao invocar reconciliador de status WhatsApp: %', SQLERRM;
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_invoke_message_status_reconciliation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_invoke_message_status_reconciliation() TO service_role;

DO $scheduler$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'pg_cron indisponível; reconciliador de status WhatsApp não agendado.';
  END;

  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_net;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'pg_net indisponível; reconciliador de status WhatsApp não agendado.';
  END;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    IF EXISTS (
      SELECT 1
      FROM cron.job
      WHERE jobname = 'reconcile-comm-whatsapp-message-statuses'
    ) THEN
      PERFORM cron.unschedule('reconcile-comm-whatsapp-message-statuses');
    END IF;

    PERFORM cron.schedule(
      'reconcile-comm-whatsapp-message-statuses',
      '*/2 * * * *',
      'SELECT public.comm_whatsapp_invoke_message_status_reconciliation();'
    );
  END IF;
END
$scheduler$;

COMMIT;
