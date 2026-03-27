/*
  # Add clean WhatsApp inbox MVP

  Creates a fresh WhatsApp inbox foundation focused on:
  - one shared inbox
  - text message ingest/send
  - minimal channel health tracking
  - resource-conscious storage for Supabase nano
*/

BEGIN;

CREATE OR REPLACE FUNCTION public.current_user_can_view_comm_whatsapp()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT (
    public.current_user_is_access_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profile_permissions pp
      WHERE pp.role = public.current_user_access_role()
        AND pp.module = 'whatsapp-inbox'
        AND (pp.can_view = true OR pp.can_edit = true)
    )
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_can_view_comm_whatsapp() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_can_view_comm_whatsapp() TO authenticated;

CREATE OR REPLACE FUNCTION public.current_user_can_edit_comm_whatsapp()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT (
    public.current_user_is_access_admin()
    OR EXISTS (
      SELECT 1
      FROM public.profile_permissions pp
      WHERE pp.role = public.current_user_access_role()
        AND pp.module = 'whatsapp-inbox'
        AND pp.can_edit = true
    )
  );
$$;

REVOKE ALL ON FUNCTION public.current_user_can_edit_comm_whatsapp() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_can_edit_comm_whatsapp() TO authenticated;

CREATE OR REPLACE FUNCTION public.normalize_comm_whatsapp_phone(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN digits = '' THEN ''
    WHEN digits LIKE '55%' AND char_length(digits) IN (12, 13) THEN digits
    WHEN digits NOT LIKE '55%' AND char_length(digits) IN (10, 11) THEN '55' || digits
    ELSE digits
  END
  FROM (
    SELECT regexp_replace(COALESCE(value, ''), '\D', '', 'g') AS digits
  ) normalized;
$$;

REVOKE ALL ON FUNCTION public.normalize_comm_whatsapp_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_comm_whatsapp_phone(text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.comm_whatsapp_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT 'WhatsApp principal',
  enabled boolean NOT NULL DEFAULT false,
  whapi_channel_id text,
  connection_status text NOT NULL DEFAULT 'unknown',
  health_status text NOT NULL DEFAULT 'unknown',
  phone_number text,
  connected_user_name text,
  webhook_secret text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  last_health_check_at timestamptz,
  last_webhook_received_at timestamptz,
  last_error text,
  health_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  limits_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_channels_enabled
  ON public.comm_whatsapp_channels (enabled);

DROP TRIGGER IF EXISTS trg_comm_whatsapp_channels_updated_at ON public.comm_whatsapp_channels;
CREATE TRIGGER trg_comm_whatsapp_channels_updated_at
  BEFORE UPDATE ON public.comm_whatsapp_channels
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.comm_whatsapp_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.comm_whatsapp_channels(id) ON DELETE CASCADE,
  external_chat_id text NOT NULL,
  phone_number text NOT NULL,
  phone_digits text NOT NULL,
  display_name text NOT NULL,
  push_name text,
  last_message_text text,
  last_message_direction text NOT NULL DEFAULT 'system'
    CHECK (last_message_direction IN ('inbound', 'outbound', 'system')),
  last_message_at timestamptz,
  unread_count integer NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'pending', 'closed')),
  last_read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel_id, external_chat_id)
);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_chats_channel_last_message
  ON public.comm_whatsapp_chats (channel_id, last_message_at DESC NULLS LAST, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_chats_phone_digits
  ON public.comm_whatsapp_chats (phone_digits);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_chats_unread
  ON public.comm_whatsapp_chats (unread_count DESC, last_message_at DESC NULLS LAST);

DROP TRIGGER IF EXISTS trg_comm_whatsapp_chats_updated_at ON public.comm_whatsapp_chats;
CREATE TRIGGER trg_comm_whatsapp_chats_updated_at
  BEFORE UPDATE ON public.comm_whatsapp_chats
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.comm_whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.comm_whatsapp_chats(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.comm_whatsapp_channels(id) ON DELETE CASCADE,
  external_message_id text,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound', 'system')),
  message_type text NOT NULL DEFAULT 'text',
  delivery_status text NOT NULL DEFAULT 'received',
  text_content text,
  message_at timestamptz NOT NULL,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  source text,
  sender_name text,
  sender_phone text,
  status_updated_at timestamptz,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_messages_chat_message_at
  ON public.comm_whatsapp_messages (chat_id, message_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_messages_channel_message_at
  ON public.comm_whatsapp_messages (channel_id, message_at DESC, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_comm_whatsapp_messages_external_message_id
  ON public.comm_whatsapp_messages (channel_id, external_message_id)
  WHERE external_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.comm_whatsapp_event_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.comm_whatsapp_channels(id) ON DELETE CASCADE,
  event_key text NOT NULL UNIQUE,
  event_type text NOT NULL,
  resource_id text,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_event_receipts_received_at
  ON public.comm_whatsapp_event_receipts (received_at DESC);

ALTER TABLE public.comm_whatsapp_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comm_whatsapp_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comm_whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comm_whatsapp_event_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view comm whatsapp chats" ON public.comm_whatsapp_chats;
CREATE POLICY "Authenticated users can view comm whatsapp chats"
  ON public.comm_whatsapp_chats
  FOR SELECT
  TO authenticated
  USING (public.current_user_can_view_comm_whatsapp());

DROP POLICY IF EXISTS "Authenticated users can view comm whatsapp messages" ON public.comm_whatsapp_messages;
CREATE POLICY "Authenticated users can view comm whatsapp messages"
  ON public.comm_whatsapp_messages
  FOR SELECT
  TO authenticated
  USING (public.current_user_can_view_comm_whatsapp());

DROP POLICY IF EXISTS "Admins can view comm whatsapp event receipts" ON public.comm_whatsapp_event_receipts;
CREATE POLICY "Admins can view comm whatsapp event receipts"
  ON public.comm_whatsapp_event_receipts
  FOR SELECT
  TO authenticated
  USING (public.current_user_is_access_admin());

CREATE OR REPLACE FUNCTION public.comm_whatsapp_get_channel_state()
RETURNS TABLE(
  id uuid,
  slug text,
  name text,
  enabled boolean,
  whapi_channel_id text,
  connection_status text,
  health_status text,
  phone_number text,
  connected_user_name text,
  last_health_check_at timestamptz,
  last_webhook_received_at timestamptz,
  last_error text,
  health_snapshot jsonb,
  limits_snapshot jsonb,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    c.id,
    c.slug,
    c.name,
    c.enabled,
    c.whapi_channel_id,
    c.connection_status,
    c.health_status,
    c.phone_number,
    c.connected_user_name,
    c.last_health_check_at,
    c.last_webhook_received_at,
    c.last_error,
    c.health_snapshot,
    c.limits_snapshot,
    c.created_at,
    c.updated_at
  FROM public.comm_whatsapp_channels c
  WHERE c.slug = 'primary'
    AND public.current_user_can_view_comm_whatsapp()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_get_channel_state() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_get_channel_state() TO authenticated;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_mark_chat_read(p_chat_id uuid)
RETURNS TABLE(
  id uuid,
  unread_count integer,
  last_read_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para atualizar conversa.';
  END IF;

  RETURN QUERY
  UPDATE public.comm_whatsapp_chats
  SET
    unread_count = 0,
    last_read_at = now(),
    updated_at = now()
  WHERE public.comm_whatsapp_chats.id = p_chat_id
  RETURNING
    comm_whatsapp_chats.id,
    comm_whatsapp_chats.unread_count,
    comm_whatsapp_chats.last_read_at;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_mark_chat_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_mark_chat_read(uuid) TO authenticated;

INSERT INTO public.integration_settings (slug, name, description, settings)
VALUES (
  'comm_whatsapp_inbox',
  'Inbox WhatsApp (Whapi)',
  'Configuracao do canal principal do inbox WhatsApp compartilhado.',
  jsonb_build_object(
    'enabled', false,
    'token', ''
  )
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.comm_whatsapp_channels (slug, name, enabled)
VALUES ('primary', 'WhatsApp principal', false)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
