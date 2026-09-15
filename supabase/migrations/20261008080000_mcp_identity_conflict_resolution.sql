BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- This request log contains only identifiers, a keyed operation fingerprint,
-- and the bounded result payload required for idempotent retries.
CREATE TABLE public.mcp_whatsapp_identity_resolution_requests (
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  client_request_id text NOT NULL,
  request_fingerprint text NOT NULL,
  result_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY (actor_id, client_request_id),
  CONSTRAINT mcp_whatsapp_identity_resolution_request_id_check
    CHECK (client_request_id ~ '^[A-Za-z0-9:_-]{1,128}$'),
  CONSTRAINT mcp_whatsapp_identity_resolution_fingerprint_check
    CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT mcp_whatsapp_identity_resolution_result_object_check
    CHECK (result_payload IS NULL OR jsonb_typeof(result_payload) = 'object')
);

ALTER TABLE public.mcp_whatsapp_identity_resolution_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mcp_whatsapp_identity_resolution_requests FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mcp_resolve_whatsapp_identity_conflict(
  p_actor_user_id uuid,
  p_conflict_id uuid,
  p_lead_id uuid,
  p_expected_conflict_updated_at timestamptz,
  p_expected_chat_updated_at timestamptz,
  p_client_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions, auth
AS $function$
DECLARE
  v_conflict public.comm_whatsapp_identity_conflicts%ROWTYPE;
  v_requested_chat_id uuid;
  v_chat_id uuid;
  v_chat public.comm_whatsapp_chats%ROWTYPE;
  v_gate_fingerprint text;
  v_stored_fingerprint text;
  v_stored_result jsonb;
  v_inserted integer;
  v_before jsonb;
  v_after jsonb;
  v_result jsonb;
  v_is_candidate boolean := false;
  v_mutated_at timestamptz;
BEGIN
  PERFORM public._mcp_comm_whatsapp_assert_active_admin(p_actor_user_id);

  IF p_conflict_id IS NULL OR p_lead_id IS NULL
     OR p_expected_conflict_updated_at IS NULL OR p_expected_chat_updated_at IS NULL
     OR p_client_request_id IS NULL
     OR btrim(p_client_request_id) !~ '^[A-Za-z0-9:_-]{1,128}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_IDENTITY_RESOLUTION_INPUT_REQUIRED';
  END IF;

  SELECT conflict.chat_id
    INTO v_requested_chat_id
  FROM public.comm_whatsapp_identity_conflicts AS conflict
  WHERE conflict.id = p_conflict_id;
  IF NOT FOUND OR v_requested_chat_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'MCP_IDENTITY_CONFLICT_NOT_FOUND';
  END IF;

  v_gate_fingerprint := encode(
    extensions.digest(convert_to(jsonb_build_object(
      'conflict_id', p_conflict_id,
      'lead_id', p_lead_id,
      'expected_conflict_updated_at', p_expected_conflict_updated_at,
      'expected_chat_updated_at', p_expected_chat_updated_at
    )::text, 'UTF8'), 'sha256'),
    'hex'
  );

  INSERT INTO public.mcp_whatsapp_identity_resolution_requests (
    actor_id, client_request_id, request_fingerprint
  ) VALUES (p_actor_user_id, btrim(p_client_request_id), v_gate_fingerprint)
  ON CONFLICT (actor_id, client_request_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  SELECT request.request_fingerprint, request.result_payload
    INTO v_stored_fingerprint, v_stored_result
  FROM public.mcp_whatsapp_identity_resolution_requests AS request
  WHERE request.actor_id = p_actor_user_id
    AND request.client_request_id = btrim(p_client_request_id)
  FOR UPDATE;

  IF v_stored_fingerprint IS DISTINCT FROM v_gate_fingerprint THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD';
  END IF;
  IF v_inserted = 0 THEN
    IF v_stored_result IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'MCP_IDENTITY_RESOLUTION_INCOMPLETE';
    END IF;
    RETURN v_stored_result || jsonb_build_object('replayed', true);
  END IF;

  v_chat_id := public.comm_whatsapp_lock_canonical_chat_uuid(v_requested_chat_id);
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

  SELECT conflict.*
    INTO v_conflict
  FROM public.comm_whatsapp_identity_conflicts AS conflict
  WHERE conflict.id = p_conflict_id
  FOR UPDATE SKIP LOCKED;
  IF NOT FOUND OR v_conflict.status <> 'open'
     OR public.comm_whatsapp_lock_canonical_chat_uuid(v_conflict.chat_id) IS DISTINCT FROM v_chat_id THEN
    v_result := jsonb_build_object(
      'success', false,
      'status', 'requires_review',
      'reason', 'conflict_changed_or_chat_identity_no_longer_matches',
      'replayed', false
    );
  ELSIF v_conflict.updated_at IS DISTINCT FROM p_expected_conflict_updated_at
     OR v_chat.updated_at IS DISTINCT FROM p_expected_chat_updated_at THEN
    v_before := public._mcp_comm_whatsapp_chat_state(v_chat_id);
    v_result := jsonb_build_object(
      'success', false,
      'error_code', 'STALE_WRITE',
      'status', 'stale',
      'current_conflict_updated_at', v_conflict.updated_at,
      'current_chat_updated_at', v_chat.updated_at,
      'chat', v_before,
      'replayed', false
    );
  ELSIF v_conflict.conflict_type NOT IN ('lead_ambiguous', 'lead_conflict') THEN
    v_result := jsonb_build_object(
      'success', false,
      'status', 'requires_review',
      'reason', 'identity_evidence_requires_server_revalidation',
      'replayed', false
    );
  ELSE
    IF v_conflict.conflict_type = 'lead_ambiguous'
       AND jsonb_typeof(v_conflict.details -> 'candidate_lead_ids') = 'array' THEN
      SELECT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(v_conflict.details -> 'candidate_lead_ids') AS candidate(value)
        WHERE candidate.value = p_lead_id::text
      ) INTO v_is_candidate;
    ELSIF v_conflict.conflict_type = 'lead_conflict' THEN
      v_is_candidate := p_lead_id::text IN (
        COALESCE(v_conflict.details ->> 'winner_previous_lead_id', ''),
        COALESCE(v_conflict.details ->> 'loser_previous_lead_id', '')
      );
    END IF;

    IF NOT v_is_candidate THEN
      v_result := jsonb_build_object(
        'success', false,
        'status', 'requires_review',
        'reason', 'selected_lead_is_not_in_persisted_candidates',
        'replayed', false
      );
    ELSE
      PERFORM 1
      FROM public.leads AS lead
      WHERE lead.id = p_lead_id
        AND COALESCE(lead.arquivado, false) = false
      FOR KEY SHARE;
      IF NOT FOUND THEN
        v_result := jsonb_build_object(
          'success', false,
          'status', 'requires_review',
          'reason', 'candidate_lead_is_not_active',
          'replayed', false
        );
      ELSE
        v_mutated_at := GREATEST(
          clock_timestamp(),
          v_conflict.updated_at + interval '1 microsecond',
          v_chat.updated_at + interval '1 microsecond'
        );
        v_before := public._mcp_comm_whatsapp_chat_state(v_chat_id);
        UPDATE public.comm_whatsapp_chats AS chat
        SET lead_id = p_lead_id,
            lead_link_source = 'manual',
            lead_linked_at = now(),
            lead_linked_by = p_actor_user_id,
            auto_link_blocked = false,
            updated_at = v_mutated_at
        WHERE chat.id = v_chat_id;

        UPDATE public.comm_whatsapp_identity_conflicts AS conflict
        SET status = 'resolved',
            resolved_at = now(),
            resolved_by = p_actor_user_id,
            updated_at = v_mutated_at,
            details = conflict.details || jsonb_build_object(
              'resolution', jsonb_build_object(
                'method', 'explicit_persisted_candidate_selection',
                'lead_id', p_lead_id,
                'actor_user_id', p_actor_user_id
              )
            )
        WHERE conflict.id = p_conflict_id;

        UPDATE public.comm_whatsapp_chats AS chat
        SET identity_conflict = EXISTS (
              SELECT 1
              FROM public.comm_whatsapp_identity_conflicts AS conflict
              WHERE conflict.chat_id = chat.id
                AND conflict.status = 'open'
            ),
            updated_at = v_mutated_at
        WHERE chat.id = v_chat_id;
        PERFORM public.comm_whatsapp_refresh_chat_identity(v_chat_id);

        v_after := public._mcp_comm_whatsapp_chat_state(v_chat_id);
        v_result := jsonb_build_object(
          'success', true,
          'status', 'resolved',
          'conflict_id', p_conflict_id,
          'selected_lead_id', p_lead_id,
          'chat', v_after,
          'replayed', false
        );
      END IF;
    END IF;
  END IF;

  UPDATE public.mcp_whatsapp_identity_resolution_requests AS request
  SET result_payload = v_result,
      completed_at = now()
  WHERE request.actor_id = p_actor_user_id
    AND request.client_request_id = btrim(p_client_request_id);

  RETURN v_result;
END;
$function$;

-- Keep the ordinary link tool from clearing unresolved identity conflicts in
-- bulk. Explicit candidate selection must go through the resolution RPC above.
CREATE OR REPLACE FUNCTION public.mcp_comm_whatsapp_link_chat_lead(
  p_actor_user_id uuid,
  p_chat_id uuid,
  p_lead_id uuid,
  p_expected_updated_at timestamptz,
  p_client_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $function$
DECLARE
  v_existing_request boolean;
  v_chat_id uuid;
  v_locked_chat_id uuid;
BEGIN
  PERFORM public._mcp_comm_whatsapp_assert_active_admin(p_actor_user_id);
  SELECT EXISTS (
    SELECT 1 FROM public.mcp_comm_whatsapp_action_audit AS audit
    WHERE audit.actor_id = p_actor_user_id
      AND audit.client_request_id = btrim(COALESCE(p_client_request_id, ''))
  ) INTO v_existing_request;

  IF NOT v_existing_request THEN
    v_chat_id := public.comm_whatsapp_lock_canonical_chat_uuid(p_chat_id);
    IF v_chat_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'MCP_CHAT_NOT_FOUND';
    END IF;

    SELECT chat.id INTO v_locked_chat_id
    FROM public.comm_whatsapp_chats AS chat
    WHERE chat.id = v_chat_id
      AND chat.deleted_at IS NULL
      AND chat.merged_into_chat_id IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'MCP_CHAT_NOT_FOUND';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.comm_whatsapp_identity_conflicts AS conflict
      WHERE conflict.chat_id = v_chat_id
        AND conflict.status = 'open'
        AND conflict.conflict_type IN ('lead_ambiguous', 'lead_conflict')
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'MCP_IDENTITY_CONFLICT_RESOLUTION_REQUIRED';
    END IF;
  END IF;

  RETURN public._mcp_comm_whatsapp_mutate_chat_lead(
    p_actor_user_id, p_chat_id, p_lead_id, true,
    p_expected_updated_at, p_client_request_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.mcp_resolve_whatsapp_identity_conflict(uuid, uuid, uuid, timestamptz, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_resolve_whatsapp_identity_conflict(uuid, uuid, uuid, timestamptz, timestamptz, text) TO service_role;
REVOKE ALL ON FUNCTION public.mcp_comm_whatsapp_link_chat_lead(uuid, uuid, uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_comm_whatsapp_link_chat_lead(uuid, uuid, uuid, timestamptz, text) TO service_role;

COMMENT ON FUNCTION public.mcp_resolve_whatsapp_identity_conflict(uuid, uuid, uuid, timestamptz, timestamptz, text) IS
  'Resolves only persisted lead ambiguity/conflict by explicit selection from stored candidates. Identity and reverse-mapping conflicts require server-side provider revalidation and return requires_review.';

COMMIT;
