BEGIN;

ALTER TABLE public.mcp_contract_write_requests
  DROP CONSTRAINT IF EXISTS mcp_contract_write_requests_operation_check;
ALTER TABLE public.mcp_contract_write_requests
  ADD CONSTRAINT mcp_contract_write_requests_operation_check
  CHECK (operation IN (
    'contract.create', 'holder.create', 'dependent.create', 'contract.bundle.create',
    'holder.remove', 'dependent.remove', 'contract.adjustment.create',
    'holder.import.create', 'holder.import.consume',
    'dependent.import.create', 'dependent.import.consume'
  ));

ALTER TABLE public.contract_dependent_imports
  ADD COLUMN consume_request_fingerprint text
  CHECK (consume_request_fingerprint IS NULL OR consume_request_fingerprint ~ '^[0-9a-f]{64}$');
ALTER TABLE public.contract_dependent_imports
  DROP CONSTRAINT contract_dependent_imports_status_payload;
ALTER TABLE public.contract_dependent_imports
  ADD CONSTRAINT contract_dependent_imports_status_payload CHECK (
    (status = 'pending' AND consumed_at IS NULL AND dependent_id IS NULL
      AND consume_request_fingerprint IS NULL)
    OR (status = 'consumed' AND consumed_at IS NOT NULL AND dependent_id IS NOT NULL
      AND consume_request_fingerprint IS NOT NULL
      AND nome_completo IS NULL AND cpf IS NULL AND data_nascimento IS NULL AND relacao IS NULL
      AND elegibilidade IS NULL AND valor_individual IS NULL AND carencia_individual IS NULL
      AND bonus_por_vida_aplicado IS NULL)
    OR (status = 'expired' AND consumed_at IS NULL AND dependent_id IS NULL
      AND consume_request_fingerprint IS NULL
      AND nome_completo IS NULL AND cpf IS NULL AND data_nascimento IS NULL AND relacao IS NULL
      AND elegibilidade IS NULL AND valor_individual IS NULL AND carencia_individual IS NULL
      AND bonus_por_vida_aplicado IS NULL)
  );

ALTER TABLE public.contract_person_import_audit_log
  DROP CONSTRAINT contract_person_import_audit_log_operation_check;
ALTER TABLE public.contract_person_import_audit_log
  ADD CONSTRAINT contract_person_import_audit_log_operation_check CHECK (operation IN (
    'holder.import.create', 'holder.import.consume',
    'dependent.import.create', 'dependent.import.consume'
  ));

