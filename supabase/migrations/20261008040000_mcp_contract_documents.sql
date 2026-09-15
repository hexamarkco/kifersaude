BEGIN;

-- Private contract files are intentionally kept separate from public.documents.
-- The latter has legacy URL semantics and is rendered directly by the existing
-- CRM. Keeping the new object metadata here preserves every legacy row/URL and
-- prevents the old UI from treating a private Storage object as a public link.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contract-documents-private',
  'contract-documents-private',
  false,
  20971520,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- No permissive Storage policies are created. This restrictive policy keeps the
-- bucket inaccessible to browser roles even if a broader permissive policy is
-- added later for another bucket. service_role uses the trusted MCP Edge path.
DROP POLICY IF EXISTS "Deny client access to private contract documents" ON storage.objects;
CREATE POLICY "Deny client access to private contract documents"
  ON storage.objects AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (bucket_id <> 'contract-documents-private')
  WITH CHECK (bucket_id <> 'contract-documents-private');

CREATE TABLE public.private_contract_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (
    entity_type IN ('lead', 'contract', 'contract_holder', 'dependent')
  ),
  entity_id uuid NOT NULL,
  storage_bucket_id text NOT NULL DEFAULT 'contract-documents-private'
    CHECK (storage_bucket_id = 'contract-documents-private'),
  storage_object_path text NOT NULL,
  tipo_documento text NOT NULL,
  nome_arquivo text NOT NULL,
  mime_type text NOT NULL CHECK (
    mime_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
  ),
  tamanho_bytes bigint NOT NULL CHECK (tamanho_bytes BETWEEN 1 AND 20971520),
  sha256_hex text NOT NULL CHECK (sha256_hex ~ '^[0-9a-f]{64}$'),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  storage_cleanup_completed_at timestamptz,
  CONSTRAINT private_contract_documents_file_type_length
    CHECK (char_length(btrim(tipo_documento)) BETWEEN 1 AND 80),
  CONSTRAINT private_contract_documents_file_name_length
    CHECK (char_length(btrim(nome_arquivo)) BETWEEN 1 AND 255),
  CONSTRAINT private_contract_documents_file_name_no_controls
    CHECK (nome_arquivo !~ '[[:cntrl:]]'),
  CONSTRAINT private_contract_documents_path_bound_to_entity
    CHECK (
      storage_object_path ~ '^(lead|contract|contract_holder|dependent)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|jpeg|png|webp)$'
      AND split_part(storage_object_path, '/', 1) = entity_type
      AND split_part(storage_object_path, '/', 2) = entity_id::text
    ),
  CONSTRAINT private_contract_documents_deleted_timestamp
    CHECK (deleted_at IS NULL OR deleted_at >= created_at),
  CONSTRAINT private_contract_documents_cleanup_after_delete
    CHECK (storage_cleanup_completed_at IS NULL OR deleted_at IS NOT NULL)
);

CREATE UNIQUE INDEX private_contract_documents_object_path_idx
  ON public.private_contract_documents (storage_bucket_id, storage_object_path);
CREATE INDEX private_contract_documents_entity_active_idx
  ON public.private_contract_documents (entity_type, entity_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.private_contract_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.private_contract_documents FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.mcp_contract_document_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid,
  entity_type text NOT NULL CHECK (
    entity_type IN ('lead', 'contract', 'contract_holder', 'dependent')
  ),
  entity_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('created', 'updated', 'deleted', 'cleanup_completed')),
  changed_fields text[] NOT NULL DEFAULT ARRAY[]::text[],
  client_request_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mcp_contract_document_audit_request_id_length
    CHECK (client_request_id ~ '^[A-Za-z0-9:_-]{1,128}$')
);

CREATE INDEX mcp_contract_document_audit_document_created_idx
  ON public.mcp_contract_document_audit_log (document_id, created_at DESC);
CREATE INDEX mcp_contract_document_audit_actor_created_idx
  ON public.mcp_contract_document_audit_log (actor_id, created_at DESC);
ALTER TABLE public.mcp_contract_document_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mcp_contract_document_audit_log FROM PUBLIC, anon, authenticated, service_role;

-- Request rows contain only a hash and the document ID, never file content or
-- filenames. They provide safe retries when the Edge Function response is lost.
CREATE TABLE public.mcp_contract_document_requests (
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation text NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  client_request_id text NOT NULL CHECK (
    client_request_id ~ '^[A-Za-z0-9:_-]{1,128}$'
  ),
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  document_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, operation, client_request_id)
);

