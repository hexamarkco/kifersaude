BEGIN;

-- Groups are first-class Inbox conversations, but are deliberately not phone
-- identities. The empty phone fields preserve the current NOT NULL contract
-- while preventing CRM/contact resolution from inventing a phone number.
ALTER TABLE public.comm_whatsapp_chats
  ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_chats_group_last_message
  ON public.comm_whatsapp_chats (is_group, last_message_at DESC NULLS LAST, updated_at DESC);

CREATE OR REPLACE FUNCTION public.comm_whatsapp_enforce_group_chat_identity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.is_group, false) OR NEW.external_chat_id ~* '@g\.us$' THEN
    IF NEW.lead_id IS NOT NULL
      OR NEW.lead_link_source IS NOT NULL
      OR NEW.lead_linked_at IS NOT NULL
      OR NEW.lead_linked_by IS NOT NULL THEN
      RAISE EXCEPTION 'Chats de grupo nao podem ser vinculados a leads.' USING ERRCODE = 'check_violation';
    END IF;

    NEW.is_group := true;
    NEW.phone_number := '';
    NEW.phone_digits := '';
    NEW.lead_id := NULL;
    NEW.lead_link_source := NULL;
    NEW.lead_linked_at := NULL;
    NEW.lead_linked_by := NULL;
    NEW.auto_link_blocked := true;
    NEW.identity_conflict := false;
    NEW.push_name := NULL;
    NEW.autonomous_attendance_status := 'inactive';
    NEW.display_name := COALESCE(NULLIF(btrim(NEW.display_name), ''), 'Grupo');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_reject_group_automation_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.chat_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.comm_whatsapp_chats c
      WHERE c.id = NEW.chat_id
        AND c.is_group = true
    ) THEN
    RAISE EXCEPTION 'Chats de grupo nao participam de campanhas ou automacoes de IA.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comm_whatsapp_enforce_group_chat_identity
  ON public.comm_whatsapp_chats;
CREATE TRIGGER trg_comm_whatsapp_enforce_group_chat_identity
  BEFORE INSERT OR UPDATE ON public.comm_whatsapp_chats
  FOR EACH ROW
  EXECUTE FUNCTION public.comm_whatsapp_enforce_group_chat_identity();

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'comm_whatsapp_campaign_targets',
    'comm_whatsapp_ai_intent_suggestions',
    'ai_autonomous_reply_jobs'
  ] LOOP
    IF to_regclass(format('public.%I', v_table)) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_comm_whatsapp_reject_group_automation ON public.%I', v_table);
      EXECUTE format(
        'CREATE TRIGGER trg_comm_whatsapp_reject_group_automation
           BEFORE INSERT OR UPDATE OF chat_id ON public.%I
           FOR EACH ROW
           EXECUTE FUNCTION public.comm_whatsapp_reject_group_automation_row()',
        v_table
      );
    END IF;
  END LOOP;
END;
$$;

UPDATE public.comm_whatsapp_chats
SET is_group = true,
    phone_number = '',
    phone_digits = '',
    lead_id = NULL,
    lead_link_source = NULL,
    lead_linked_at = NULL,
    lead_linked_by = NULL,
    auto_link_blocked = true,
    identity_conflict = false,
    push_name = NULL,
    autonomous_attendance_status = 'inactive'
WHERE external_chat_id ~* '@g\.us$'
  AND (
    is_group IS DISTINCT FROM true
    OR phone_number <> ''
    OR phone_digits <> ''
    OR lead_id IS NOT NULL
    OR auto_link_blocked IS DISTINCT FROM true
  );

CREATE TABLE IF NOT EXISTS public.comm_whatsapp_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.comm_whatsapp_channels(id) ON DELETE CASCADE,
  chat_id uuid NOT NULL UNIQUE REFERENCES public.comm_whatsapp_chats(id) ON DELETE CASCADE,
  external_group_id text NOT NULL,
  name text NOT NULL DEFAULT 'Grupo',
  description text,
  chat_pic text,
  chat_pic_full text,
  created_at_provider timestamptz,
  created_by text,
  name_at timestamptz,
  admin_add_member_mode boolean,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  raw_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel_id, external_group_id)
);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_groups_channel_name
  ON public.comm_whatsapp_groups (channel_id, name);

CREATE TABLE IF NOT EXISTS public.comm_whatsapp_group_participants (
  group_id uuid NOT NULL REFERENCES public.comm_whatsapp_groups(id) ON DELETE CASCADE,
  external_participant_id text NOT NULL,
  phone_digits text,
  display_name text,
  rank text NOT NULL DEFAULT 'member'
    CHECK (rank IN ('creator', 'admin', 'member', 'unknown')),
  membership_status text NOT NULL DEFAULT 'member'
    CHECK (membership_status IN ('member', 'pending', 'removed', 'unknown')),
  joined_at timestamptz,
  raw_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, external_participant_id)
);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_group_participants_group_rank
  ON public.comm_whatsapp_group_participants (group_id, membership_status, rank, display_name);

