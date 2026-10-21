BEGIN;

ALTER TABLE public.mcp_comm_whatsapp_action_audit
  DROP CONSTRAINT IF EXISTS mcp_comm_whatsapp_action_audit_operation_check;

ALTER TABLE public.mcp_comm_whatsapp_action_audit
  ADD CONSTRAINT mcp_comm_whatsapp_action_audit_operation_check
  CHECK (operation IN (
    'chat.archived.set',
    'chat.muted.set',
    'chat.pinned.set',
    'chat.unread.set',
    'chat.read',
    'chat.lead.link',
    'chat.lead.unlink',
    'chat.deleted.set',
    'chat.autonomous_attendance.set'
  ));

CREATE OR REPLACE FUNCTION public.mcp_comm_whatsapp_set_chat_deleted(
  p_actor_user_id uuid,
  p_chat_id uuid,
  p_expected_updated_at timestamptz,
  p_client_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, auth
AS $function$
DECLARE
  v_operation constant text := 'chat.deleted.set';
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

  v_gate := public._mcp_comm_whatsapp_begin_action(
    p_actor_user_id,
    p_client_request_id,
    v_operation,
    p_chat_id,
    pg_catalog.jsonb_build_object('operation', v_operation, 'chat_id', p_chat_id, 'expected_updated_at', p_expected_updated_at)
  );
  IF (v_gate ->> 'replayed')::boolean THEN
    RETURN (v_gate -> 'result') || pg_catalog.jsonb_build_object('replayed', true);
  END IF;

  v_chat_id := public.comm_whatsapp_lock_canonical_chat_uuid(p_chat_id);
  IF v_chat_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'MCP_CHAT_NOT_FOUND';
  END IF;
  SELECT chat.* INTO v_chat
  FROM public.comm_whatsapp_chats AS chat
  WHERE chat.id = v_chat_id AND chat.deleted_at IS NULL AND chat.merged_into_chat_id IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'MCP_CHAT_NOT_FOUND';
  END IF;

  v_before := public._mcp_comm_whatsapp_chat_state(v_chat_id);
  IF v_chat.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    v_result := pg_catalog.jsonb_build_object(
      'success', false,
      'operation', v_operation,
      'error', pg_catalog.jsonb_build_object('code', 'STALE_WRITE', 'message', 'A conversa foi alterada desde a leitura; recarregue antes de tentar novamente.', 'current_updated_at', v_chat.updated_at),
      'chat', v_before,
      'replayed', false
    );
    PERFORM public._mcp_comm_whatsapp_complete_action(p_actor_user_id, p_client_request_id, v_chat_id, v_before, v_before, v_result);
    RETURN v_result;
  END IF;

  UPDATE public.comm_whatsapp_chats AS chat
  SET deleted_at = pg_catalog.transaction_timestamp(), updated_at = pg_catalog.transaction_timestamp()
  WHERE chat.id = v_chat_id AND chat.deleted_at IS NULL AND chat.merged_into_chat_id IS NULL
  RETURNING chat.* INTO v_chat;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'MCP_CHAT_NOT_FOUND';
  END IF;

  v_after := public._mcp_comm_whatsapp_chat_state(v_chat_id);
  v_result := pg_catalog.jsonb_build_object('success', true, 'operation', v_operation, 'deleted', true, 'chat', v_after, 'replayed', false);
  PERFORM public._mcp_comm_whatsapp_complete_action(p_actor_user_id, p_client_request_id, v_chat_id, v_before, v_after, v_result);
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mcp_comm_whatsapp_set_autonomous_attendance(
  p_actor_user_id uuid,
  p_chat_id uuid,
  p_status text,
  p_expected_updated_at timestamptz,
  p_client_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, auth
AS $function$
DECLARE
  v_operation constant text := 'chat.autonomous_attendance.set';
  v_gate jsonb;
  v_chat_id uuid;
  v_chat public.comm_whatsapp_chats%ROWTYPE;
  v_before jsonb;
  v_after jsonb;
  v_result jsonb;
BEGIN
  PERFORM public._mcp_comm_whatsapp_assert_active_admin(p_actor_user_id);
  IF p_status IS NULL OR p_status NOT IN ('active', 'inactive') OR p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_INVALID_AUTONOMOUS_ATTENDANCE_INPUT';
  END IF;

  v_gate := public._mcp_comm_whatsapp_begin_action(
    p_actor_user_id,
    p_client_request_id,
    v_operation,
    p_chat_id,
    pg_catalog.jsonb_build_object('operation', v_operation, 'chat_id', p_chat_id, 'status', p_status, 'expected_updated_at', p_expected_updated_at)
  );
  IF (v_gate ->> 'replayed')::boolean THEN
    RETURN (v_gate -> 'result') || pg_catalog.jsonb_build_object('replayed', true);
  END IF;

  v_chat_id := public.comm_whatsapp_lock_canonical_chat_uuid(p_chat_id);
  IF v_chat_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'MCP_CHAT_NOT_FOUND';
  END IF;
  SELECT chat.* INTO v_chat
  FROM public.comm_whatsapp_chats AS chat
  WHERE chat.id = v_chat_id AND chat.deleted_at IS NULL AND chat.merged_into_chat_id IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'MCP_CHAT_NOT_FOUND';
  END IF;

  v_before := public._mcp_comm_whatsapp_chat_state(v_chat_id);
  IF v_chat.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    v_result := pg_catalog.jsonb_build_object(
      'success', false,
      'operation', v_operation,
      'error', pg_catalog.jsonb_build_object('code', 'STALE_WRITE', 'message', 'A conversa foi alterada desde a leitura; recarregue antes de tentar novamente.', 'current_updated_at', v_chat.updated_at),
      'chat', v_before,
      'replayed', false
    );
    PERFORM public._mcp_comm_whatsapp_complete_action(p_actor_user_id, p_client_request_id, v_chat_id, v_before, v_before, v_result);
    RETURN v_result;
  END IF;

  IF p_status = 'active' THEN
    IF v_chat.lead_id IS NULL OR public.ai_lead_is_waiting_for_quote(v_chat.lead_id) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_AUTONOMOUS_ATTENDANCE_NOT_QUALIFIED';
    END IF;

    UPDATE public.comm_whatsapp_chats AS chat
    SET autonomous_attendance_status = 'active', updated_at = pg_catalog.transaction_timestamp()
    WHERE chat.id = v_chat_id AND chat.deleted_at IS NULL AND chat.merged_into_chat_id IS NULL
    RETURNING chat.* INTO v_chat;
    INSERT INTO public.ai_autonomous_reply_jobs (chat_id, lead_id, scheduled_at)
    VALUES (v_chat_id, v_chat.lead_id, pg_catalog.transaction_timestamp() + interval '30 seconds')
    ON CONFLICT (chat_id) WHERE status = 'pending'
    DO UPDATE SET lead_id = EXCLUDED.lead_id, scheduled_at = EXCLUDED.scheduled_at, last_error = NULL, updated_at = pg_catalog.transaction_timestamp();
  ELSE
    UPDATE public.ai_autonomous_reply_jobs AS jobs
    SET status = 'cancelled', last_error = 'Atendimento assumido manualmente pelo humano', updated_at = pg_catalog.transaction_timestamp()
    WHERE jobs.chat_id = v_chat_id AND jobs.status IN ('pending', 'processing');
    UPDATE public.comm_whatsapp_chats AS chat
    SET autonomous_attendance_status = 'inactive', updated_at = pg_catalog.transaction_timestamp()
    WHERE chat.id = v_chat_id AND chat.deleted_at IS NULL AND chat.merged_into_chat_id IS NULL
    RETURNING chat.* INTO v_chat;
  END IF;

  v_after := public._mcp_comm_whatsapp_chat_state(v_chat_id);
  v_result := pg_catalog.jsonb_build_object('success', true, 'operation', v_operation, 'status', p_status, 'chat', v_after, 'replayed', false);
  PERFORM public._mcp_comm_whatsapp_complete_action(p_actor_user_id, p_client_request_id, v_chat_id, v_before, v_after, v_result);
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.mcp_comm_whatsapp_set_chat_deleted(uuid, uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_comm_whatsapp_set_autonomous_attendance(uuid, uuid, text, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_comm_whatsapp_set_chat_deleted(uuid, uuid, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_comm_whatsapp_set_autonomous_attendance(uuid, uuid, text, timestamptz, text) TO service_role;

COMMENT ON FUNCTION public.mcp_comm_whatsapp_set_chat_deleted(uuid, uuid, timestamptz, text) IS
  'MCP-only soft delete from the Inbox; preserves all messages and applies optimistic concurrency and idempotent audit.';
COMMENT ON FUNCTION public.mcp_comm_whatsapp_set_autonomous_attendance(uuid, uuid, text, timestamptz, text) IS
  'MCP-only autonomous attendance toggle; repeats existing lead qualification rules and records an idempotent actor audit.';

COMMIT;
