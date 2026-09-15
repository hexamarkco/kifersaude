BEGIN;

ALTER TABLE public.mcp_contract_document_audit_log
  DROP CONSTRAINT mcp_contract_document_audit_log_action_check;
ALTER TABLE public.mcp_contract_document_audit_log
  ADD CONSTRAINT mcp_contract_document_audit_log_action_check
    CHECK (action IN ('created', 'updated', 'deleted', 'cleanup_completed', 'listed', 'accessed'));

CREATE OR REPLACE FUNCTION public._mcp_log_contract_document_read(
  p_actor_user_id uuid,
  p_document jsonb,
  p_action text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_document_id uuid;
  v_entity_type text;
  v_entity_id uuid;
BEGIN
  IF p_action NOT IN ('listed', 'accessed') OR jsonb_typeof(p_document) <> 'object' THEN
    RAISE EXCEPTION 'MCP_DOCUMENT_AUDIT_INPUT_INVALID' USING ERRCODE = '22023';
  END IF;

  v_document_id := NULLIF(p_document->>'id', '')::uuid;
  v_entity_type := p_document->>'entity_type';
  v_entity_id := NULLIF(p_document->>'entity_id', '')::uuid;
  IF v_entity_type NOT IN ('lead', 'contract', 'contract_holder', 'dependent') OR v_entity_id IS NULL
     OR (p_action = 'accessed' AND v_document_id IS NULL) THEN
    RAISE EXCEPTION 'MCP_DOCUMENT_AUDIT_INPUT_INVALID' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.mcp_contract_document_audit_log (
    document_id, entity_type, entity_id, actor_id, action, changed_fields, client_request_id
  ) VALUES (
    v_document_id, v_entity_type, v_entity_id, p_actor_user_id, p_action, ARRAY[]::text[],
    'document-read:' || pg_catalog.gen_random_uuid()::text
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.mcp_contract_documents_list(
  p_actor_user_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_limit integer DEFAULT 50,
  p_before_created_at timestamptz DEFAULT NULL,
  p_before_document_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_documents jsonb;
  v_document jsonb;
  v_next_cursor jsonb;
  v_has_more boolean;
  v_cursor_created_at timestamptz;
  v_cursor_document_id uuid;
BEGIN
  PERFORM public._mcp_assert_active_contract_admin(p_actor_user_id);
  IF (p_before_created_at IS NULL) <> (p_before_document_id IS NULL) THEN
    RAISE EXCEPTION 'MCP_DOCUMENT_CURSOR_INVALID' USING ERRCODE = '22023';
  END IF;
  PERFORM public._mcp_contract_document_assert_entity(p_entity_type, p_entity_id);

  WITH all_documents AS (
    SELECT
      document.id,
      document.created_at,
      jsonb_build_object(
        'id', document.id, 'entity_type', document.entity_type, 'entity_id', document.entity_id,
        'storage_bucket_id', document.storage_bucket_id, 'storage_object_path', document.storage_object_path,
        'tipo_documento', document.tipo_documento, 'nome_arquivo', document.nome_arquivo,
        'mime_type', document.mime_type, 'tamanho_bytes', document.tamanho_bytes,
        'sha256_hex', document.sha256_hex, 'created_at', document.created_at,
        'updated_at', document.updated_at, 'deleted_at', NULL, 'is_legacy', false, 'legacy_url', NULL
      ) AS document_json
    FROM public.private_contract_documents AS document
    WHERE document.entity_type = p_entity_type
      AND document.entity_id = p_entity_id
      AND document.deleted_at IS NULL

    UNION ALL

    SELECT
      legacy.id,
      legacy.created_at,
      jsonb_build_object(
        'id', legacy.id,
        'entity_type', CASE
          WHEN p_entity_type = 'contract_holder' AND legacy.entity_type = 'holder'
            THEN 'contract_holder'
          ELSE legacy.entity_type
        END,
        'entity_id', legacy.entity_id, 'storage_bucket_id', NULL, 'storage_object_path', NULL,
        'tipo_documento', legacy.tipo_documento, 'nome_arquivo', legacy.nome_arquivo,
        'mime_type', NULL, 'tamanho_bytes', legacy.tamanho_bytes, 'sha256_hex', NULL,
        'created_at', legacy.created_at, 'updated_at', NULL, 'deleted_at', NULL,
        'is_legacy', true, 'legacy_url', legacy.url_arquivo
      ) AS document_json
    FROM public.documents AS legacy
    WHERE legacy.entity_id = p_entity_id
      AND (
        legacy.entity_type = p_entity_type
        OR (p_entity_type = 'contract_holder' AND legacy.entity_type = 'holder')
      )
  ), filtered_documents AS (
    SELECT all_documents.id, all_documents.created_at, all_documents.document_json
    FROM all_documents
    WHERE p_before_created_at IS NULL
       OR (all_documents.created_at, all_documents.id) < (p_before_created_at, p_before_document_id)
  ), ranked_documents AS (
    SELECT
      filtered_documents.id,
      filtered_documents.created_at,
      filtered_documents.document_json,
      row_number() OVER (ORDER BY filtered_documents.created_at DESC, filtered_documents.id DESC) AS ordinal
    FROM filtered_documents
  )
  SELECT
    COALESCE(
      jsonb_agg(ranked.document_json ORDER BY ranked.created_at DESC, ranked.id DESC)
        FILTER (WHERE ranked.ordinal <= v_limit),
      '[]'::jsonb
    ),
    (count(*) > v_limit),
    max(ranked.created_at) FILTER (WHERE ranked.ordinal = v_limit),
    (array_agg(ranked.id ORDER BY ranked.created_at ASC, ranked.id ASC)
      FILTER (WHERE ranked.ordinal = v_limit))[1]
  INTO v_documents, v_has_more, v_cursor_created_at, v_cursor_document_id
  FROM ranked_documents AS ranked
  WHERE ranked.ordinal <= v_limit + 1;

  IF jsonb_array_length(v_documents) = 0 THEN
    PERFORM public._mcp_log_contract_document_read(
      p_actor_user_id,
      jsonb_build_object('entity_type', p_entity_type, 'entity_id', p_entity_id),
      'listed'
    );
  ELSE
    FOR v_document IN SELECT item.value FROM jsonb_array_elements(v_documents) AS item(value) LOOP
      PERFORM public._mcp_log_contract_document_read(p_actor_user_id, v_document, 'listed');
    END LOOP;
  END IF;

  IF v_has_more THEN
    v_next_cursor := jsonb_build_object('created_at', v_cursor_created_at, 'document_id', v_cursor_document_id);
  ELSE
    v_next_cursor := NULL;
  END IF;

  RETURN jsonb_build_object('documents', v_documents, 'next_cursor', v_next_cursor, 'has_more', v_has_more);
END;
$function$;

CREATE OR REPLACE FUNCTION public.mcp_contract_document_get(
  p_actor_user_id uuid,
  p_document_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_document jsonb;
BEGIN
  PERFORM public._mcp_assert_active_contract_admin(p_actor_user_id);
  v_document := public._mcp_contract_document_snapshot(p_document_id, false);
  IF v_document IS NULL THEN
    SELECT jsonb_build_object(
      'id', legacy.id, 'entity_type', legacy.entity_type, 'entity_id', legacy.entity_id,
      'storage_bucket_id', NULL, 'storage_object_path', NULL,
      'tipo_documento', legacy.tipo_documento, 'nome_arquivo', legacy.nome_arquivo,
      'mime_type', NULL, 'tamanho_bytes', legacy.tamanho_bytes, 'sha256_hex', NULL,
      'created_at', legacy.created_at, 'updated_at', NULL, 'deleted_at', NULL,
      'is_legacy', true, 'legacy_url', legacy.url_arquivo
    )
    INTO v_document
    FROM public.documents AS legacy
    WHERE legacy.id = p_document_id;
  END IF;

  IF v_document IS NULL THEN
    RAISE EXCEPTION 'MCP_DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public._mcp_log_contract_document_read(p_actor_user_id, v_document, 'accessed');
  RETURN v_document;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mcp_remove_contract_dependent(
  p_actor_user_id uuid,
  p_dependent_id uuid,
  p_expected_updated_at timestamptz,
  p_client_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $function$
DECLARE
  v_request jsonb;
  v_dependent public.dependents;
  v_result jsonb;
BEGIN
  PERFORM public._mcp_assert_active_contract_admin(p_actor_user_id);
  IF p_dependent_id IS NULL OR p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'MCP_EXPECTED_UPDATED_AT_REQUIRED' USING ERRCODE = '22023';
  END IF;
  v_request := public._mcp_begin_contract_write_request(
    p_actor_user_id, 'dependent.remove', p_client_request_id,
    jsonb_build_object('dependent_id', p_dependent_id, 'expected_updated_at', p_expected_updated_at)
  );
  IF (v_request->>'replayed')::boolean THEN
    RETURN (v_request->'result') || jsonb_build_object('replayed', true);
  END IF;

  SELECT * INTO v_dependent FROM public.dependents AS dependent
   WHERE dependent.id = p_dependent_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MCP_DEPENDENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_dependent.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'MCP_CONCURRENT_UPDATE' USING ERRCODE = '40001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.private_contract_documents AS document
     WHERE document.entity_type = 'dependent'
       AND document.entity_id = v_dependent.id
       AND (document.deleted_at IS NULL OR document.storage_cleanup_completed_at IS NULL)
  ) THEN
    RAISE EXCEPTION 'MCP_DEPENDENT_HAS_DOCUMENT_HISTORY' USING ERRCODE = '23503';
  END IF;

  DELETE FROM public.dependents WHERE id = v_dependent.id;
  v_result := jsonb_build_object('dependent_id', v_dependent.id, 'contract_id', v_dependent.contract_id,
    'holder_id', v_dependent.holder_id, 'removed', true, 'replayed', false);
  PERFORM public._mcp_complete_contract_write_request(p_actor_user_id, 'dependent.remove', p_client_request_id, v_result - 'replayed');
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mcp_remove_contract_holder(
  p_actor_user_id uuid,
  p_holder_id uuid,
  p_expected_updated_at timestamptz,
  p_client_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $function$
DECLARE
  v_request jsonb;
  v_holder public.contract_holders;
  v_result jsonb;
BEGIN
  PERFORM public._mcp_assert_active_contract_admin(p_actor_user_id);
  IF p_holder_id IS NULL OR p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'MCP_EXPECTED_UPDATED_AT_REQUIRED' USING ERRCODE = '22023';
  END IF;
  v_request := public._mcp_begin_contract_write_request(
    p_actor_user_id, 'holder.remove', p_client_request_id,
    jsonb_build_object('holder_id', p_holder_id, 'expected_updated_at', p_expected_updated_at)
  );
  IF (v_request->>'replayed')::boolean THEN
    RETURN (v_request->'result') || jsonb_build_object('replayed', true);
  END IF;

  SELECT * INTO v_holder FROM public.contract_holders AS holder
   WHERE holder.id = p_holder_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MCP_HOLDER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_holder.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'MCP_CONCURRENT_UPDATE' USING ERRCODE = '40001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.dependents AS dependent WHERE dependent.holder_id = v_holder.id)
     OR EXISTS (
       SELECT 1 FROM public.private_contract_documents AS document
        WHERE document.entity_type = 'contract_holder'
          AND document.entity_id = v_holder.id
          AND (document.deleted_at IS NULL OR document.storage_cleanup_completed_at IS NULL)
     ) THEN
    RAISE EXCEPTION 'MCP_HOLDER_HAS_DEPENDENTS_OR_DOCUMENT_HISTORY' USING ERRCODE = '23503';
  END IF;

  DELETE FROM public.contract_holders WHERE id = v_holder.id;
  v_result := jsonb_build_object('holder_id', v_holder.id, 'contract_id', v_holder.contract_id, 'removed', true, 'replayed', false);
  PERFORM public._mcp_complete_contract_write_request(p_actor_user_id, 'holder.remove', p_client_request_id, v_result - 'replayed');
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public._mcp_log_contract_document_read(uuid, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_contract_documents_list(uuid, text, uuid, integer, timestamptz, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_contract_document_get(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_remove_contract_dependent(uuid, uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_remove_contract_holder(uuid, uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_contract_documents_list(uuid, text, uuid, integer, timestamptz, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_contract_document_get(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_remove_contract_dependent(uuid, uuid, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_remove_contract_holder(uuid, uuid, timestamptz, text) TO service_role;

COMMENT ON FUNCTION public.mcp_contract_documents_list(uuid, text, uuid, integer, timestamptz, uuid) IS
  'MCP-only active-admin document listing; writes one access audit record per returned document (or an empty-list record) without storing file content or URLs.';
COMMENT ON FUNCTION public.mcp_contract_document_get(uuid, uuid) IS
  'MCP-only active-admin document lookup; audits access before Edge Function signs a private object URL.';
COMMENT ON FUNCTION public.mcp_remove_contract_holder(uuid, uuid, timestamptz, text) IS
  'Removes a holder only when no dependents or active/uncleaned private document metadata references it; preserves audit and requires optimistic concurrency.';
COMMENT ON FUNCTION public.mcp_remove_contract_dependent(uuid, uuid, timestamptz, text) IS
  'Removes a dependent only when no active/uncleaned private document metadata references it; preserves audit and requires optimistic concurrency.';

COMMIT;