CREATE OR REPLACE FUNCTION public._mcp_contract_import_request_fingerprint(
  p_actor_user_id uuid,
  p_operation text,
  p_client_request_id text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, extensions
AS $function$
BEGIN
  IF p_operation NOT IN (
    'holder.import.create', 'holder.import.consume',
    'dependent.import.create', 'dependent.import.consume'
  ) THEN
    RAISE EXCEPTION 'MCP_IMPORT_OPERATION_NOT_ALLOWED' USING ERRCODE = '22023';
  END IF;
  IF p_actor_user_id IS NULL OR p_client_request_id IS NULL
     OR char_length(btrim(p_client_request_id)) NOT BETWEEN 1 AND 128
     OR btrim(p_client_request_id) !~ '^[A-Za-z0-9:_-]{1,128}$' THEN
    RAISE EXCEPTION 'MCP_CLIENT_REQUEST_ID_REQUIRED' USING ERRCODE = '22023';
  END IF;
  RETURN encode(extensions.digest(
    convert_to(p_actor_user_id::text || ':' || p_operation || ':' || btrim(p_client_request_id), 'UTF8'),
    'sha256'
  ), 'hex');
END;
$function$;

CREATE OR REPLACE FUNCTION public.mcp_create_contract_dependent_from_import(
  p_actor_user_id uuid,
  p_import_id uuid,
  p_contract_id uuid,
  p_holder_id uuid,
  p_client_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_request jsonb;
  v_import public.contract_dependent_imports;
  v_holder public.contract_holders;
  v_dependent public.dependents;
  v_dependent_payload jsonb;
  v_request_fingerprint text;
  v_result jsonb;
BEGIN
  PERFORM public._mcp_assert_active_contract_admin(p_actor_user_id);
  IF p_import_id IS NULL OR p_contract_id IS NULL OR p_holder_id IS NULL THEN
    RAISE EXCEPTION 'MCP_INVALID_DEPENDENT_DATA' USING ERRCODE = '22023';
  END IF;

  v_request_fingerprint := public._mcp_contract_import_request_fingerprint(
    p_actor_user_id, 'dependent.import.consume', p_client_request_id
  );
  v_request := public._mcp_begin_contract_write_request(
    p_actor_user_id, 'dependent.import.consume', v_request_fingerprint,
    jsonb_build_object('import_id', p_import_id, 'contract_id', p_contract_id, 'holder_id', p_holder_id)
  );
  IF (v_request->>'replayed')::boolean THEN
    RETURN (v_request->'result') || jsonb_build_object('replayed', true);
  END IF;

  SELECT * INTO v_import
  FROM public.contract_dependent_imports AS staged
  WHERE staged.id = p_import_id AND staged.actor_id = p_actor_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MCP_IMPORT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF (v_import.contract_id IS NOT NULL AND v_import.contract_id IS DISTINCT FROM p_contract_id)
     OR (v_import.holder_id IS NOT NULL AND v_import.holder_id IS DISTINCT FROM p_holder_id) THEN
    RAISE EXCEPTION 'MCP_IMPORT_CONTRACT_MISMATCH' USING ERRCODE = '22023';
  END IF;
  IF v_import.status = 'consumed' THEN
    RAISE EXCEPTION 'MCP_IMPORT_ALREADY_CONSUMED' USING ERRCODE = '55000';
  END IF;
  IF v_import.status = 'expired' OR v_import.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'MCP_IMPORT_EXPIRED' USING ERRCODE = '55000';
  END IF;

  SELECT * INTO v_holder
  FROM public.contract_holders AS holder
  WHERE holder.id = p_holder_id AND holder.contract_id = p_contract_id
  FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MCP_HOLDER_NOT_IN_CONTRACT' USING ERRCODE = '22023';
  END IF;

  v_dependent_payload := jsonb_strip_nulls(to_jsonb(v_import) - ARRAY[
    'id', 'actor_id', 'contract_id', 'holder_id', 'create_request_fingerprint',
    'consume_request_fingerprint', 'status', 'created_at', 'updated_at',
    'expires_at', 'consumed_at', 'dependent_id'
  ]::text[]);

  -- Keep the mutation audit value-free: it records this opaque import UUID.
  PERFORM set_config('mcp.contract_client_request_id', v_import.id::text, true);
  BEGIN
    v_dependent := public._mcp_insert_dependent(p_contract_id, p_holder_id, v_dependent_payload);
  EXCEPTION WHEN OTHERS THEN
    DECLARE
      v_error_message text;
      v_error_state text;
    BEGIN
      GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT, v_error_state = RETURNED_SQLSTATE;
      IF v_error_message ~ '^MCP_[A-Z0-9_]+$' THEN
        RAISE EXCEPTION '%', v_error_message USING ERRCODE = v_error_state;
      END IF;
      IF v_error_state = '23505' THEN
        RAISE EXCEPTION 'MCP_DUPLICATE_DEPENDENT' USING ERRCODE = '23505';
      END IF;
      RAISE EXCEPTION 'MCP_INVALID_DEPENDENT_DATA' USING ERRCODE = '22023';
    END;
  END;

  UPDATE public.contract_dependent_imports AS staged
     SET status = 'consumed',
         nome_completo = NULL, cpf = NULL, data_nascimento = NULL, relacao = NULL,
         elegibilidade = NULL, valor_individual = NULL, carencia_individual = NULL,
         bonus_por_vida_aplicado = NULL,
         consumed_at = clock_timestamp(), dependent_id = v_dependent.id,
         consume_request_fingerprint = v_request_fingerprint,
         updated_at = clock_timestamp()
   WHERE staged.id = v_import.id;

  PERFORM public._mcp_audit_contract_person_import(
    'dependent', v_import.id, p_actor_user_id, NULL,
    p_contract_id, p_holder_id, v_request_fingerprint,
    'dependent.import.consume', 'consumed'
  );

  v_result := jsonb_build_object(
    'success', true,
    'import_id', v_import.id,
    'contract_id', p_contract_id,
    'holder_id', p_holder_id,
    'dependent_id', v_dependent.id
  );
  PERFORM public._mcp_complete_contract_write_request(
    p_actor_user_id, 'dependent.import.consume', v_request_fingerprint, v_result
  );
  RETURN v_result || jsonb_build_object('replayed', false);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'MCP_DUPLICATE_DEPENDENT' USING ERRCODE = '23505';
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_contract_person_imports(p_batch_limit integer DEFAULT 500)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_batch_limit, 500), 1), 5000);
  v_count integer := 0;
  v_holder record;
  v_dependent record;
