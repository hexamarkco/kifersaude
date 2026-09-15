BEGIN;

-- Preserve a value-free, append-only audit trail for MCP contract mutations.
CREATE TABLE public.mcp_contract_mutation_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('contract', 'holder', 'dependent', 'value_adjustment')),
  entity_id uuid NOT NULL,
  contract_id uuid,
  actor_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('created', 'updated', 'removed')),
  changed_fields text[] NOT NULL DEFAULT ARRAY[]::text[],
  client_request_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mcp_contract_mutation_audit_request_id_length
    CHECK (client_request_id IS NULL OR client_request_id ~ '^[A-Za-z0-9:_-]{1,128}$')
);

CREATE INDEX mcp_contract_mutation_audit_entity_created_idx
  ON public.mcp_contract_mutation_audit_log (entity_type, entity_id, created_at DESC);
CREATE INDEX mcp_contract_mutation_audit_contract_created_idx
  ON public.mcp_contract_mutation_audit_log (contract_id, created_at DESC);
CREATE INDEX mcp_contract_mutation_audit_actor_created_idx
  ON public.mcp_contract_mutation_audit_log (actor_id, created_at DESC);
ALTER TABLE public.mcp_contract_mutation_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mcp_contract_mutation_audit_log FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public._mcp_contract_mutation_audit_capture()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_actor_id uuid := NULLIF(current_setting('mcp.contract_actor_user_id', true), '')::uuid;
  v_request_id text := NULLIF(current_setting('mcp.contract_client_request_id', true), '');
  v_entity_type text;
  v_entity_id uuid;
  v_contract_id uuid;
  v_action text;
  v_row jsonb;
  v_old jsonb;
  v_changed_fields text[];
BEGIN
  -- User-interface writes outside a signed MCP request keep their existing audit path.
  IF v_actor_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_entity_type := CASE TG_TABLE_NAME
    WHEN 'contracts' THEN 'contract'
    WHEN 'contract_holders' THEN 'holder'
    WHEN 'dependents' THEN 'dependent'
    WHEN 'contract_value_adjustments' THEN 'value_adjustment'
  END;
  IF v_entity_type IS NULL THEN
    RAISE EXCEPTION 'MCP_CONTRACT_AUDIT_TRIGGER_MISCONFIGURED' USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_row := to_jsonb(OLD);
    v_old := NULL;
    v_action := 'removed';
  ELSIF TG_OP = 'INSERT' THEN
    v_row := to_jsonb(NEW);
    v_old := NULL;
    v_action := 'created';
  ELSE
    v_row := to_jsonb(NEW);
    v_old := to_jsonb(OLD);
    v_action := 'updated';
  END IF;
  v_entity_id := (v_row->>'id')::uuid;
  v_contract_id := CASE WHEN TG_TABLE_NAME = 'contracts'
    THEN v_entity_id
    ELSE NULLIF(v_row->>'contract_id', '')::uuid
  END;

  IF v_old IS NULL THEN
    SELECT COALESCE(array_agg(entry.key ORDER BY entry.key), ARRAY[]::text[])
      INTO v_changed_fields
      FROM jsonb_each(v_row) AS entry;
  ELSE
    SELECT COALESCE(array_agg(changed.key ORDER BY changed.key), ARRAY[]::text[])
      INTO v_changed_fields
      FROM (
        SELECT keys.key
          FROM (SELECT jsonb_object_keys(v_row || v_old) AS key) AS keys
         WHERE v_row->keys.key IS DISTINCT FROM v_old->keys.key
      ) AS changed;
  END IF;

  INSERT INTO public.mcp_contract_mutation_audit_log (
    entity_type, entity_id, contract_id, actor_id, action, changed_fields, client_request_id
  ) VALUES (
    v_entity_type, v_entity_id, v_contract_id, v_actor_id, v_action,
    COALESCE(v_changed_fields, ARRAY[]::text[]), v_request_id
  );
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public._mcp_contract_mutation_audit_no_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  RAISE EXCEPTION 'MCP_CONTRACT_AUDIT_IMMUTABLE' USING ERRCODE = '42501';
END;
$function$;

CREATE TRIGGER mcp_contract_audit_capture
  AFTER INSERT OR UPDATE OR DELETE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public._mcp_contract_mutation_audit_capture();