ALTER TABLE public.mcp_contract_document_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mcp_contract_document_requests FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public._mcp_contract_document_assert_entity(
  p_entity_type text,
  p_entity_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF p_entity_id IS NULL THEN
    RAISE EXCEPTION 'MCP_DOCUMENT_ENTITY_REQUIRED' USING ERRCODE = '22023';
  END IF;

  CASE p_entity_type
    WHEN 'lead' THEN
      PERFORM 1 FROM public.leads WHERE id = p_entity_id FOR KEY SHARE;
    WHEN 'contract' THEN
      PERFORM 1 FROM public.contracts WHERE id = p_entity_id FOR KEY SHARE;
    WHEN 'contract_holder' THEN
      PERFORM 1 FROM public.contract_holders WHERE id = p_entity_id FOR KEY SHARE;
    WHEN 'dependent' THEN
      PERFORM 1 FROM public.dependents WHERE id = p_entity_id FOR KEY SHARE;
    ELSE
      RAISE EXCEPTION 'MCP_DOCUMENT_ENTITY_TYPE_INVALID' USING ERRCODE = '22023';
  END CASE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MCP_DOCUMENT_ENTITY_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public._mcp_contract_document_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'MCP_DOCUMENT_HARD_DELETE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF current_user NOT IN ('postgres', 'service_role') THEN
      RAISE EXCEPTION 'MCP_DOCUMENT_METADATA_RPC_REQUIRED' USING ERRCODE = '42501';
    END IF;
    IF NEW.entity_type IS DISTINCT FROM OLD.entity_type
       OR NEW.entity_id IS DISTINCT FROM OLD.entity_id
       OR NEW.storage_bucket_id IS DISTINCT FROM OLD.storage_bucket_id
       OR NEW.storage_object_path IS DISTINCT FROM OLD.storage_object_path
       OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
       OR NEW.tamanho_bytes IS DISTINCT FROM OLD.tamanho_bytes
       OR NEW.sha256_hex IS DISTINCT FROM OLD.sha256_hex
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR (OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL)
       OR (OLD.storage_cleanup_completed_at IS NOT NULL
           AND NEW.storage_cleanup_completed_at IS NULL) THEN
      RAISE EXCEPTION 'MCP_DOCUMENT_IMMUTABLE_FIELD' USING ERRCODE = '42501';
    END IF;
  ELSIF current_user NOT IN ('postgres', 'service_role') THEN
    RAISE EXCEPTION 'MCP_DOCUMENT_METADATA_RPC_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM public._mcp_contract_document_assert_entity(NEW.entity_type, NEW.entity_id);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER private_contract_documents_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.private_contract_documents
  FOR EACH ROW EXECUTE FUNCTION public._mcp_contract_document_guard();

CREATE OR REPLACE FUNCTION public._mcp_contract_document_prevent_entity_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_has_active_documents boolean := false;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'leads' THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.private_contract_documents AS document
        WHERE document.entity_type = 'lead'
          AND document.entity_id = OLD.id
          AND (document.deleted_at IS NULL OR document.storage_cleanup_completed_at IS NULL)
      ) INTO v_has_active_documents;
    WHEN 'contracts' THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.private_contract_documents AS document
        WHERE (document.deleted_at IS NULL OR document.storage_cleanup_completed_at IS NULL)
          AND (
            (document.entity_type = 'contract' AND document.entity_id = OLD.id)
            OR (
              document.entity_type = 'contract_holder'
              AND document.entity_id IN (
                SELECT holder.id FROM public.contract_holders AS holder
                WHERE holder.contract_id = OLD.id
              )
            )
            OR (
              document.entity_type = 'dependent'
              AND document.entity_id IN (
                SELECT dependent.id FROM public.dependents AS dependent
                WHERE dependent.contract_id = OLD.id
              )
            )
          )
      ) INTO v_has_active_documents;
    WHEN 'contract_holders' THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.private_contract_documents AS document
        WHERE (document.deleted_at IS NULL OR document.storage_cleanup_completed_at IS NULL)
          AND (
            (document.entity_type = 'contract_holder' AND document.entity_id = OLD.id)
            OR (
              document.entity_type = 'dependent'
              AND document.entity_id IN (
                SELECT dependent.id FROM public.dependents AS dependent
                WHERE dependent.holder_id = OLD.id
              )
            )
          )
      ) INTO v_has_active_documents;
    WHEN 'dependents' THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.private_contract_documents AS document
        WHERE document.entity_type = 'dependent'
          AND document.entity_id = OLD.id
          AND (document.deleted_at IS NULL OR document.storage_cleanup_completed_at IS NULL)
      ) INTO v_has_active_documents;
    ELSE
      RAISE EXCEPTION 'MCP_DOCUMENT_ENTITY_DELETE_GUARD_MISCONFIGURED'
        USING ERRCODE = '55000';
  END CASE;

  IF v_has_active_documents THEN
    RAISE EXCEPTION 'MCP_DOCUMENTS_MUST_BE_REMOVED_BEFORE_ENTITY_DELETE'
      USING ERRCODE = '23503';
  END IF;
  RETURN OLD;
