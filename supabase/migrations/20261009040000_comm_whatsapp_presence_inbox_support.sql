BEGIN;

-- Whapi presence is a current snapshot, not a CRM activity log. The provider
-- emits transient states such as typing/recording and a durable last-seen
-- timestamp; keeping the snapshot separate avoids polluting chat identity.
CREATE TABLE IF NOT EXISTS public.comm_whatsapp_presences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.comm_whatsapp_channels(id) ON DELETE CASCADE,
  external_entry_id text NOT NULL,
  chat_id uuid REFERENCES public.comm_whatsapp_chats(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'unknown'
    CHECK (status IN ('online', 'offline', 'typing', 'recording', 'pending', 'unknown')),
  last_seen_at timestamptz,
  observed_at timestamptz NOT NULL DEFAULT now(),
  subscription_status text NOT NULL DEFAULT 'unknown'
    CHECK (subscription_status IN ('unknown', 'pending', 'subscribed', 'already_subscribed', 'not_found', 'failed')),
  subscription_attempted_at timestamptz,
  subscribed_at timestamptz,
  subscription_error text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comm_whatsapp_presences_external_entry_not_blank CHECK (btrim(external_entry_id) <> ''),
  CONSTRAINT comm_whatsapp_presences_channel_entry_unique UNIQUE (channel_id, external_entry_id)
);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_presences_chat
  ON public.comm_whatsapp_presences (channel_id, chat_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_presences_entry
  ON public.comm_whatsapp_presences (channel_id, external_entry_id);

CREATE OR REPLACE FUNCTION public.comm_whatsapp_presences_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comm_whatsapp_presences_updated_at
  ON public.comm_whatsapp_presences;
CREATE TRIGGER trg_comm_whatsapp_presences_updated_at
  BEFORE UPDATE ON public.comm_whatsapp_presences
  FOR EACH ROW
  EXECUTE FUNCTION public.comm_whatsapp_presences_set_updated_at();

ALTER TABLE public.comm_whatsapp_presences ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.comm_whatsapp_presences FROM anon, authenticated;
GRANT SELECT ON TABLE public.comm_whatsapp_presences TO authenticated;
GRANT ALL ON TABLE public.comm_whatsapp_presences TO service_role;

DROP POLICY IF EXISTS "Authenticated users can view comm whatsapp presences"
  ON public.comm_whatsapp_presences;
CREATE POLICY "Authenticated users can view comm whatsapp presences"
  ON public.comm_whatsapp_presences
  FOR SELECT TO authenticated
  USING (public.current_user_can_view_comm_whatsapp());

REVOKE ALL ON FUNCTION public.comm_whatsapp_presences_set_updated_at() FROM PUBLIC;

-- This projection keeps the original list RPC untouched and adds presence
-- fields for the Inbox. The join supports both direct phone entries and group
-- ids, including a presence received before a chat row was fully associated.
CREATE OR REPLACE FUNCTION public.comm_whatsapp_list_chats_with_presence(
  p_search text DEFAULT NULL,
  p_activity_filter text DEFAULT 'all',
  p_lead_filter text DEFAULT 'all',
  p_saved_filter text DEFAULT 'all',
  p_archived_filter text DEFAULT 'active',
  p_lead_status_filters text[] DEFAULT NULL,
  p_lead_responsavel_filters text[] DEFAULT NULL,
  p_limit integer DEFAULT 80,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid, channel_id uuid, external_chat_id text, is_group boolean,
  presence_status text, presence_last_seen_at timestamptz, presence_updated_at timestamptz,
  phone_number text, phone_digits text, display_name text,
  saved_contact_name text, push_name text, lead_id uuid, lead_name text,
  lead_status text, lead_responsavel_id uuid, lead_responsavel text,
  merged_into_chat_id uuid, lead_link_source text, lead_linked_at timestamptz,
  lead_linked_by uuid, auto_link_blocked boolean, identity_conflict boolean,
  is_archived boolean, archived_at timestamptz, is_muted boolean, muted_at timestamptz,
  is_pinned boolean, pinned_at timestamptz, manual_unread boolean,
  manual_unread_at timestamptz, last_message_text text, last_message_direction text,
  last_message_at timestamptz, last_message_delivery_status text,
  unread_count integer, status text, autonomous_attendance_status text,
  last_read_at timestamptz, created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT c.id, c.channel_id, c.external_chat_id,
    COALESCE(chat.is_group, false),
    presence.status, presence.last_seen_at, presence.observed_at,
    c.phone_number, c.phone_digits, c.display_name, c.saved_contact_name,
    c.push_name, c.lead_id, c.lead_name, c.lead_status,
    c.lead_responsavel_id, c.lead_responsavel, c.merged_into_chat_id,
    c.lead_link_source, c.lead_linked_at, c.lead_linked_by, c.auto_link_blocked,
    c.identity_conflict, c.is_archived, c.archived_at, c.is_muted, c.muted_at,
    c.is_pinned, c.pinned_at, c.manual_unread, c.manual_unread_at,
    c.last_message_text, c.last_message_direction, c.last_message_at,
    c.last_message_delivery_status, c.unread_count, c.status,
    c.autonomous_attendance_status, c.last_read_at, c.created_at, c.updated_at
  FROM public.comm_whatsapp_list_chats(
    p_search, p_activity_filter, p_lead_filter, p_saved_filter,
    p_archived_filter, p_lead_status_filters, p_lead_responsavel_filters,
    p_limit, p_offset
  ) c
  LEFT JOIN public.comm_whatsapp_chats chat ON chat.id = c.id
  LEFT JOIN LATERAL (
    SELECT p.status, p.last_seen_at, p.observed_at
    FROM public.comm_whatsapp_presences p
    WHERE p.channel_id = c.channel_id
      AND (
        p.chat_id = c.id
        OR p.external_entry_id = c.external_chat_id
        OR p.external_entry_id = c.phone_digits
      )
    ORDER BY (p.chat_id = c.id) DESC, p.observed_at DESC, p.updated_at DESC
    LIMIT 1
  ) presence ON true
  WHERE public.current_user_can_view_comm_whatsapp();
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_list_chats_with_presence(text, text, text, text, text, text[], text[], integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_list_chats_with_presence(text, text, text, text, text, text[], text[], integer, integer) TO authenticated;

-- Enrich the existing JSON thread contract without changing its signature.
CREATE OR REPLACE FUNCTION public.comm_whatsapp_get_chat_thread_with_groups(
  p_chat_id uuid,
  p_limit integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_thread jsonb;
  v_chat_id uuid;
  v_is_group boolean := false;
  v_presence_status text;
  v_presence_last_seen_at timestamptz;
  v_presence_updated_at timestamptz;
BEGIN
  v_thread := public.comm_whatsapp_get_chat_thread(p_chat_id, p_limit);
  v_chat_id := public.comm_whatsapp_resolve_chat_uuid(p_chat_id);

  SELECT COALESCE(c.is_group, false) INTO v_is_group
  FROM public.comm_whatsapp_chats c
  WHERE c.id = v_chat_id;

  SELECT p.status, p.last_seen_at, p.observed_at
  INTO v_presence_status, v_presence_last_seen_at, v_presence_updated_at
  FROM public.comm_whatsapp_presences p
  JOIN public.comm_whatsapp_chats c ON c.id = v_chat_id
  WHERE p.channel_id = c.channel_id
    AND (
      p.chat_id = v_chat_id
      OR p.external_entry_id = c.external_chat_id
      OR p.external_entry_id = c.phone_digits
    )
  ORDER BY (p.chat_id = v_chat_id) DESC, p.observed_at DESC, p.updated_at DESC
  LIMIT 1;

  RETURN v_thread || jsonb_build_object(
    'chat', COALESCE(v_thread -> 'chat', '{}'::jsonb) || jsonb_build_object(
      'is_group', v_is_group,
      'presence_status', v_presence_status,
      'presence_last_seen_at', v_presence_last_seen_at,
      'presence_updated_at', v_presence_updated_at
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_get_chat_thread_with_groups(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_get_chat_thread_with_groups(uuid, integer) TO authenticated;

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.comm_whatsapp_presences REPLICA IDENTITY FULL;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comm_whatsapp_presences;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
