BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- These request rows are also the audit trail for MCP Inbox state changes.
-- They store identifiers and state only; names, phone numbers, and messages
-- are deliberately excluded. A single row per actor/request makes retries
-- safe and prevents reapplying state changes after a lost HTTP response.
CREATE TABLE public.mcp_comm_whatsapp_action_audit (
  actor_id uuid NOT NULL,
  client_request_id text NOT NULL,
  operation text NOT NULL CHECK (operation IN (
    'chat.archived.set',
    'chat.muted.set',
    'chat.pinned.set',
    'chat.unread.set',
    'chat.read',
    'chat.lead.link',
    'chat.lead.unlink'
  )),
  requested_chat_id uuid NOT NULL,
  chat_id uuid,
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  before_state jsonb,
  after_state jsonb,
  result_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (actor_id, client_request_id),
  CONSTRAINT mcp_comm_whatsapp_action_request_id_format
    CHECK (client_request_id ~ '^[A-Za-z0-9:_-]{1,128}$'),
  CONSTRAINT mcp_comm_whatsapp_action_states_object
    CHECK (
      (before_state IS NULL OR jsonb_typeof(before_state) = 'object')
      AND (after_state IS NULL OR jsonb_typeof(after_state) = 'object')
      AND (result_payload IS NULL OR jsonb_typeof(result_payload) = 'object')
    )
);

CREATE INDEX mcp_comm_whatsapp_action_audit_chat_created_idx
  ON public.mcp_comm_whatsapp_action_audit (chat_id, created_at DESC);
CREATE INDEX mcp_comm_whatsapp_action_audit_actor_created_idx
  ON public.mcp_comm_whatsapp_action_audit (actor_id, created_at DESC);
