BEGIN;

-- The MCP idempotency key is scoped to the target conversation. A batch can
-- safely use distinct request IDs for each item, and an accidental reuse on a
-- different conversation no longer returns another contact's schedule.
DROP INDEX IF EXISTS public.idx_scheduled_messages_mcp_client_request;
CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_messages_mcp_client_request
  ON public.comm_whatsapp_scheduled_messages (channel_id, chat_id, mcp_client_request_id)
  WHERE mcp_client_request_id IS NOT NULL
    AND chat_id IS NOT NULL;

-- Keep an immutable operational history for all lifecycle changes. The
-- scheduled-message id is intentionally not a foreign key: the legacy Inbox
-- still supports deleting old schedules, while this audit history must remain.
CREATE TABLE IF NOT EXISTS public.comm_whatsapp_scheduled_message_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_message_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN (
    'created', 'message_updated', 'rescheduled', 'updated', 'processing',
    'sent', 'failed', 'cancelled', 'expired'
  )),
  source text NOT NULL DEFAULT 'crm',
  actor_id uuid NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  lead_id uuid NULL REFERENCES public.leads(id) ON DELETE SET NULL,
  chat_id uuid NULL REFERENCES public.comm_whatsapp_chats(id) ON DELETE SET NULL,
  previous_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comm_whatsapp_scheduled_message_audit_previous_object
    CHECK (jsonb_typeof(previous_values) = 'object'),
  CONSTRAINT comm_whatsapp_scheduled_message_audit_current_object
    CHECK (jsonb_typeof(current_values) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_scheduled_message_audit_message_created_at
  ON public.comm_whatsapp_scheduled_message_audit_log (scheduled_message_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_message_audit_lead_created_at
  ON public.comm_whatsapp_scheduled_message_audit_log (lead_id, created_at DESC)
  WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_message_audit_chat_created_at
  ON public.comm_whatsapp_scheduled_message_audit_log (chat_id, created_at DESC)
  WHERE chat_id IS NOT NULL;

ALTER TABLE public.comm_whatsapp_scheduled_message_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.comm_whatsapp_scheduled_message_audit_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.comm_whatsapp_scheduled_message_audit_log TO service_role;

CREATE OR REPLACE FUNCTION public.audit_comm_whatsapp_scheduled_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_source text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_source := COALESCE(NEW.metadata ->> 'source', 'crm');
    INSERT INTO public.comm_whatsapp_scheduled_message_audit_log (
      scheduled_message_id, action, source, actor_id, lead_id, chat_id,
      previous_values, current_values
    ) VALUES (
      NEW.id, v_action, v_source, NEW.created_by, NEW.lead_id, NEW.chat_id,
      '{}'::jsonb,
      jsonb_strip_nulls(jsonb_build_object(
        'message', NEW.text_content,
        'scheduled_at', NEW.scheduled_at,
        'status', NEW.status,
        'client_request_id', NEW.mcp_client_request_id
      ))
    );
    RETURN NEW;
  END IF;

  v_source := COALESCE(NEW.metadata ->> 'source', OLD.metadata ->> 'source', 'crm');
  v_action := CASE
    WHEN NEW.status IS DISTINCT FROM OLD.status THEN CASE NEW.status
      WHEN 'sending' THEN 'processing'
      WHEN 'sent' THEN 'sent'
      WHEN 'failed' THEN 'failed'
      WHEN 'cancelled' THEN 'cancelled'
      WHEN 'expired' THEN 'expired'
      ELSE 'updated'
    END
    WHEN NEW.text_content IS DISTINCT FROM OLD.text_content
      AND NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN 'updated'
    WHEN NEW.text_content IS DISTINCT FROM OLD.text_content THEN 'message_updated'
    WHEN NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN 'rescheduled'
    ELSE 'updated'
  END;

  INSERT INTO public.comm_whatsapp_scheduled_message_audit_log (
    scheduled_message_id, action, source, actor_id, lead_id, chat_id,
    previous_values, current_values
  ) VALUES (
    NEW.id, v_action, v_source, NEW.created_by, NEW.lead_id, NEW.chat_id,
    jsonb_strip_nulls(jsonb_build_object(
      'message', OLD.text_content,
      'scheduled_at', OLD.scheduled_at,
      'status', OLD.status,
      'cancelled_at', OLD.cancelled_at,
      'last_error', OLD.error_message
    )),
    jsonb_strip_nulls(jsonb_build_object(
      'message', NEW.text_content,
      'scheduled_at', NEW.scheduled_at,
      'status', NEW.status,
      'cancelled_at', NEW.cancelled_at,
      'last_error', NEW.error_message,
      'sent_at', NEW.sent_at
    ))
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_comm_whatsapp_scheduled_message() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_comm_whatsapp_scheduled_message
  ON public.comm_whatsapp_scheduled_messages;
CREATE TRIGGER trg_audit_comm_whatsapp_scheduled_message
  AFTER INSERT OR UPDATE ON public.comm_whatsapp_scheduled_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_comm_whatsapp_scheduled_message();

COMMIT;