CREATE TABLE IF NOT EXISTS public.comm_whatsapp_group_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.comm_whatsapp_channels(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.comm_whatsapp_groups(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  participant_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  before_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  triggered_by text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  provider_event_key text NOT NULL UNIQUE,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_group_events_group_occurred
  ON public.comm_whatsapp_group_events (group_id, occurred_at DESC, created_at DESC);

DROP TRIGGER IF EXISTS trg_comm_whatsapp_groups_updated_at ON public.comm_whatsapp_groups;
CREATE TRIGGER trg_comm_whatsapp_groups_updated_at
  BEFORE UPDATE ON public.comm_whatsapp_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_comm_whatsapp_group_participants_updated_at
  ON public.comm_whatsapp_group_participants;
CREATE TRIGGER trg_comm_whatsapp_group_participants_updated_at
  BEFORE UPDATE ON public.comm_whatsapp_group_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.comm_whatsapp_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comm_whatsapp_group_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comm_whatsapp_group_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.comm_whatsapp_groups,
  public.comm_whatsapp_group_participants,
  public.comm_whatsapp_group_events FROM anon, authenticated;
GRANT SELECT ON TABLE public.comm_whatsapp_groups,
  public.comm_whatsapp_group_participants,
  public.comm_whatsapp_group_events TO authenticated;
GRANT ALL ON TABLE public.comm_whatsapp_groups,
  public.comm_whatsapp_group_participants,
  public.comm_whatsapp_group_events TO service_role;

DROP POLICY IF EXISTS "Authenticated users can view comm whatsapp groups"
  ON public.comm_whatsapp_groups;
CREATE POLICY "Authenticated users can view comm whatsapp groups"
  ON public.comm_whatsapp_groups
  FOR SELECT TO authenticated
  USING (public.current_user_can_view_comm_whatsapp());

DROP POLICY IF EXISTS "Authenticated users can view comm whatsapp group participants"
  ON public.comm_whatsapp_group_participants;
CREATE POLICY "Authenticated users can view comm whatsapp group participants"
  ON public.comm_whatsapp_group_participants
  FOR SELECT TO authenticated
  USING (public.current_user_can_view_comm_whatsapp());

DROP POLICY IF EXISTS "Authenticated users can view comm whatsapp group events"
  ON public.comm_whatsapp_group_events;
CREATE POLICY "Authenticated users can view comm whatsapp group events"
  ON public.comm_whatsapp_group_events
  FOR SELECT TO authenticated
  USING (public.current_user_can_view_comm_whatsapp());

-- Explicitly service-only writes. No authenticated INSERT/UPDATE/DELETE
-- policies are created for these metadata tables.
REVOKE ALL ON FUNCTION public.comm_whatsapp_enforce_group_chat_identity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.comm_whatsapp_reject_group_automation_row() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_get_group_context(p_chat_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_chat_id uuid;
  v_group jsonb;
  v_participants jsonb;
  v_events jsonb;
BEGIN
  IF NOT public.current_user_can_view_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para visualizar o grupo.' USING ERRCODE = '42501';
  END IF;

  v_chat_id := public.comm_whatsapp_resolve_chat_uuid(p_chat_id);

  SELECT to_jsonb(g)
  INTO v_group
  FROM public.comm_whatsapp_groups g
  JOIN public.comm_whatsapp_chats c ON c.id = g.chat_id
  WHERE g.chat_id = v_chat_id
    AND c.is_group = true
    AND c.deleted_at IS NULL;

  IF v_group IS NULL THEN
    RAISE EXCEPTION 'Grupo do WhatsApp nao encontrado.' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY
      CASE p.rank WHEN 'creator' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
      COALESCE(p.display_name, p.external_participant_id)), '[]'::jsonb)
  INTO v_participants
  FROM public.comm_whatsapp_group_participants p
  WHERE p.group_id = (v_group ->> 'id')::uuid
    AND p.membership_status <> 'removed';

  SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.occurred_at DESC, e.created_at DESC), '[]'::jsonb)
  INTO v_events
  FROM (
    SELECT e.*
    FROM public.comm_whatsapp_group_events e
    WHERE e.group_id = (v_group ->> 'id')::uuid
    ORDER BY e.occurred_at DESC, e.created_at DESC
    LIMIT 200
  ) e;

  RETURN jsonb_build_object(
    'group', v_group,
    'participants', v_participants,
    'events', v_events
  );
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_get_group_context(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_get_group_context(uuid) TO authenticated;

-- A compatible read projection keeps the original list RPC contract intact
-- for older clients while exposing is_group to the current Inbox.
CREATE OR REPLACE FUNCTION public.comm_whatsapp_list_chats_with_groups(
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
  SELECT c.id, c.channel_id, c.external_chat_id, COALESCE(chat.is_group, false),
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
  WHERE public.current_user_can_view_comm_whatsapp();
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_list_chats_with_groups(text, text, text, text, text, text[], text[], integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_list_chats_with_groups(text, text, text, text, text, text[], text[], integer, integer) TO authenticated;

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
BEGIN
  v_thread := public.comm_whatsapp_get_chat_thread(p_chat_id, p_limit);
  v_chat_id := public.comm_whatsapp_resolve_chat_uuid(p_chat_id);
  SELECT COALESCE(c.is_group, false) INTO v_is_group
  FROM public.comm_whatsapp_chats c
  WHERE c.id = v_chat_id;
  RETURN jsonb_set(v_thread, '{chat,is_group}', to_jsonb(v_is_group), true);
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_get_chat_thread_with_groups(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_get_chat_thread_with_groups(uuid, integer) TO authenticated;

-- Manual scheduling for groups uses chat_id, never a fabricated phone number.
-- CRM fields are intentionally absent from this RPC.
CREATE OR REPLACE FUNCTION public.create_comm_whatsapp_group_scheduled_message(
  p_channel_id uuid,
  p_chat_id uuid,
  p_scheduled_at timestamptz,
  p_message_type text DEFAULT 'text',
  p_text_content text DEFAULT NULL,
  p_media_url text DEFAULT NULL,
  p_media_mime_type text DEFAULT NULL,
  p_media_file_name text DEFAULT NULL,
  p_recurrence text DEFAULT 'none',
  p_recurrence_config jsonb DEFAULT '{}'::jsonb,
  p_recurrence_ends_at timestamptz DEFAULT NULL,
  p_label text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_max_attempts integer DEFAULT 3,
  p_cancel_on_inbound_message boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat public.comm_whatsapp_chats%ROWTYPE;
  v_new_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para agendar mensagem.' USING ERRCODE = '42501';
  END IF;
  IF p_text_content IS NULL AND p_media_url IS NULL THEN
    RAISE EXCEPTION 'A mensagem precisa de texto ou midia.';
  END IF;
  IF p_scheduled_at < clock_timestamp() THEN
    RAISE EXCEPTION 'A data de agendamento nao pode ser no passado.';
  END IF;
  IF p_recurrence NOT IN ('none', 'daily', 'weekly', 'monthly') THEN
    RAISE EXCEPTION 'Recorrencia invalida: %', p_recurrence;
  END IF;

  SELECT * INTO v_chat
  FROM public.comm_whatsapp_chats
  WHERE id = p_chat_id
    AND channel_id = p_channel_id
    AND is_group = true
    AND deleted_at IS NULL
    AND merged_into_chat_id IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Grupo do WhatsApp nao encontrado.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.comm_whatsapp_scheduled_messages (
    channel_id, chat_id, phone_digits, phone_number, display_name,
    message_type, text_content, media_url, media_mime_type, media_file_name,
    scheduled_at, recurrence, recurrence_config, recurrence_ends_at,
    next_run_at, status, cancel_on_inbound_message, lead_id, contract_id,
    created_by, label, notes, max_attempts, metadata
  ) VALUES (
    p_channel_id, p_chat_id, '', '', v_chat.display_name,
    p_message_type, p_text_content, p_media_url, p_media_mime_type, p_media_file_name,
    p_scheduled_at, p_recurrence, p_recurrence_config,
    CASE WHEN p_recurrence <> 'none' THEN p_recurrence_ends_at ELSE NULL END,
    CASE WHEN p_recurrence <> 'none' THEN p_scheduled_at ELSE NULL END,
    'scheduled', COALESCE(p_cancel_on_inbound_message, false), NULL, NULL,
    auth.uid(), p_label, p_notes, GREATEST(p_max_attempts, 1), jsonb_build_object('is_group', true)
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_comm_whatsapp_group_scheduled_message(
  uuid, uuid, timestamptz, text, text, text, text, text, text, jsonb,
  timestamptz, text, text, integer, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_comm_whatsapp_group_scheduled_message(
  uuid, uuid, timestamptz, text, text, text, text, text, text, jsonb,
  timestamptz, text, text, integer, boolean
) TO authenticated;

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.comm_whatsapp_groups REPLICA IDENTITY FULL;
    ALTER TABLE public.comm_whatsapp_group_participants REPLICA IDENTITY FULL;
    ALTER TABLE public.comm_whatsapp_group_events REPLICA IDENTITY FULL;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comm_whatsapp_groups;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comm_whatsapp_group_participants;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comm_whatsapp_group_events;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