ALTER TABLE public.mcp_comm_whatsapp_action_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mcp_comm_whatsapp_action_audit FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public._mcp_comm_whatsapp_assert_active_admin(
  p_actor_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $function$
BEGIN
  -- The service-role key is only the trusted transport. Each request must
  -- carry an actor that still passes the MCP OAuth admin check at call time.
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'MCP_SERVICE_ROLE_REQUIRED';
  END IF;

  PERFORM 1
  FROM public.user_profiles AS profile
  WHERE profile.id = p_actor_user_id
    AND profile.role = 'admin'
    AND NULLIF(btrim(profile.email), '') IS NOT NULL
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'MCP_ADMIN_REQUIRED';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public._mcp_comm_whatsapp_begin_action(
  p_actor_user_id uuid,
  p_client_request_id text,
  p_operation text,
  p_requested_chat_id uuid,
  p_signature jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, extensions
AS $function$
DECLARE
  v_fingerprint text;
  v_stored_fingerprint text;
  v_result jsonb;
  v_inserted integer;
BEGIN
  IF p_client_request_id IS NULL
     OR btrim(p_client_request_id) !~ '^[A-Za-z0-9:_-]{1,128}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_CLIENT_REQUEST_ID_REQUIRED';
  END IF;

  v_fingerprint := encode(
    extensions.digest(convert_to(p_signature::text, 'UTF8'), 'sha256'),
    'hex'
  );

  INSERT INTO public.mcp_comm_whatsapp_action_audit (
    actor_id, client_request_id, operation, requested_chat_id, request_fingerprint
  ) VALUES (
    p_actor_user_id, btrim(p_client_request_id), p_operation,
    p_requested_chat_id, v_fingerprint
  )
  ON CONFLICT (actor_id, client_request_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  SELECT audit.request_fingerprint, audit.result_payload
    INTO v_stored_fingerprint, v_result
  FROM public.mcp_comm_whatsapp_action_audit AS audit
  WHERE audit.actor_id = p_actor_user_id
    AND audit.client_request_id = btrim(p_client_request_id)
  FOR UPDATE;

  IF v_stored_fingerprint IS DISTINCT FROM v_fingerprint THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD';
  END IF;

  IF v_inserted = 0 THEN
    IF v_result IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'MCP_ACTION_REQUEST_INCOMPLETE';
    END IF;
    RETURN jsonb_build_object('replayed', true, 'result', v_result);
  END IF;

  RETURN jsonb_build_object('replayed', false, 'result', NULL::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public._mcp_comm_whatsapp_complete_action(
  p_actor_user_id uuid,
  p_client_request_id text,
  p_chat_id uuid,
  p_before_state jsonb,
  p_after_state jsonb,
  p_result jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  UPDATE public.mcp_comm_whatsapp_action_audit AS audit
  SET chat_id = p_chat_id,
      before_state = p_before_state,
      after_state = p_after_state,
      result_payload = p_result,
      completed_at = now()
  WHERE audit.actor_id = p_actor_user_id
    AND audit.client_request_id = btrim(p_client_request_id)
    AND audit.result_payload IS NULL;

  IF NOT FOUND AND NOT EXISTS (
    SELECT 1
    FROM public.mcp_comm_whatsapp_action_audit AS audit
    WHERE audit.actor_id = p_actor_user_id
      AND audit.client_request_id = btrim(p_client_request_id)
      AND audit.result_payload = p_result
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'MCP_ACTION_RESULT_NOT_STORED';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public._mcp_comm_whatsapp_chat_state(
  p_chat_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
  SELECT jsonb_build_object(
    'chat_id', chat.id,
    'updated_at', chat.updated_at,
    'status', chat.status,
    'is_archived', chat.is_archived,
    'archived_at', chat.archived_at,
    'is_muted', chat.is_muted,
    'muted_at', chat.muted_at,
    'is_pinned', chat.is_pinned,
    'pinned_at', chat.pinned_at,
    'manual_unread', chat.manual_unread,
    'manual_unread_at', chat.manual_unread_at,
    'unread_count', chat.unread_count,
    'last_read_at', chat.last_read_at,
    'lead_id', chat.lead_id,
    'lead_link_source', chat.lead_link_source,
    'lead_linked_at', chat.lead_linked_at
  )
  FROM public.comm_whatsapp_chats AS chat
  WHERE chat.id = p_chat_id;
$function$;

CREATE OR REPLACE FUNCTION public._mcp_comm_whatsapp_mutate_chat_flag(
  p_actor_user_id uuid,
  p_chat_id uuid,
  p_flag text,
  p_value boolean,
  p_expected_updated_at timestamptz,
  p_client_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, auth
AS $function$
DECLARE
  v_operation text;
  v_gate jsonb;
  v_chat_id uuid;
  v_chat public.comm_whatsapp_chats%ROWTYPE;
  v_before jsonb;
  v_after jsonb;
  v_result jsonb;
BEGIN
  PERFORM public._mcp_comm_whatsapp_assert_active_admin(p_actor_user_id);

  IF p_flag IS NULL OR p_flag NOT IN ('archived', 'muted', 'pinned', 'unread') OR p_value IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_INVALID_CHAT_STATE';
  END IF;
  IF p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_EXPECTED_UPDATED_AT_REQUIRED';
  END IF;

  v_operation := 'chat.' || p_flag || '.set';
  v_gate := public._mcp_comm_whatsapp_begin_action(
    p_actor_user_id,
    p_client_request_id,
    v_operation,
    p_chat_id,
    jsonb_build_object(
      'operation', v_operation,
      'chat_id', p_chat_id,
      'value', p_value,
      'expected_updated_at', p_expected_updated_at
    )
  );
  IF (v_gate ->> 'replayed')::boolean THEN
    RETURN (v_gate -> 'result') || jsonb_build_object('replayed', true);
  END IF;

  v_chat_id := public.comm_whatsapp_lock_canonical_chat_uuid(p_chat_id);
  IF v_chat_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'MCP_CHAT_NOT_FOUND';
  END IF;

  SELECT chat.*
    INTO v_chat
  FROM public.comm_whatsapp_chats AS chat
  WHERE chat.id = v_chat_id
    AND chat.deleted_at IS NULL
    AND chat.merged_into_chat_id IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'MCP_CHAT_NOT_FOUND';
  END IF;

  v_before := public._mcp_comm_whatsapp_chat_state(v_chat_id);
  IF v_chat.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    v_result := jsonb_build_object(
      'success', false,
      'operation', v_operation,
      'error', jsonb_build_object(
        'code', 'STALE_WRITE',
        'message', 'A conversa foi alterada desde a leitura; recarregue antes de tentar novamente.',
        'current_updated_at', v_chat.updated_at
      ),
      'chat', v_before,
      'replayed', false
    );
    PERFORM public._mcp_comm_whatsapp_complete_action(
      p_actor_user_id, p_client_request_id, v_chat_id, v_before, v_before, v_result
    );
    RETURN v_result;
  END IF;

  IF p_flag = 'archived' THEN
    UPDATE public.comm_whatsapp_chats AS chat
    SET is_archived = p_value,
        archived_at = CASE WHEN p_value THEN now() ELSE NULL END,
        updated_at = now()
    WHERE chat.id = v_chat_id
    RETURNING chat.* INTO v_chat;
  ELSIF p_flag = 'muted' THEN
    UPDATE public.comm_whatsapp_chats AS chat
    SET is_muted = p_value,
        muted_at = CASE
          WHEN p_value THEN COALESCE(chat.muted_at, now())
          ELSE NULL
        END,
        updated_at = now()
    WHERE chat.id = v_chat_id
    RETURNING chat.* INTO v_chat;
  ELSIF p_flag = 'pinned' THEN
    UPDATE public.comm_whatsapp_chats AS chat
    SET is_pinned = p_value,
        pinned_at = CASE
          WHEN p_value THEN COALESCE(chat.pinned_at, now())
          ELSE NULL
        END,
        updated_at = now()
    WHERE chat.id = v_chat_id
    RETURNING chat.* INTO v_chat;
  ELSE
    UPDATE public.comm_whatsapp_chats AS chat
    SET manual_unread = CASE
          WHEN p_value AND chat.unread_count = 0 THEN true
          WHEN p_value THEN false
          ELSE false
        END,
        manual_unread_at = CASE
          WHEN p_value AND chat.unread_count = 0 THEN COALESCE(chat.manual_unread_at, now())
          ELSE NULL
        END,
        last_read_at = CASE WHEN p_value THEN NULL ELSE now() END,
        unread_count = CASE WHEN p_value THEN chat.unread_count ELSE 0 END,
        updated_at = now()
    WHERE chat.id = v_chat_id
    RETURNING chat.* INTO v_chat;
  END IF;

  v_after := public._mcp_comm_whatsapp_chat_state(v_chat_id);
  v_result := jsonb_build_object(
    'success', true,
    'operation', v_operation,
    'value', p_value,
    'chat', v_after,
    'replayed', false
  );
  PERFORM public._mcp_comm_whatsapp_complete_action(
    p_actor_user_id, p_client_request_id, v_chat_id, v_before, v_after, v_result
  );
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public._mcp_comm_whatsapp_mark_chat_read(
  p_actor_user_id uuid,
  p_chat_id uuid,
  p_last_seen_message_at timestamptz,
  p_last_seen_message_id uuid,
  p_expected_updated_at timestamptz,
  p_client_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, auth
AS $function$
DECLARE
  v_gate jsonb;
  v_chat_id uuid;
  v_chat public.comm_whatsapp_chats%ROWTYPE;
  v_before jsonb;
  v_after jsonb;
  v_result jsonb;
  v_seen_at timestamptz;
  v_next_read_at timestamptz;
  v_unread_count integer;
BEGIN
  PERFORM public._mcp_comm_whatsapp_assert_active_admin(p_actor_user_id);
  IF p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_EXPECTED_UPDATED_AT_REQUIRED';
  END IF;
  IF p_last_seen_message_at > now() THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_INVALID_READ_CURSOR';
  END IF;

  v_gate := public._mcp_comm_whatsapp_begin_action(
    p_actor_user_id,
    p_client_request_id,
    'chat.read',
    p_chat_id,
    jsonb_build_object(
      'operation', 'chat.read',
      'chat_id', p_chat_id,
      'last_seen_message_at', p_last_seen_message_at,
      'last_seen_message_id', p_last_seen_message_id,
      'expected_updated_at', p_expected_updated_at
    )
  );
  IF (v_gate ->> 'replayed')::boolean THEN
    RETURN (v_gate -> 'result') || jsonb_build_object('replayed', true);
  END IF;

  v_chat_id := public.comm_whatsapp_lock_canonical_chat_uuid(p_chat_id);
  IF v_chat_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'MCP_CHAT_NOT_FOUND';
  END IF;

  SELECT chat.*
    INTO v_chat
  FROM public.comm_whatsapp_chats AS chat
  WHERE chat.id = v_chat_id
    AND chat.deleted_at IS NULL
    AND chat.merged_into_chat_id IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'MCP_CHAT_NOT_FOUND';
  END IF;

  v_before := public._mcp_comm_whatsapp_chat_state(v_chat_id);
  IF v_chat.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    v_result := jsonb_build_object(
      'success', false,
      'operation', 'chat.read',
      'error', jsonb_build_object(
        'code', 'STALE_WRITE',
        'message', 'A conversa foi alterada desde a leitura; recarregue antes de tentar novamente.',
        'current_updated_at', v_chat.updated_at
      ),
      'chat', v_before,
      'replayed', false
    );
    PERFORM public._mcp_comm_whatsapp_complete_action(
      p_actor_user_id, p_client_request_id, v_chat_id, v_before, v_before, v_result
    );
    RETURN v_result;
  END IF;

  IF p_last_seen_message_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.comm_whatsapp_messages AS message
    WHERE message.id = p_last_seen_message_id
      AND message.chat_id = v_chat_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_INVALID_READ_CURSOR';
  END IF;

  -- Match the existing Inbox contract: an explicit timestamp takes precedence
  -- when both cursor forms are supplied, then a message id, then latest visible.
  IF p_last_seen_message_at IS NOT NULL THEN
    v_seen_at := p_last_seen_message_at;
  ELSIF p_last_seen_message_id IS NOT NULL THEN
    SELECT message.message_at
      INTO v_seen_at
    FROM public.comm_whatsapp_messages AS message
    WHERE message.id = p_last_seen_message_id
      AND message.chat_id = v_chat_id;
  ELSE
    SELECT max(message.message_at)
      INTO v_seen_at
    FROM public.comm_whatsapp_messages AS message
    WHERE message.chat_id = v_chat_id
      AND public.comm_whatsapp_message_preview_text(
        message.media_caption,
        message.text_content,
        message.message_type
      ) IS NOT NULL;
  END IF;

  v_next_read_at := COALESCE(v_seen_at, now());

  UPDATE public.comm_whatsapp_chats AS chat
  SET last_read_at = GREATEST(COALESCE(chat.last_read_at, '-infinity'::timestamptz), v_next_read_at),
      manual_unread = false,
      manual_unread_at = NULL,
      updated_at = now()
  WHERE chat.id = v_chat_id
    AND chat.deleted_at IS NULL
    AND chat.merged_into_chat_id IS NULL;

  SELECT count(*)::integer
    INTO v_unread_count
  FROM public.comm_whatsapp_messages AS message
  WHERE message.chat_id = v_chat_id
    AND message.direction = 'inbound'
    AND message.message_at > v_next_read_at
    AND public.comm_whatsapp_message_preview_text(
      message.media_caption,
      message.text_content,
      message.message_type
    ) IS NOT NULL;

  UPDATE public.comm_whatsapp_chats AS chat
  SET unread_count = v_unread_count
  WHERE chat.id = v_chat_id;

  v_after := public._mcp_comm_whatsapp_chat_state(v_chat_id);
  v_result := jsonb_build_object(
    'success', true,
    'operation', 'chat.read',
    'chat', v_after,
    'replayed', false
  );
  PERFORM public._mcp_comm_whatsapp_complete_action(
    p_actor_user_id, p_client_request_id, v_chat_id, v_before, v_after, v_result
  );
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public._mcp_comm_whatsapp_mutate_chat_lead(
  p_actor_user_id uuid,
  p_chat_id uuid,
  p_lead_id uuid,
  p_link boolean,
  p_expected_updated_at timestamptz,
  p_client_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, auth
AS $function$
DECLARE
  v_operation text := CASE WHEN p_link THEN 'chat.lead.link' ELSE 'chat.lead.unlink' END;
  v_gate jsonb;
  v_chat_id uuid;
  v_chat public.comm_whatsapp_chats%ROWTYPE;
  v_before jsonb;
  v_after jsonb;
  v_result jsonb;
BEGIN
  PERFORM public._mcp_comm_whatsapp_assert_active_admin(p_actor_user_id);
  IF p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_EXPECTED_UPDATED_AT_REQUIRED';
  END IF;
  IF (p_link AND p_lead_id IS NULL) OR (NOT p_link AND p_lead_id IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_INVALID_LEAD_LINK_INPUT';
  END IF;

  v_gate := public._mcp_comm_whatsapp_begin_action(
    p_actor_user_id,
    p_client_request_id,
    v_operation,
    p_chat_id,
    jsonb_build_object(
      'operation', v_operation,
      'chat_id', p_chat_id,
      'lead_id', p_lead_id,
      'expected_updated_at', p_expected_updated_at
    )
  );
  IF (v_gate ->> 'replayed')::boolean THEN
    RETURN (v_gate -> 'result') || jsonb_build_object('replayed', true);
  END IF;

  v_chat_id := public.comm_whatsapp_lock_canonical_chat_uuid(p_chat_id);
  IF v_chat_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'MCP_CHAT_NOT_FOUND';
  END IF;

  SELECT chat.*
    INTO v_chat
  FROM public.comm_whatsapp_chats AS chat
  WHERE chat.id = v_chat_id
    AND chat.deleted_at IS NULL
    AND chat.merged_into_chat_id IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'MCP_CHAT_NOT_FOUND';
  END IF;

  v_before := public._mcp_comm_whatsapp_chat_state(v_chat_id);
  IF v_chat.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    v_result := jsonb_build_object(
      'success', false,
      'operation', v_operation,
      'error', jsonb_build_object(
        'code', 'STALE_WRITE',
        'message', 'A conversa foi alterada desde a leitura; recarregue antes de tentar novamente.',
        'current_updated_at', v_chat.updated_at
      ),
      'chat', v_before,
      'replayed', false
    );
    PERFORM public._mcp_comm_whatsapp_complete_action(
      p_actor_user_id, p_client_request_id, v_chat_id, v_before, v_before, v_result
    );
    RETURN v_result;
  END IF;

  IF p_link THEN
    PERFORM 1
    FROM public.leads AS lead
    WHERE lead.id = p_lead_id
    FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'MCP_LEAD_NOT_FOUND';
    END IF;

    UPDATE public.comm_whatsapp_chats AS chat
    SET lead_id = p_lead_id,
        lead_link_source = 'manual',
        lead_linked_at = now(),
        lead_linked_by = p_actor_user_id,
        auto_link_blocked = false,
        updated_at = now()
    WHERE chat.id = v_chat_id
      AND chat.deleted_at IS NULL
      AND chat.merged_into_chat_id IS NULL;

    UPDATE public.comm_whatsapp_identity_conflicts AS conflict
    SET status = 'resolved',
        resolved_at = now(),
        resolved_by = p_actor_user_id,
        updated_at = now()
    WHERE conflict.chat_id = v_chat_id
      AND conflict.status = 'open'
      AND conflict.conflict_type IN ('lead_ambiguous', 'lead_conflict');

    UPDATE public.comm_whatsapp_chats AS chat
    SET identity_conflict = EXISTS (
          SELECT 1
          FROM public.comm_whatsapp_identity_conflicts AS conflict
          WHERE conflict.chat_id = chat.id
            AND conflict.status = 'open'
        ),
        updated_at = now()
    WHERE chat.id = v_chat_id;
  ELSE
    UPDATE public.comm_whatsapp_chats AS chat
    SET lead_id = NULL,
        lead_link_source = NULL,
        lead_linked_at = NULL,
        lead_linked_by = NULL,
        auto_link_blocked = true,
        updated_at = now()
    WHERE chat.id = v_chat_id
      AND chat.deleted_at IS NULL
      AND chat.merged_into_chat_id IS NULL;
  END IF;

  PERFORM public.comm_whatsapp_refresh_chat_identity(v_chat_id);
  v_after := public._mcp_comm_whatsapp_chat_state(v_chat_id);
  v_result := jsonb_build_object(
    'success', true,
    'operation', v_operation,
    'chat', v_after,
    'replayed', false
  );
  PERFORM public._mcp_comm_whatsapp_complete_action(
    p_actor_user_id, p_client_request_id, v_chat_id, v_before, v_after, v_result
  );
  RETURN v_result;
END;
$function$;

-- Small public RPC surface: direction is explicit in the function name; all
-- callers must provide the actor, current row version, and idempotency key.
CREATE OR REPLACE FUNCTION public.mcp_comm_whatsapp_set_chat_archived(
  p_actor_user_id uuid,
  p_chat_id uuid,
  p_is_archived boolean,
  p_expected_updated_at timestamptz,
  p_client_request_id text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT public._mcp_comm_whatsapp_mutate_chat_flag(
    p_actor_user_id, p_chat_id, 'archived', p_is_archived,
    p_expected_updated_at, p_client_request_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.mcp_comm_whatsapp_set_chat_pinned(
  p_actor_user_id uuid,
  p_chat_id uuid,
  p_is_pinned boolean,
  p_expected_updated_at timestamptz,
  p_client_request_id text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT public._mcp_comm_whatsapp_mutate_chat_flag(
    p_actor_user_id, p_chat_id, 'pinned', p_is_pinned,
    p_expected_updated_at, p_client_request_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.mcp_comm_whatsapp_set_chat_muted(
  p_actor_user_id uuid,
  p_chat_id uuid,
  p_is_muted boolean,
  p_expected_updated_at timestamptz,
  p_client_request_id text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT public._mcp_comm_whatsapp_mutate_chat_flag(
    p_actor_user_id, p_chat_id, 'muted', p_is_muted,
    p_expected_updated_at, p_client_request_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.mcp_comm_whatsapp_set_chat_unread(
  p_actor_user_id uuid,
  p_chat_id uuid,
  p_is_unread boolean,
  p_expected_updated_at timestamptz,
  p_client_request_id text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT public._mcp_comm_whatsapp_mutate_chat_flag(
    p_actor_user_id, p_chat_id, 'unread', p_is_unread,
    p_expected_updated_at, p_client_request_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.mcp_comm_whatsapp_mark_chat_read(
  p_actor_user_id uuid,
  p_chat_id uuid,
  p_last_seen_message_at timestamptz,
  p_last_seen_message_id uuid,
  p_expected_updated_at timestamptz,
  p_client_request_id text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT public._mcp_comm_whatsapp_mark_chat_read(
    p_actor_user_id, p_chat_id, p_last_seen_message_at,
    p_last_seen_message_id, p_expected_updated_at, p_client_request_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.mcp_comm_whatsapp_link_chat_lead(
  p_actor_user_id uuid,
  p_chat_id uuid,
  p_lead_id uuid,
  p_expected_updated_at timestamptz,
  p_client_request_id text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT public._mcp_comm_whatsapp_mutate_chat_lead(
    p_actor_user_id, p_chat_id, p_lead_id, true,
    p_expected_updated_at, p_client_request_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.mcp_comm_whatsapp_unlink_chat_lead(
  p_actor_user_id uuid,
  p_chat_id uuid,
  p_expected_updated_at timestamptz,
  p_client_request_id text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT public._mcp_comm_whatsapp_mutate_chat_lead(
    p_actor_user_id, p_chat_id, NULL, false,
    p_expected_updated_at, p_client_request_id
  );
$function$;

-- Internal helpers are reachable only through their checked RPC wrappers.
REVOKE ALL ON FUNCTION public._mcp_comm_whatsapp_assert_active_admin(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._mcp_comm_whatsapp_begin_action(uuid, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._mcp_comm_whatsapp_complete_action(uuid, text, uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._mcp_comm_whatsapp_chat_state(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._mcp_comm_whatsapp_mutate_chat_flag(uuid, uuid, text, boolean, timestamptz, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._mcp_comm_whatsapp_mark_chat_read(uuid, uuid, timestamptz, uuid, timestamptz, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._mcp_comm_whatsapp_mutate_chat_lead(uuid, uuid, uuid, boolean, timestamptz, text) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.mcp_comm_whatsapp_set_chat_archived(uuid, uuid, boolean, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_comm_whatsapp_set_chat_pinned(uuid, uuid, boolean, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_comm_whatsapp_set_chat_muted(uuid, uuid, boolean, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_comm_whatsapp_set_chat_unread(uuid, uuid, boolean, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_comm_whatsapp_mark_chat_read(uuid, uuid, timestamptz, uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_comm_whatsapp_link_chat_lead(uuid, uuid, uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_comm_whatsapp_unlink_chat_lead(uuid, uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.mcp_comm_whatsapp_set_chat_archived(uuid, uuid, boolean, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_comm_whatsapp_set_chat_pinned(uuid, uuid, boolean, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_comm_whatsapp_set_chat_muted(uuid, uuid, boolean, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_comm_whatsapp_set_chat_unread(uuid, uuid, boolean, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_comm_whatsapp_mark_chat_read(uuid, uuid, timestamptz, uuid, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_comm_whatsapp_link_chat_lead(uuid, uuid, uuid, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_comm_whatsapp_unlink_chat_lead(uuid, uuid, timestamptz, text) TO service_role;

COMMENT ON TABLE public.mcp_comm_whatsapp_action_audit IS
  'MCP Inbox state-change audit and idempotency records; contains identifiers and state only, never message content or contact PII.';
COMMENT ON FUNCTION public.mcp_comm_whatsapp_set_chat_archived(uuid, uuid, boolean, timestamptz, text) IS
  'MCP-only archive/unarchive operation; requires a freshly verified active admin actor, expected_updated_at, and client_request_id.';
COMMENT ON FUNCTION public.mcp_comm_whatsapp_set_chat_pinned(uuid, uuid, boolean, timestamptz, text) IS
  'MCP-only pin/unpin operation; requires a freshly verified active admin actor, expected_updated_at, and client_request_id.';
COMMENT ON FUNCTION public.mcp_comm_whatsapp_set_chat_muted(uuid, uuid, boolean, timestamptz, text) IS
  'MCP-only mute/unmute operation; requires a freshly verified active admin actor, expected_updated_at, and client_request_id.';
COMMENT ON FUNCTION public.mcp_comm_whatsapp_set_chat_unread(uuid, uuid, boolean, timestamptz, text) IS
  'MCP-only manual read/unread operation with the existing Inbox unread-count semantics.';
COMMENT ON FUNCTION public.mcp_comm_whatsapp_mark_chat_read(uuid, uuid, timestamptz, uuid, timestamptz, text) IS
  'MCP-only mark-read operation; preserves the Inbox cursor and inbound unread-count calculation.';
COMMENT ON FUNCTION public.mcp_comm_whatsapp_link_chat_lead(uuid, uuid, uuid, timestamptz, text) IS
  'MCP-only manual chat-to-lead link; uses canonical chat locks and resolves only lead-ambiguity conflicts as the Inbox does.';
COMMENT ON FUNCTION public.mcp_comm_whatsapp_unlink_chat_lead(uuid, uuid, timestamptz, text) IS
  'MCP-only chat-to-lead unlink; preserves history and blocks future automatic relinking as the Inbox does.';

COMMIT;