BEGIN
  FOR v_holder IN
    SELECT staged.* FROM public.contract_holder_imports AS staged
    WHERE staged.status = 'pending' AND staged.expires_at <= clock_timestamp()
    ORDER BY staged.expires_at, staged.id LIMIT v_limit FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.contract_holder_imports AS staged SET status = 'expired', source = NULL,
      nome_completo = NULL, cpf = NULL, rg = NULL, data_nascimento = NULL,
      sexo = NULL, estado_civil = NULL, telefone = NULL, email = NULL, cep = NULL,
      endereco = NULL, numero = NULL, complemento = NULL, bairro = NULL,
      cidade = NULL, estado = NULL, cns = NULL, cnpj = NULL, razao_social = NULL,
      nome_fantasia = NULL, percentual_societario = NULL, data_abertura_cnpj = NULL,
      bonus_por_vida_aplicado = NULL, updated_at = clock_timestamp()
    WHERE staged.id = v_holder.id;
    PERFORM public._mcp_audit_contract_person_import(
      'holder', v_holder.id, v_holder.actor_id, v_holder.lead_id,
      v_holder.contract_id, NULL, v_holder.create_request_fingerprint,
      'holder.import.create', 'expired'
    );
    v_count := v_count + 1;
  END LOOP;

  FOR v_dependent IN
    SELECT staged.* FROM public.contract_dependent_imports AS staged
    WHERE staged.status = 'pending' AND staged.expires_at <= clock_timestamp()
    ORDER BY staged.expires_at, staged.id LIMIT v_limit FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.contract_dependent_imports AS staged SET status = 'expired',
      nome_completo = NULL, cpf = NULL, data_nascimento = NULL, relacao = NULL,
      elegibilidade = NULL, valor_individual = NULL, carencia_individual = NULL,
      bonus_por_vida_aplicado = NULL, updated_at = clock_timestamp()
    WHERE staged.id = v_dependent.id;
    PERFORM public._mcp_audit_contract_person_import(
      'dependent', v_dependent.id, v_dependent.actor_id, NULL,
      v_dependent.contract_id, v_dependent.holder_id,
      v_dependent.create_request_fingerprint, 'dependent.import.create', 'expired'
    );
    v_count := v_count + 1;
  END LOOP;

  FOR v_holder IN
    SELECT staged.* FROM public.contract_holder_imports AS staged
    WHERE (staged.status = 'expired' AND staged.expires_at <= clock_timestamp() - interval '7 days')
       OR (staged.status = 'consumed' AND staged.consumed_at <= clock_timestamp() - interval '7 days')
    ORDER BY COALESCE(staged.consumed_at, staged.expires_at), staged.id
    LIMIT v_limit FOR UPDATE SKIP LOCKED
  LOOP
    DELETE FROM public.mcp_contract_write_requests AS request
    WHERE request.actor_id = v_holder.actor_id
      AND ((request.operation = 'holder.import.create' AND request.client_request_id = v_holder.create_request_fingerprint)
        OR (request.operation = 'holder.import.consume' AND request.client_request_id = v_holder.consume_request_fingerprint));
    PERFORM public._mcp_audit_contract_person_import(
      'holder', v_holder.id, v_holder.actor_id, v_holder.lead_id,
      v_holder.contract_id, v_holder.contract_holder_id,
      COALESCE(v_holder.consume_request_fingerprint, v_holder.create_request_fingerprint),
      CASE WHEN v_holder.consume_request_fingerprint IS NULL THEN 'holder.import.create' ELSE 'holder.import.consume' END,
      'purged'
    );
    DELETE FROM public.contract_holder_imports AS staged WHERE staged.id = v_holder.id;
    v_count := v_count + 1;
  END LOOP;

  FOR v_dependent IN
    SELECT staged.* FROM public.contract_dependent_imports AS staged
    WHERE (staged.status = 'expired' AND staged.expires_at <= clock_timestamp() - interval '7 days')
       OR (staged.status = 'consumed' AND staged.consumed_at <= clock_timestamp() - interval '7 days')
    ORDER BY COALESCE(staged.consumed_at, staged.expires_at), staged.id
    LIMIT v_limit FOR UPDATE SKIP LOCKED
  LOOP
    DELETE FROM public.mcp_contract_write_requests AS request
    WHERE request.actor_id = v_dependent.actor_id
      AND ((request.operation = 'dependent.import.create' AND request.client_request_id = v_dependent.create_request_fingerprint)
        OR (request.operation = 'dependent.import.consume' AND request.client_request_id = v_dependent.consume_request_fingerprint));
    PERFORM public._mcp_audit_contract_person_import(
      'dependent', v_dependent.id, v_dependent.actor_id, NULL,
      v_dependent.contract_id, v_dependent.holder_id,
      COALESCE(v_dependent.consume_request_fingerprint, v_dependent.create_request_fingerprint),
      CASE WHEN v_dependent.consume_request_fingerprint IS NULL THEN 'dependent.import.create' ELSE 'dependent.import.consume' END,
      'purged'
    );
    DELETE FROM public.contract_dependent_imports AS staged WHERE staged.id = v_dependent.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public._mcp_contract_import_request_fingerprint(uuid, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mcp_create_contract_dependent_from_import(uuid, uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_contract_person_imports(integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mcp_create_contract_dependent_from_import(uuid, uuid, uuid, uuid, text) TO service_role;

COMMENT ON FUNCTION public.mcp_create_contract_dependent_from_import(uuid, uuid, uuid, uuid, text) IS
  'Atomically consumes a staged dependent import into an existing holder, erases staged PII, and returns only entity IDs.';
COMMENT ON TABLE public.contract_dependent_imports IS
  'Short-lived, service-only dependent PII staging. Payload is erased at consume or expiry; non-PII tombstones and idempotency records are retained for at most seven days.';

COMMIT;
