BEGIN;

CREATE TABLE IF NOT EXISTS public.comm_whatsapp_chat_identifiers (
  channel_id uuid NOT NULL REFERENCES public.comm_whatsapp_channels(id) ON DELETE CASCADE,
  external_chat_id text NOT NULL,
  chat_id uuid NOT NULL REFERENCES public.comm_whatsapp_chats(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'lid_reconciliation',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_confirmed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, external_chat_id),
  CONSTRAINT comm_whatsapp_chat_identifiers_external_chat_id_check
    CHECK (external_chat_id = public.normalize_comm_whatsapp_chat_id(external_chat_id))
);

CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_chat_identifiers_chat_id
  ON public.comm_whatsapp_chat_identifiers (chat_id);

ALTER TABLE public.comm_whatsapp_chat_identifiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage comm whatsapp chat identifiers" ON public.comm_whatsapp_chat_identifiers;
CREATE POLICY "Service role can manage comm whatsapp chat identifiers"
  ON public.comm_whatsapp_chat_identifiers FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.comm_whatsapp_resolve_canonical_chat_id(
  p_channel_id uuid,
  p_external_chat_id text
)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT c.external_chat_id
     FROM public.comm_whatsapp_chat_identifiers AS alias
     JOIN public.comm_whatsapp_chats AS c ON c.id = alias.chat_id
     WHERE alias.channel_id = p_channel_id
       AND alias.external_chat_id = p_external_chat_id),
    p_external_chat_id
  );
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_resolve_canonical_chat_id(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_resolve_canonical_chat_id(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_reconcile_lid_identifier(
  p_channel_id uuid,
  p_lid_external_chat_id text,
  p_phone_external_chat_id text
)
RETURNS TABLE(
  chat_id uuid,
  external_chat_id text,
  merged boolean,
  conflict_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lid text := NULLIF(public.normalize_comm_whatsapp_chat_id(p_lid_external_chat_id), '');
  v_phone text := NULLIF(public.normalize_comm_whatsapp_chat_id(p_phone_external_chat_id), '');
  v_lid_chat public.comm_whatsapp_chats%ROWTYPE;
  v_phone_chat public.comm_whatsapp_chats%ROWTYPE;
  v_winner public.comm_whatsapp_chats%ROWTYPE;
  v_loser_id uuid;
  v_loser_external_chat_id text;
  v_lock1 bigint;
  v_lock2 bigint;
  v_latest_record record;
  v_preview text;
  v_unread integer;
BEGIN
  IF v_lid IS NULL OR v_phone IS NULL THEN
    RAISE EXCEPTION 'LID e identificador telefonico sao obrigatorios.';
  END IF;

  IF v_lid !~* '@lid$' THEN
    RAISE EXCEPTION 'O primeiro argumento deve ser um identificador LID.';
  END IF;

  IF v_phone !~* '@s\.whatsapp\.net$' THEN
    RAISE EXCEPTION 'O segundo argumento deve ser um identificador telefonico valido.';
  END IF;

  IF v_lid = v_phone THEN
    RAISE EXCEPTION 'Os identificadores LID e telefonico nao podem ser iguais.';
  END IF;

  v_lock1 := hashtextextended('comm-whatsapp-chat-reconciliation:' || p_channel_id::text || ':' || v_lid, 0);
  v_lock2 := hashtextextended('comm-whatsapp-chat-reconciliation:' || p_channel_id::text || ':' || v_phone, 0);

  IF v_lock1 < v_lock2 THEN
    PERFORM pg_advisory_xact_lock(v_lock1);
    PERFORM pg_advisory_xact_lock(v_lock2);
  ELSE
    PERFORM pg_advisory_xact_lock(v_lock2);
    PERFORM pg_advisory_xact_lock(v_lock1);
  END IF;

  SELECT * INTO v_lid_chat
  FROM public.comm_whatsapp_chats
  WHERE channel_id = p_channel_id AND external_chat_id = v_lid
  FOR UPDATE;

  SELECT * INTO v_phone_chat
  FROM public.comm_whatsapp_chats
  WHERE channel_id = p_channel_id AND external_chat_id = v_phone
  FOR UPDATE;

  IF v_lid_chat.id IS NULL AND v_phone_chat.id IS NULL THEN
    INSERT INTO public.comm_whatsapp_chats (
      channel_id, external_chat_id, phone_number, phone_digits, display_name,
      last_message_direction
    )
    VALUES (
      p_channel_id, v_phone,
      COALESCE(NULLIF(public.normalize_comm_whatsapp_phone(split_part(v_phone, '@', 1)), ''), ''),
      COALESCE(NULLIF(public.normalize_comm_whatsapp_phone(split_part(v_phone, '@', 1)), ''), ''),
      'Novo contato',
      'system'
    )
    RETURNING * INTO v_phone_chat;

    INSERT INTO public.comm_whatsapp_chat_identifiers (channel_id, external_chat_id, chat_id, source)
    VALUES (p_channel_id, v_lid, v_phone_chat.id, 'lid_reconciliation')
    ON CONFLICT (channel_id, external_chat_id) DO NOTHING;

    RETURN QUERY SELECT v_phone_chat.id, v_phone, true, NULL::text;
    RETURN;
  END IF;

  IF v_lid_chat.id IS NOT NULL AND v_phone_chat.id IS NULL THEN
    INSERT INTO public.comm_whatsapp_chat_identifiers (channel_id, external_chat_id, chat_id, source)
    VALUES (p_channel_id, v_phone, v_lid_chat.id, 'lid_reconciliation')
    ON CONFLICT (channel_id, external_chat_id) DO NOTHING;

    RETURN QUERY SELECT v_lid_chat.id, v_lid, true, NULL::text;
    RETURN;
  END IF;

  IF v_lid_chat.id IS NULL AND v_phone_chat.id IS NOT NULL THEN
    INSERT INTO public.comm_whatsapp_chat_identifiers (channel_id, external_chat_id, chat_id, source)
    VALUES (p_channel_id, v_lid, v_phone_chat.id, 'lid_reconciliation')
    ON CONFLICT (channel_id, external_chat_id) DO NOTHING;

    RETURN QUERY SELECT v_phone_chat.id, v_phone, true, NULL::text;
    RETURN;
  END IF;

  IF v_lid_chat.lead_id IS NOT NULL AND v_phone_chat.lead_id IS NOT NULL
    AND v_lid_chat.lead_id <> v_phone_chat.lead_id
  THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, false, 'lead_conflict'::text;
    RETURN;
  END IF;

  IF v_phone_chat.deleted_at IS NULL
    AND (v_lid_chat.deleted_at IS NOT NULL OR v_phone_chat.created_at <= v_lid_chat.created_at)
  THEN
    v_winner := v_phone_chat;
    v_loser_id := v_lid_chat.id;
    v_loser_external_chat_id := v_lid;
  ELSE
    v_winner := v_lid_chat;
    v_loser_id := v_phone_chat.id;
    v_loser_external_chat_id := v_phone;
  END IF;

  UPDATE public.comm_whatsapp_messages
  SET chat_id = v_winner.id
  WHERE chat_id = v_loser_id;

  UPDATE public.comm_whatsapp_enrichment_jobs
  SET chat_id = v_winner.id
  WHERE chat_id = v_loser_id;

  UPDATE public.comm_whatsapp_ai_intent_suggestions
  SET chat_id = v_winner.id
  WHERE chat_id = v_loser_id;

  UPDATE public.comm_whatsapp_campaign_targets
  SET chat_id = v_winner.id
  WHERE chat_id = v_loser_id;

  UPDATE public.comm_whatsapp_opt_outs
  SET source_chat_id = v_winner.id
  WHERE source_chat_id = v_loser_id;

  UPDATE public.comm_follow_up_audit_log
  SET chat_id = v_winner.id::text
  WHERE chat_id = v_loser_id::text;

  DELETE FROM public.comm_whatsapp_chat_identifiers AS alias
  WHERE alias.chat_id = v_loser_id
    AND EXISTS (
      SELECT 1 FROM public.comm_whatsapp_chat_identifiers AS existing
      WHERE existing.channel_id = alias.channel_id
        AND existing.external_chat_id = alias.external_chat_id
        AND existing.chat_id = v_winner.id
    );

  UPDATE public.comm_whatsapp_chat_identifiers
  SET chat_id = v_winner.id, last_confirmed_at = now()
  WHERE chat_id = v_loser_id;

  INSERT INTO public.comm_whatsapp_chat_identifiers (channel_id, external_chat_id, chat_id, source)
  VALUES (p_channel_id, v_loser_external_chat_id, v_winner.id, 'lid_reconciliation')
  ON CONFLICT (channel_id, external_chat_id) DO NOTHING;

  DELETE FROM public.comm_whatsapp_chats WHERE id = v_loser_id;

  SELECT m.text_content, m.message_at, m.direction, m.message_type, m.media_caption
  INTO v_latest_record
  FROM public.comm_whatsapp_messages AS m
  WHERE m.chat_id = v_winner.id
    AND COALESCE(m.delivery_status, '') <> 'deleted'
  ORDER BY m.message_at DESC
  LIMIT 1;

  v_preview := CASE
    WHEN v_latest_record.message_at IS NOT NULL
    THEN public.comm_whatsapp_message_preview_text(
      v_latest_record.media_caption, v_latest_record.text_content, v_latest_record.message_type
    )
    ELSE NULL
  END;

  SELECT count(*) INTO v_unread
  FROM public.comm_whatsapp_messages AS msg
  WHERE msg.chat_id = v_winner.id
    AND msg.direction = 'inbound'
    AND COALESCE(msg.delivery_status, '') <> 'deleted'
    AND (v_winner.last_read_at IS NULL OR msg.message_at > v_winner.last_read_at);

  UPDATE public.comm_whatsapp_chats
  SET
    phone_number = CASE
      WHEN NULLIF(public.comm_whatsapp_chats.phone_number, '') IS NULL THEN COALESCE(NULLIF(public.normalize_comm_whatsapp_phone(split_part(v_phone, '@', 1)), ''), '')
      ELSE public.comm_whatsapp_chats.phone_number
    END,
    phone_digits = CASE
      WHEN NULLIF(public.comm_whatsapp_chats.phone_digits, '') IS NULL THEN COALESCE(NULLIF(public.normalize_comm_whatsapp_phone(split_part(v_phone, '@', 1)), ''), '')
      ELSE public.comm_whatsapp_chats.phone_digits
    END,
    lead_id = COALESCE(public.comm_whatsapp_chats.lead_id, v_phone_chat.lead_id),
    display_name = COALESCE(NULLIF(public.comm_whatsapp_chats.display_name, ''), 'Novo contato'),
    last_message_text = CASE WHEN v_preview IS NOT NULL THEN v_preview ELSE public.comm_whatsapp_chats.last_message_text END,
    last_message_direction = CASE WHEN v_preview IS NOT NULL THEN v_latest_record.direction ELSE public.comm_whatsapp_chats.last_message_direction END,
    last_message_at = CASE WHEN v_preview IS NOT NULL THEN v_latest_record.message_at ELSE public.comm_whatsapp_chats.last_message_at END,
    unread_count = v_unread,
    last_read_at = GREATEST(
      COALESCE(public.comm_whatsapp_chats.last_read_at, '-infinity'::timestamptz),
      COALESCE(v_phone_chat.last_read_at, '-infinity'::timestamptz),
      COALESCE(v_lid_chat.last_read_at, '-infinity'::timestamptz)
    ),
    is_archived = public.comm_whatsapp_chats.is_archived OR v_phone_chat.is_archived OR v_lid_chat.is_archived,
    is_muted = public.comm_whatsapp_chats.is_muted OR v_phone_chat.is_muted OR v_lid_chat.is_muted,
    is_pinned = public.comm_whatsapp_chats.is_pinned OR v_phone_chat.is_pinned OR v_lid_chat.is_pinned,
    deleted_at = CASE
      WHEN (public.comm_whatsapp_chats.deleted_at IS NOT NULL)
        AND (v_lid_chat.deleted_at IS NOT NULL OR public.comm_whatsapp_chats.deleted_at IS NOT NULL)
      THEN LEAST(
        COALESCE(public.comm_whatsapp_chats.deleted_at, 'infinity'::timestamptz),
        COALESCE(v_lid_chat.deleted_at, 'infinity'::timestamptz)
      )
      ELSE NULL
    END,
    updated_at = now()
  WHERE id = v_winner.id;

  SELECT * INTO v_winner FROM public.comm_whatsapp_refresh_chat_identity(v_winner.id);

  RETURN QUERY SELECT v_winner.id, v_winner.external_chat_id, true, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_reconcile_lid_identifier(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_reconcile_lid_identifier(uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_open_or_create_chat(
  p_external_chat_id text,
  p_phone_number text,
  p_push_name text DEFAULT NULL,
  p_saved_contact_name text DEFAULT NULL,
  p_lead_id uuid DEFAULT NULL
)
RETURNS SETOF public.comm_whatsapp_chats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel_id uuid;
  v_chat public.comm_whatsapp_chats%ROWTYPE;
  v_phone_number text := NULLIF(public.normalize_comm_whatsapp_phone(COALESCE(p_phone_number, '')), '');
  v_saved_contact_name text := NULLIF(btrim(COALESCE(p_saved_contact_name, '')), '');
  v_push_name text := NULLIF(btrim(COALESCE(p_push_name, '')), '');
  v_lead_name text;
  v_external_chat_id text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.current_user_can_edit_comm_whatsapp() THEN
    RAISE EXCEPTION 'Permissao insuficiente para iniciar conversa.';
  END IF;

  IF v_phone_number IS NULL THEN
    RAISE EXCEPTION 'Numero obrigatorio para iniciar conversa.';
  END IF;

  SELECT id INTO v_channel_id
  FROM public.comm_whatsapp_channels
  WHERE slug = 'primary'
  LIMIT 1;

  IF v_channel_id IS NULL THEN
    RAISE EXCEPTION 'Canal WhatsApp principal nao encontrado.';
  END IF;

  v_external_chat_id := public.comm_whatsapp_resolve_canonical_chat_id(v_channel_id, p_external_chat_id);

  IF p_lead_id IS NOT NULL THEN
    SELECT NULLIF(btrim(nome_completo), '') INTO v_lead_name FROM public.leads WHERE id = p_lead_id;
  END IF;

  INSERT INTO public.comm_whatsapp_chats (
    channel_id, external_chat_id, phone_number, phone_digits, display_name,
    push_name, saved_contact_name, lead_id, last_message_direction, unread_count, status
  )
  VALUES (
    v_channel_id, v_external_chat_id, v_phone_number, v_phone_number,
    COALESCE(v_saved_contact_name, v_lead_name, v_push_name, public.comm_whatsapp_format_phone_label(v_phone_number)),
    v_push_name, v_saved_contact_name, p_lead_id, 'system', 0, 'open'
  )
  ON CONFLICT (channel_id, external_chat_id)
  DO UPDATE SET
    phone_number = EXCLUDED.phone_number,
    phone_digits = EXCLUDED.phone_digits,
    push_name = COALESCE(EXCLUDED.push_name, public.comm_whatsapp_chats.push_name),
    saved_contact_name = COALESCE(EXCLUDED.saved_contact_name, public.comm_whatsapp_chats.saved_contact_name),
    lead_id = COALESCE(EXCLUDED.lead_id, public.comm_whatsapp_chats.lead_id),
    updated_at = now()
  RETURNING * INTO v_chat;

  RETURN QUERY SELECT * FROM public.comm_whatsapp_refresh_chat_identity(v_chat.id);
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_open_or_create_chat(text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_open_or_create_chat(text, text, text, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_persist_message(
  p_channel_id uuid,
  p_external_chat_id text,
  p_phone_number text,
  p_display_name text,
  p_push_name text,
  p_last_message_text text,
  p_last_message_direction text,
  p_last_message_at timestamptz,
  p_increment_unread boolean,
  p_external_message_id text,
  p_direction text,
  p_message_type text,
  p_delivery_status text,
  p_text_content text,
  p_created_by uuid,
  p_source text,
  p_sender_name text,
  p_sender_phone text,
  p_status_updated_at timestamptz,
  p_error_message text,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_media_id text DEFAULT NULL,
  p_media_url text DEFAULT NULL,
  p_media_mime_type text DEFAULT NULL,
  p_media_file_name text DEFAULT NULL,
  p_media_size_bytes bigint DEFAULT NULL,
  p_media_duration_seconds integer DEFAULT NULL,
  p_media_caption text DEFAULT NULL
)
RETURNS TABLE(
  chat_id uuid,
  message_id uuid,
  inserted boolean,
  unread_count integer,
  summary_updated boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result record;
  v_external_chat_id text := NULLIF(public.normalize_comm_whatsapp_chat_id(p_external_chat_id), '');
  v_resolved_chat_id text;
  v_phone_number text := NULLIF(public.normalize_comm_whatsapp_phone(COALESCE(p_phone_number, '')), '');
  v_display_name text := NULLIF(btrim(COALESCE(p_display_name, '')), '');
  v_direction text := COALESCE(NULLIF(btrim(COALESCE(p_direction, '')), ''), 'system');
  v_message_at timestamptz := COALESCE(p_last_message_at, p_status_updated_at, now());
  v_summary_text text := public.comm_whatsapp_message_preview_text(
    p_media_caption,
    COALESCE(p_text_content, p_last_message_text),
    COALESCE(NULLIF(btrim(COALESCE(p_message_type, '')), ''), 'text')
  );
  v_is_lid boolean;
  v_lead_id uuid;
  v_lead_matches integer := 0;
  v_unread_count integer;
BEGIN
  IF v_external_chat_id IS NOT NULL THEN
    v_resolved_chat_id := public.comm_whatsapp_resolve_canonical_chat_id(p_channel_id, v_external_chat_id);
    v_is_lid := v_resolved_chat_id ~* '@lid$';

    IF v_phone_number IS NULL AND v_is_lid THEN
      SELECT NULLIF(btrim(chat.phone_digits), '')
      INTO v_phone_number
      FROM public.comm_whatsapp_chats AS chat
      WHERE chat.channel_id = p_channel_id
        AND chat.external_chat_id = v_resolved_chat_id
      LIMIT 1;
    ELSIF v_phone_number IS NULL AND v_resolved_chat_id ~* '@s\.whatsapp\.net$' THEN
      v_phone_number := NULLIF(public.normalize_comm_whatsapp_phone(split_part(v_resolved_chat_id, '@', 1)), '');
    END IF;

    INSERT INTO public.comm_whatsapp_chats AS chat (
      channel_id, external_chat_id, phone_number, phone_digits, display_name, last_message_direction
    )
    VALUES (
      p_channel_id,
      v_resolved_chat_id,
      COALESCE(v_phone_number, ''),
      COALESCE(v_phone_number, ''),
      COALESCE(v_display_name, v_phone_number, 'Numero desconhecido'),
      'system'
    )
    ON CONFLICT (channel_id, external_chat_id) DO NOTHING;
  END IF;

  SELECT * INTO v_result
  FROM public.comm_whatsapp_persist_message_internal(
    p_channel_id, v_resolved_chat_id, v_phone_number, p_display_name, p_push_name,
    p_last_message_text, p_last_message_direction, p_last_message_at, p_increment_unread,
    p_external_message_id, p_direction, p_message_type, p_delivery_status, p_text_content,
    p_created_by, p_source, p_sender_name, p_sender_phone, p_status_updated_at,
    p_error_message, p_metadata, p_media_id, p_media_url, p_media_mime_type,
    p_media_file_name, p_media_size_bytes, p_media_duration_seconds, p_media_caption
  );

  IF v_is_lid AND v_phone_number IS NULL THEN
    UPDATE public.comm_whatsapp_chats AS chat
    SET phone_number = '',
        phone_digits = '',
        display_name = CASE
          WHEN chat.display_name IN ('00000000000', public.comm_whatsapp_format_phone_label('00000000000'))
            THEN 'Numero desconhecido'
          ELSE chat.display_name
        END,
        updated_at = now()
    WHERE chat.id = v_result.chat_id;
  END IF;

  IF v_phone_number IS NOT NULL THEN
    SELECT count(*), min(l.id::text)::uuid
    INTO v_lead_matches, v_lead_id
    FROM public.leads l
    WHERE COALESCE(l.arquivado, false) = false
      AND public.comm_whatsapp_phone_lookup_keys(l.telefone)
        && public.comm_whatsapp_phone_lookup_keys(v_phone_number);

    IF v_lead_matches = 1 THEN
      UPDATE public.comm_whatsapp_chats AS chat
      SET lead_id = v_lead_id,
          updated_at = now()
      WHERE chat.id = v_result.chat_id
        AND chat.lead_id IS NULL;
    END IF;
  END IF;

  IF v_result.inserted
    AND v_direction IN ('inbound', 'outbound')
    AND v_summary_text IS NOT NULL
  THEN
    UPDATE public.comm_whatsapp_chats AS chat
    SET is_archived = false, archived_at = NULL, updated_at = now()
    WHERE chat.id = v_result.chat_id
      AND chat.is_archived
      AND NOT chat.is_muted
      AND (chat.archived_at IS NULL OR v_message_at > chat.archived_at)
    RETURNING chat.unread_count INTO v_unread_count;
  END IF;

  RETURN QUERY SELECT
    v_result.chat_id,
    v_result.message_id,
    v_result.inserted,
    COALESCE(v_unread_count, v_result.unread_count),
    v_result.summary_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.comm_whatsapp_persist_message(
  uuid, text, text, text, text, text, text, timestamptz, boolean, text, text, text, text, text, uuid, text, text, text, timestamptz, text, jsonb, text, text, text, text, bigint, integer, text
) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.comm_whatsapp_persist_message(
  uuid, text, text, text, text, text, text, timestamptz, boolean, text, text, text, text, text, uuid, text, text, text, timestamptz, text, jsonb, text, text, text, text, bigint, integer, text
) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