CREATE TRIGGER mcp_contract_holder_audit_capture
  AFTER INSERT OR UPDATE OR DELETE ON public.contract_holders
  FOR EACH ROW EXECUTE FUNCTION public._mcp_contract_mutation_audit_capture();
CREATE TRIGGER mcp_dependent_audit_capture
  AFTER INSERT OR UPDATE OR DELETE ON public.dependents
  FOR EACH ROW EXECUTE FUNCTION public._mcp_contract_mutation_audit_capture();
CREATE TRIGGER mcp_contract_value_adjustment_audit_capture
  AFTER INSERT OR UPDATE OR DELETE ON public.contract_value_adjustments
  FOR EACH ROW EXECUTE FUNCTION public._mcp_contract_mutation_audit_capture();

CREATE TRIGGER mcp_contract_audit_log_immutable
  BEFORE UPDATE OR DELETE ON public.mcp_contract_mutation_audit_log
  FOR EACH ROW EXECUTE FUNCTION public._mcp_contract_mutation_audit_no_change();

REVOKE ALL ON FUNCTION public._mcp_contract_mutation_audit_capture() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._mcp_contract_mutation_audit_no_change() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public._mcp_assert_active_contract_admin(p_actor_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $function$
BEGIN
  IF p_actor_user_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.user_profiles AS profile
    WHERE profile.id = p_actor_user_id
      AND profile.role = 'admin'
      AND NULLIF(btrim(profile.email), '') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'MCP_ACTOR_NOT_ACTIVE_ADMIN' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('mcp.contract_actor_user_id', p_actor_user_id::text, true);
END;
$function$;

ALTER TABLE public.mcp_contract_write_requests
  DROP CONSTRAINT IF EXISTS mcp_contract_write_requests_operation_check;
ALTER TABLE public.mcp_contract_write_requests
  ADD CONSTRAINT mcp_contract_write_requests_operation_check
  CHECK (operation IN (
    'contract.create', 'holder.create', 'dependent.create', 'contract.bundle.create',
    'holder.remove', 'dependent.remove', 'contract.adjustment.create'
  ));

CREATE OR REPLACE FUNCTION public._mcp_begin_contract_write_request(
  p_actor_user_id uuid,
  p_operation text,
  p_client_request_id text,
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
BEGIN
  IF p_client_request_id IS NULL
     OR char_length(btrim(p_client_request_id)) NOT BETWEEN 1 AND 128
     OR p_client_request_id !~ '^[A-Za-z0-9:_-]{1,128}$' THEN
    RAISE EXCEPTION 'MCP_CLIENT_REQUEST_ID_REQUIRED' USING ERRCODE = '22023';
  END IF;
  PERFORM set_config('mcp.contract_client_request_id', btrim(p_client_request_id), true);

  v_fingerprint := encode(
    extensions.digest(convert_to(p_signature::text, 'UTF8'), 'sha256'),
    'hex'
  );
  INSERT INTO public.mcp_contract_write_requests (
    actor_id, operation, client_request_id, request_fingerprint
  ) VALUES (
    p_actor_user_id, p_operation, btrim(p_client_request_id), v_fingerprint
  ) ON CONFLICT (actor_id, operation, client_request_id) DO NOTHING;

  SELECT request.request_fingerprint, request.result_payload
    INTO v_stored_fingerprint, v_result
    FROM public.mcp_contract_write_requests AS request
   WHERE request.actor_id = p_actor_user_id
     AND request.operation = p_operation
     AND request.client_request_id = btrim(p_client_request_id)
   FOR UPDATE;

  IF v_stored_fingerprint IS DISTINCT FROM v_fingerprint THEN
    RAISE EXCEPTION 'MCP_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD' USING ERRCODE = '22023';
  END IF;
  RETURN jsonb_build_object('replayed', v_result IS NOT NULL, 'result', v_result);
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

  SELECT * INTO v_dependent
    FROM public.dependents AS dependent
   WHERE dependent.id = p_dependent_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MCP_DEPENDENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_dependent.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'MCP_CONCURRENT_UPDATE' USING ERRCODE = '40001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.private_contract_documents AS document
     WHERE document.entity_type = 'dependent' AND document.entity_id = v_dependent.id
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

  SELECT * INTO v_holder
    FROM public.contract_holders AS holder
   WHERE holder.id = p_holder_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MCP_HOLDER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_holder.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'MCP_CONCURRENT_UPDATE' USING ERRCODE = '40001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.dependents AS dependent WHERE dependent.holder_id = v_holder.id)
     OR EXISTS (
       SELECT 1 FROM public.private_contract_documents AS document
        WHERE document.entity_type = 'contract_holder' AND document.entity_id = v_holder.id
     ) THEN
    RAISE EXCEPTION 'MCP_HOLDER_HAS_DEPENDENTS_OR_DOCUMENT_HISTORY' USING ERRCODE = '23503';
  END IF;

  DELETE FROM public.contract_holders WHERE id = v_holder.id;
  v_result := jsonb_build_object('holder_id', v_holder.id, 'contract_id', v_holder.contract_id, 'removed', true, 'replayed', false);
  PERFORM public._mcp_complete_contract_write_request(p_actor_user_id, 'holder.remove', p_client_request_id, v_result - 'replayed');
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mcp_create_contract_value_adjustment(
  p_actor_user_id uuid,
  p_contract_id uuid,
  p_client_request_id text,
  p_tipo text,
  p_valor numeric,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $function$
DECLARE
  v_request jsonb;
  v_contract public.contracts;
  v_adjustment public.contract_value_adjustments;
  v_result jsonb;
BEGIN
  PERFORM public._mcp_assert_active_contract_admin(p_actor_user_id);
  IF p_contract_id IS NULL OR p_tipo NOT IN ('desconto', 'acrescimo')
     OR p_valor IS NULL OR p_valor <= 0
     OR p_motivo IS NULL OR char_length(btrim(p_motivo)) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'MCP_CONTRACT_VALUE_ADJUSTMENT_INVALID' USING ERRCODE = '22023';
  END IF;
  v_request := public._mcp_begin_contract_write_request(
    p_actor_user_id, 'contract.adjustment.create', p_client_request_id,
    jsonb_build_object('contract_id', p_contract_id, 'tipo', p_tipo, 'valor', p_valor, 'motivo', btrim(p_motivo))
  );
  IF (v_request->>'replayed')::boolean THEN
    RETURN (v_request->'result') || jsonb_build_object('replayed', true);
  END IF;

  SELECT * INTO v_contract FROM public.contracts AS contract WHERE contract.id = p_contract_id FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MCP_CONTRACT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.contract_value_adjustments (contract_id, tipo, valor, motivo, created_by)
  VALUES (p_contract_id, p_tipo, p_valor, btrim(p_motivo), p_actor_user_id::text)
  RETURNING * INTO v_adjustment;
  v_result := jsonb_build_object('adjustment_id', v_adjustment.id, 'contract_id', v_adjustment.contract_id,
    'tipo', v_adjustment.tipo, 'valor', v_adjustment.valor, 'created_at', v_adjustment.created_at, 'replayed', false);
  PERFORM public._mcp_complete_contract_write_request(p_actor_user_id, 'contract.adjustment.create', p_client_request_id, v_result - 'replayed');
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.mcp_remove_contract_dependent(uuid, uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_remove_contract_holder(uuid, uuid, timestamptz, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_create_contract_value_adjustment(uuid, uuid, text, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mcp_remove_contract_dependent(uuid, uuid, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_remove_contract_holder(uuid, uuid, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_create_contract_value_adjustment(uuid, uuid, text, text, numeric, text) TO service_role;

COMMENT ON FUNCTION public.mcp_remove_contract_holder(uuid, uuid, timestamptz, text) IS
  'Removes a holder only when no dependents or private document metadata reference it; preserves audit and requires optimistic concurrency.';
COMMENT ON FUNCTION public.mcp_remove_contract_dependent(uuid, uuid, timestamptz, text) IS
  'Removes a dependent only when no private document metadata references it; preserves audit and requires optimistic concurrency.';
COMMENT ON FUNCTION public.mcp_create_contract_value_adjustment(uuid, uuid, text, text, numeric, text) IS
  'Creates an idempotent adjustment in the existing commission/value model; no payment or chargeback ledger is inferred.';

COMMIT;