END;
$function$;

CREATE TRIGGER leads_private_documents_delete_guard
  BEFORE DELETE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public._mcp_contract_document_prevent_entity_delete();
CREATE TRIGGER contracts_private_documents_delete_guard
  BEFORE DELETE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public._mcp_contract_document_prevent_entity_delete();
CREATE TRIGGER contract_holders_private_documents_delete_guard
  BEFORE DELETE ON public.contract_holders
  FOR EACH ROW EXECUTE FUNCTION public._mcp_contract_document_prevent_entity_delete();
CREATE TRIGGER dependents_private_documents_delete_guard
  BEFORE DELETE ON public.dependents
  FOR EACH ROW EXECUTE FUNCTION public._mcp_contract_document_prevent_entity_delete();

CREATE OR REPLACE FUNCTION public._mcp_contract_document_snapshot(
  p_document_id uuid,
  p_include_deleted boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT jsonb_build_object(
    'id', document.id,
    'entity_type', document.entity_type,
    'entity_id', document.entity_id,
    'storage_bucket_id', document.storage_bucket_id,
    'storage_object_path', document.storage_object_path,
    'tipo_documento', document.tipo_documento,
    'nome_arquivo', document.nome_arquivo,
    'mime_type', document.mime_type,
    'tamanho_bytes', document.tamanho_bytes,
    'sha256_hex', document.sha256_hex,
    'created_at', document.created_at,
    'updated_at', document.updated_at,
    'deleted_at', document.deleted_at,
    'storage_cleanup_completed_at', document.storage_cleanup_completed_at,
    'is_legacy', false
  )
  FROM public.private_contract_documents AS document
  WHERE document.id = p_document_id
    AND (p_include_deleted OR document.deleted_at IS NULL);
$function$;

CREATE OR REPLACE FUNCTION public._mcp_contract_document_claim_request(
  p_actor_user_id uuid,
  p_operation text,
  p_client_request_id text,
  p_signature jsonb
)
RETURNS TABLE (is_replay boolean, document_id uuid)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, extensions
AS $function$
DECLARE
  v_fingerprint text;
  v_stored_fingerprint text;
  v_document_id uuid;
BEGIN
  IF p_client_request_id IS NULL
     OR p_client_request_id !~ '^[A-Za-z0-9:_-]{1,128}$' THEN
    RAISE EXCEPTION 'MCP_CLIENT_REQUEST_ID_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF p_signature IS NULL OR jsonb_typeof(p_signature) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'MCP_DOCUMENT_REQUEST_SIGNATURE_INVALID' USING ERRCODE = '22023';
  END IF;

  v_fingerprint := encode(
    extensions.digest(convert_to(p_signature::text, 'UTF8'), 'sha256'),
    'hex'
  );

  INSERT INTO public.mcp_contract_document_requests (
    actor_id, operation, client_request_id, request_fingerprint
  ) VALUES (
    p_actor_user_id, p_operation, p_client_request_id, v_fingerprint
  )
  ON CONFLICT (actor_id, operation, client_request_id) DO NOTHING;

  SELECT request.request_fingerprint, request.document_id
    INTO v_stored_fingerprint, v_document_id
  FROM public.mcp_contract_document_requests AS request
  WHERE request.actor_id = p_actor_user_id
    AND request.operation = p_operation
    AND request.client_request_id = p_client_request_id
  FOR UPDATE;

  IF v_stored_fingerprint IS DISTINCT FROM v_fingerprint THEN
    RAISE EXCEPTION 'MCP_CLIENT_REQUEST_ID_REUSED' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY SELECT (v_document_id IS NOT NULL), v_document_id;
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
        'id', document.id,
        'entity_type', document.entity_type,
        'entity_id', document.entity_id,
        'storage_bucket_id', document.storage_bucket_id,
        'storage_object_path', document.storage_object_path,
        'tipo_documento', document.tipo_documento,
        'nome_arquivo', document.nome_arquivo,
        'mime_type', document.mime_type,
        'tamanho_bytes', document.tamanho_bytes,
        'sha256_hex', document.sha256_hex,
        'created_at', document.created_at,
        'updated_at', document.updated_at,
        'deleted_at', NULL,
        'is_legacy', false,
        'legacy_url', NULL
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
        'entity_id', legacy.entity_id,
        'storage_bucket_id', NULL,
        'storage_object_path', NULL,
        'tipo_documento', legacy.tipo_documento,
        'nome_arquivo', legacy.nome_arquivo,
        'mime_type', NULL,
        'tamanho_bytes', legacy.tamanho_bytes,
        'sha256_hex', NULL,
        'created_at', legacy.created_at,
        'updated_at', NULL,
        'deleted_at', NULL,
        'is_legacy', true,
        'legacy_url', legacy.url_arquivo
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

  IF v_has_more THEN
    v_next_cursor := jsonb_build_object(
      'created_at', v_cursor_created_at,
      'document_id', v_cursor_document_id
    );
  ELSE
    v_next_cursor := NULL;
  END IF;

  RETURN jsonb_build_object(
    'documents', v_documents,
    'next_cursor', v_next_cursor,
    'has_more', v_has_more
  );
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
  IF v_document IS NOT NULL THEN
    RETURN v_document;
  END IF;

  SELECT jsonb_build_object(
    'id', legacy.id,
    'entity_type', legacy.entity_type,
    'entity_id', legacy.entity_id,
    'storage_bucket_id', NULL,
    'storage_object_path', NULL,
    'tipo_documento', legacy.tipo_documento,
    'nome_arquivo', legacy.nome_arquivo,
    'mime_type', NULL,
    'tamanho_bytes', legacy.tamanho_bytes,
    'sha256_hex', NULL,
    'created_at', legacy.created_at,
    'updated_at', NULL,
    'deleted_at', NULL,
    'is_legacy', true,
    'legacy_url', legacy.url_arquivo
  )
  INTO v_document
  FROM public.documents AS legacy
  WHERE legacy.id = p_document_id;

  IF v_document IS NULL THEN
    RAISE EXCEPTION 'MCP_DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_document;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mcp_contract_document_create_metadata(
  p_actor_user_id uuid,
  p_client_request_id text,
  p_entity_type text,
  p_entity_id uuid,
  p_tipo_documento text,
  p_nome_arquivo text,
  p_mime_type text,
  p_tamanho_bytes bigint,
  p_sha256_hex text,
  p_storage_object_path text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, storage, extensions
AS $function$
DECLARE
  v_storage_metadata jsonb;
  v_actual_size text;
  v_actual_mime text;
  v_fingerprint text;
  v_replay boolean;
  v_existing_document_id uuid;
  v_document_id uuid;
  v_document public.private_contract_documents;
BEGIN
  PERFORM public._mcp_assert_active_contract_admin(p_actor_user_id);
  PERFORM public._mcp_contract_document_assert_entity(p_entity_type, p_entity_id);

  IF p_tipo_documento IS NULL OR char_length(btrim(p_tipo_documento)) NOT BETWEEN 1 AND 80
     OR p_nome_arquivo IS NULL OR char_length(btrim(p_nome_arquivo)) NOT BETWEEN 1 AND 255
     OR p_nome_arquivo ~ '[[:cntrl:]]'
     OR p_mime_type IS NULL
     OR p_mime_type NOT IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
     OR p_tamanho_bytes IS NULL
     OR p_tamanho_bytes NOT BETWEEN 1 AND 20971520
     OR p_sha256_hex IS NULL
     OR p_sha256_hex !~ '^[0-9a-f]{64}$'
     OR p_storage_object_path IS NULL
     OR p_storage_object_path !~ '^(lead|contract|contract_holder|dependent)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|jpeg|png|webp)$'
     OR split_part(p_storage_object_path, '/', 1) IS DISTINCT FROM p_entity_type
     OR split_part(p_storage_object_path, '/', 2) IS DISTINCT FROM p_entity_id::text THEN
    RAISE EXCEPTION 'MCP_DOCUMENT_METADATA_INVALID' USING ERRCODE = '22023';
  END IF;

  IF (p_mime_type = 'application/pdf' AND p_storage_object_path !~ '\.pdf$')
     OR (p_mime_type = 'image/jpeg' AND p_storage_object_path !~ '\.(jpg|jpeg)$')
     OR (p_mime_type = 'image/png' AND p_storage_object_path !~ '\.png$')
     OR (p_mime_type = 'image/webp' AND p_storage_object_path !~ '\.webp$') THEN
    RAISE EXCEPTION 'MCP_DOCUMENT_EXTENSION_MISMATCH' USING ERRCODE = '22023';
  END IF;

  SELECT object.metadata
    INTO v_storage_metadata
  FROM storage.objects AS object
  WHERE object.bucket_id = 'contract-documents-private'
    AND object.name = p_storage_object_path;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MCP_DOCUMENT_STORAGE_OBJECT_REQUIRED' USING ERRCODE = 'P0002';
  END IF;

  v_actual_size := COALESCE(v_storage_metadata ->> 'size', v_storage_metadata ->> 'contentLength');
  v_actual_mime := COALESCE(v_storage_metadata ->> 'mimetype', v_storage_metadata ->> 'contentType');
  IF v_actual_size IS NULL OR v_actual_size !~ '^[0-9]{1,8}$' THEN
    RAISE EXCEPTION 'MCP_DOCUMENT_STORAGE_METADATA_MISMATCH' USING ERRCODE = '22023';
  END IF;
  IF v_actual_size::bigint <> p_tamanho_bytes
     OR lower(v_actual_mime) IS DISTINCT FROM lower(p_mime_type) THEN
    RAISE EXCEPTION 'MCP_DOCUMENT_STORAGE_METADATA_MISMATCH' USING ERRCODE = '22023';
  END IF;

  v_fingerprint := encode(
    extensions.digest(
      convert_to(jsonb_build_object(
        'entity_type', p_entity_type,
        'entity_id', p_entity_id,
        'tipo_documento', btrim(p_tipo_documento),
        'nome_arquivo', btrim(p_nome_arquivo),
        'mime_type', lower(p_mime_type),
        'tamanho_bytes', p_tamanho_bytes,
        'sha256_hex', p_sha256_hex
      )::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  SELECT claim.is_replay, claim.document_id
    INTO v_replay, v_existing_document_id
  FROM public._mcp_contract_document_claim_request(
    p_actor_user_id, 'create', p_client_request_id,
    jsonb_build_object('fingerprint', v_fingerprint)
  ) AS claim;

  IF v_replay THEN
    SELECT * INTO v_document
    FROM public.private_contract_documents AS existing
    WHERE existing.id = v_existing_document_id;
    IF v_document.id IS NULL THEN
      RAISE EXCEPTION 'MCP_DOCUMENT_REQUEST_RESULT_MISSING' USING ERRCODE = 'P0002';
    END IF;
    IF v_document.storage_object_path IS DISTINCT FROM p_storage_object_path THEN
      RAISE EXCEPTION 'MCP_DOCUMENT_REQUEST_PATH_MISMATCH' USING ERRCODE = '22023';
    END IF;
    RETURN public._mcp_contract_document_snapshot(v_document.id, true)
      || jsonb_build_object('replayed', true);
  END IF;

  INSERT INTO public.private_contract_documents (
    entity_type, entity_id, storage_bucket_id, storage_object_path,
    tipo_documento, nome_arquivo, mime_type, tamanho_bytes, sha256_hex,
    created_by, updated_by
  ) VALUES (
    p_entity_type, p_entity_id, 'contract-documents-private', p_storage_object_path,
    btrim(p_tipo_documento), btrim(p_nome_arquivo), lower(p_mime_type), p_tamanho_bytes,
    p_sha256_hex, p_actor_user_id, p_actor_user_id
  ) RETURNING * INTO v_document;

  UPDATE public.mcp_contract_document_requests AS request
  SET document_id = v_document.id
  WHERE request.actor_id = p_actor_user_id
    AND request.operation = 'create'
    AND request.client_request_id = p_client_request_id;

  INSERT INTO public.mcp_contract_document_audit_log (
    document_id, entity_type, entity_id, actor_id, action, changed_fields, client_request_id
  ) VALUES (
    v_document.id, v_document.entity_type, v_document.entity_id, p_actor_user_id,
    'created', ARRAY['metadata', 'storage_object_path'], p_client_request_id
  );

  RETURN public._mcp_contract_document_snapshot(v_document.id, false)
    || jsonb_build_object('replayed', false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.mcp_contract_document_update_metadata(
  p_actor_user_id uuid,
  p_client_request_id text,
  p_document_id uuid,
  p_expected_updated_at timestamptz,
  p_tipo_documento text,
  p_nome_arquivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $function$
DECLARE
  v_replay boolean;
  v_existing_document_id uuid;
  v_document public.private_contract_documents;
  v_fingerprint text;
BEGIN
  PERFORM public._mcp_assert_active_contract_admin(p_actor_user_id);
  IF p_document_id IS NULL OR p_expected_updated_at IS NULL
     OR p_tipo_documento IS NULL OR char_length(btrim(p_tipo_documento)) NOT BETWEEN 1 AND 80
     OR p_nome_arquivo IS NULL OR char_length(btrim(p_nome_arquivo)) NOT BETWEEN 1 AND 255
     OR p_nome_arquivo ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'MCP_DOCUMENT_METADATA_INVALID' USING ERRCODE = '22023';
  END IF;

  v_fingerprint := encode(extensions.digest(convert_to(jsonb_build_object(
    'document_id', p_document_id,
    'expected_updated_at', p_expected_updated_at,
    'tipo_documento', btrim(p_tipo_documento),
    'nome_arquivo', btrim(p_nome_arquivo)
  )::text, 'UTF8'), 'sha256'), 'hex');
  SELECT claim.is_replay, claim.document_id
    INTO v_replay, v_existing_document_id
  FROM public._mcp_contract_document_claim_request(
    p_actor_user_id, 'update', p_client_request_id,
    jsonb_build_object('fingerprint', v_fingerprint)
  ) AS claim;
  IF v_replay THEN
    RETURN public._mcp_contract_document_snapshot(v_existing_document_id, true)
      || jsonb_build_object('replayed', true);
  END IF;

  SELECT * INTO v_document
  FROM public.private_contract_documents AS document
  WHERE document.id = p_document_id
  FOR UPDATE;
  IF v_document.id IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.documents AS legacy WHERE legacy.id = p_document_id) THEN
      RAISE EXCEPTION 'MCP_LEGACY_DOCUMENT_READ_ONLY' USING ERRCODE = '42501';
    END IF;
    RAISE EXCEPTION 'MCP_DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_document.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'MCP_DOCUMENT_DELETED' USING ERRCODE = 'P0002';
  END IF;
  IF v_document.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'MCP_CONCURRENCY_CONFLICT' USING ERRCODE = '40001';
  END IF;

  UPDATE public.private_contract_documents AS document
  SET tipo_documento = btrim(p_tipo_documento),
      nome_arquivo = btrim(p_nome_arquivo),
      updated_at = now(),
      updated_by = p_actor_user_id
  WHERE document.id = p_document_id
  RETURNING * INTO v_document;

  UPDATE public.mcp_contract_document_requests AS request
  SET document_id = v_document.id
  WHERE request.actor_id = p_actor_user_id
    AND request.operation = 'update'
    AND request.client_request_id = p_client_request_id;
  INSERT INTO public.mcp_contract_document_audit_log (
    document_id, entity_type, entity_id, actor_id, action, changed_fields, client_request_id
  ) VALUES (
    v_document.id, v_document.entity_type, v_document.entity_id, p_actor_user_id,
    'updated', ARRAY['tipo_documento', 'nome_arquivo'], p_client_request_id
  );

  RETURN public._mcp_contract_document_snapshot(v_document.id, false)
    || jsonb_build_object('replayed', false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.mcp_contract_document_delete_metadata(
  p_actor_user_id uuid,
  p_client_request_id text,
  p_document_id uuid,
  p_expected_updated_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $function$
DECLARE
  v_replay boolean;
  v_existing_document_id uuid;
  v_document public.private_contract_documents;
  v_fingerprint text;
BEGIN
  PERFORM public._mcp_assert_active_contract_admin(p_actor_user_id);
  IF p_document_id IS NULL OR p_expected_updated_at IS NULL THEN
    RAISE EXCEPTION 'MCP_DOCUMENT_METADATA_INVALID' USING ERRCODE = '22023';
  END IF;

  v_fingerprint := encode(extensions.digest(convert_to(jsonb_build_object(
    'document_id', p_document_id,
    'expected_updated_at', p_expected_updated_at
  )::text, 'UTF8'), 'sha256'), 'hex');
  SELECT claim.is_replay, claim.document_id
    INTO v_replay, v_existing_document_id
  FROM public._mcp_contract_document_claim_request(
    p_actor_user_id, 'delete', p_client_request_id,
    jsonb_build_object('fingerprint', v_fingerprint)
  ) AS claim;
  IF v_replay THEN
    SELECT * INTO v_document
    FROM public.private_contract_documents AS document
    WHERE document.id = v_existing_document_id;
    IF v_document.id IS NULL THEN
      RAISE EXCEPTION 'MCP_DOCUMENT_REQUEST_RESULT_MISSING' USING ERRCODE = 'P0002';
    END IF;
    RETURN jsonb_build_object(
      'document_id', v_document.id,
      'deleted', (v_document.deleted_at IS NOT NULL),
      'deleted_at', v_document.deleted_at,
      'storage_bucket_id', v_document.storage_bucket_id,
      'storage_object_path', v_document.storage_object_path,
      'cleanup_status', CASE
        WHEN v_document.storage_cleanup_completed_at IS NULL THEN 'retryable'
        ELSE 'completed'
      END,
      'replayed', true
    );
  END IF;

  SELECT * INTO v_document
  FROM public.private_contract_documents AS document
  WHERE document.id = p_document_id
  FOR UPDATE;
  IF v_document.id IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.documents AS legacy WHERE legacy.id = p_document_id) THEN
      RAISE EXCEPTION 'MCP_LEGACY_DOCUMENT_READ_ONLY' USING ERRCODE = '42501';
    END IF;
    RAISE EXCEPTION 'MCP_DOCUMENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_document.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'MCP_DOCUMENT_DELETED' USING ERRCODE = 'P0002';
  END IF;
  IF v_document.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'MCP_CONCURRENCY_CONFLICT' USING ERRCODE = '40001';
  END IF;

  UPDATE public.private_contract_documents AS document
  SET deleted_at = now(), updated_at = now(), updated_by = p_actor_user_id
  WHERE document.id = p_document_id
  RETURNING * INTO v_document;
  UPDATE public.mcp_contract_document_requests AS request
  SET document_id = v_document.id
  WHERE request.actor_id = p_actor_user_id
    AND request.operation = 'delete'
    AND request.client_request_id = p_client_request_id;
  INSERT INTO public.mcp_contract_document_audit_log (
    document_id, entity_type, entity_id, actor_id, action, changed_fields, client_request_id
  ) VALUES (
    v_document.id, v_document.entity_type, v_document.entity_id, p_actor_user_id,
    'deleted', ARRAY['deleted_at'], p_client_request_id
  );

  -- The caller deletes this object through the Storage API after this database
  -- transaction commits. The tombstone retains the path so a retry can safely
  -- finish cleanup if Storage removal fails or its response is lost.
  RETURN jsonb_build_object(
    'document_id', v_document.id,
    'deleted', true,
    'deleted_at', v_document.deleted_at,
    'storage_bucket_id', v_document.storage_bucket_id,
    'storage_object_path', v_document.storage_object_path,
    'cleanup_status', 'pending',
    'replayed', false
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.mcp_contract_document_finalize_cleanup(
  p_actor_user_id uuid,
  p_document_id uuid,
  p_delete_client_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_document public.private_contract_documents;
  v_request_document_id uuid;
BEGIN
  PERFORM public._mcp_assert_active_contract_admin(p_actor_user_id);
  IF p_document_id IS NULL OR p_delete_client_request_id IS NULL
     OR p_delete_client_request_id !~ '^[A-Za-z0-9:_-]{1,128}$' THEN
    RAISE EXCEPTION 'MCP_DOCUMENT_CLEANUP_REQUEST_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT request.document_id INTO v_request_document_id
  FROM public.mcp_contract_document_requests AS request
  WHERE request.actor_id = p_actor_user_id
    AND request.operation = 'delete'
    AND request.client_request_id = p_delete_client_request_id;
  IF v_request_document_id IS DISTINCT FROM p_document_id THEN
    RAISE EXCEPTION 'MCP_DOCUMENT_DELETE_REQUEST_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_document
  FROM public.private_contract_documents AS document
  WHERE document.id = p_document_id
  FOR UPDATE;
  IF v_document.id IS NULL OR v_document.deleted_at IS NULL THEN
    RAISE EXCEPTION 'MCP_DOCUMENT_DELETE_REQUIRED' USING ERRCODE = 'P0002';
  END IF;

  IF v_document.storage_cleanup_completed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'document_id', v_document.id,
      'cleanup_status', 'completed',
      'storage_cleanup_completed_at', v_document.storage_cleanup_completed_at,
      'replayed', true
    );
  END IF;

  UPDATE public.private_contract_documents AS document
  SET storage_cleanup_completed_at = now(), updated_at = now(), updated_by = p_actor_user_id
  WHERE document.id = p_document_id
  RETURNING * INTO v_document;
  INSERT INTO public.mcp_contract_document_audit_log (
    document_id, entity_type, entity_id, actor_id, action, changed_fields, client_request_id
  ) VALUES (
    v_document.id, v_document.entity_type, v_document.entity_id, p_actor_user_id,
    'cleanup_completed', ARRAY['storage_cleanup_completed_at'], p_delete_client_request_id
  );

  RETURN jsonb_build_object(
    'document_id', v_document.id,
    'cleanup_status', 'completed',
    'storage_cleanup_completed_at', v_document.storage_cleanup_completed_at,
    'replayed', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public._mcp_contract_document_assert_entity(text, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._mcp_contract_document_guard() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._mcp_contract_document_prevent_entity_delete() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._mcp_contract_document_snapshot(uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._mcp_contract_document_claim_request(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.mcp_contract_documents_list(uuid, text, uuid, integer, timestamptz, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_contract_document_get(uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_contract_document_create_metadata(uuid, text, text, uuid, text, text, text, bigint, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_contract_document_update_metadata(uuid, text, uuid, timestamptz, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_contract_document_delete_metadata(uuid, text, uuid, timestamptz) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_contract_document_finalize_cleanup(uuid, uuid, text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.mcp_contract_documents_list(uuid, text, uuid, integer, timestamptz, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_contract_document_get(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_contract_document_create_metadata(uuid, text, text, uuid, text, text, text, bigint, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_contract_document_update_metadata(uuid, text, uuid, timestamptz, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_contract_document_delete_metadata(uuid, text, uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_contract_document_finalize_cleanup(uuid, uuid, text) TO service_role;

COMMENT ON TABLE public.private_contract_documents IS
  'Private Storage metadata for MCP contract documents. Kept separate from legacy public.documents URLs.';
COMMENT ON FUNCTION public.mcp_contract_documents_list(uuid, text, uuid, integer, timestamptz, uuid) IS
  'MCP-only active-admin document listing; returns private metadata and read-only legacy metadata without signing URLs.';
COMMENT ON FUNCTION public.mcp_contract_document_get(uuid, uuid) IS
  'MCP-only active-admin document metadata lookup; Edge Function signs private objects for a short duration.';
COMMENT ON FUNCTION public.mcp_contract_document_create_metadata(uuid, text, text, uuid, text, text, text, bigint, text, text) IS
  'Registers a server-uploaded private object after validating the active actor, entity, Storage metadata, and idempotency request.';
COMMENT ON FUNCTION public.mcp_contract_document_update_metadata(uuid, text, uuid, timestamptz, text, text) IS
  'Updates only private-document labels using optimistic concurrency; file replacement is a create plus delete.';
COMMENT ON FUNCTION public.mcp_contract_document_delete_metadata(uuid, text, uuid, timestamptz) IS
  'Soft-deletes metadata and returns the Storage path for API cleanup after commit; retries retain the path until cleanup is finalized.';
COMMENT ON FUNCTION public.mcp_contract_document_finalize_cleanup(uuid, uuid, text) IS
  'Records successful Storage API removal; required before deleting the referenced CRM entity.';

COMMIT;
