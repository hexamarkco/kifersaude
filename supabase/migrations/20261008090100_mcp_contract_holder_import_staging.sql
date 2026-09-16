BEGIN;

-- Staging requests use the existing idempotency ledger. Only the fixed
-- operations below are accepted; signatures contain IDs and TTLs, never PII.
ALTER TABLE public.mcp_contract_write_requests
  DROP CONSTRAINT IF EXISTS mcp_contract_write_requests_operation_check;
ALTER TABLE public.mcp_contract_write_requests
  ADD CONSTRAINT mcp_contract_write_requests_operation_check
  CHECK (operation IN (
    'contract.create', 'holder.create', 'dependent.create', 'contract.bundle.create',
    'holder.remove', 'dependent.remove', 'contract.adjustment.create',
    'holder.import.create', 'holder.import.consume', 'dependent.import.create'
  ));

CREATE TABLE public.contract_holder_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid,
  contract_id uuid,
  source text CHECK (source IS NULL OR source IN ('mcp', 'chatgpt_mcp', 'automation', 'importer', 'admin_bulk', 'other')),
  create_request_fingerprint text NOT NULL CHECK (
    create_request_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  consume_request_fingerprint text CHECK (
    consume_request_fingerprint IS NULL OR consume_request_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  nome_completo text,
  cpf text,
  rg text,
  data_nascimento date,
  sexo text,
  estado_civil text,
  telefone text,
  email text,
  cep text,
  endereco text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  cns text,
  cnpj text,
  razao_social text,
  nome_fantasia text,
  percentual_societario numeric(5,2),
  data_abertura_cnpj date,
  bonus_por_vida_aplicado boolean,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'consumed', 'expired')),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  contract_holder_id uuid,
  CONSTRAINT contract_holder_imports_actor_request_key
    UNIQUE (actor_id, create_request_fingerprint),
  CONSTRAINT contract_holder_imports_required_fields CHECK (
    status <> 'pending' OR (
      NULLIF(btrim(nome_completo), '') IS NOT NULL
      AND NULLIF(btrim(cpf), '') IS NOT NULL
      AND data_nascimento IS NOT NULL
      AND NULLIF(btrim(telefone), '') IS NOT NULL
    )
  ),
  CONSTRAINT contract_holder_imports_status_pii CHECK (
    (status = 'pending' AND consumed_at IS NULL AND contract_holder_id IS NULL
      AND consume_request_fingerprint IS NULL)
    OR (status = 'consumed' AND consumed_at IS NOT NULL AND contract_holder_id IS NOT NULL
      AND consume_request_fingerprint IS NOT NULL AND source IS NULL
      AND nome_completo IS NULL AND cpf IS NULL AND rg IS NULL AND data_nascimento IS NULL
      AND sexo IS NULL AND estado_civil IS NULL AND telefone IS NULL AND email IS NULL
      AND cep IS NULL AND endereco IS NULL AND numero IS NULL AND complemento IS NULL
      AND bairro IS NULL AND cidade IS NULL AND estado IS NULL AND cns IS NULL
      AND cnpj IS NULL AND razao_social IS NULL AND nome_fantasia IS NULL
      AND percentual_societario IS NULL AND data_abertura_cnpj IS NULL
      AND bonus_por_vida_aplicado IS NULL)
    OR (status = 'expired' AND consumed_at IS NULL AND contract_holder_id IS NULL
      AND consume_request_fingerprint IS NULL AND source IS NULL
      AND nome_completo IS NULL AND cpf IS NULL AND rg IS NULL AND data_nascimento IS NULL
      AND sexo IS NULL AND estado_civil IS NULL AND telefone IS NULL AND email IS NULL
      AND cep IS NULL AND endereco IS NULL AND numero IS NULL AND complemento IS NULL
      AND bairro IS NULL AND cidade IS NULL AND estado IS NULL AND cns IS NULL
      AND cnpj IS NULL AND razao_social IS NULL AND nome_fantasia IS NULL
      AND percentual_societario IS NULL AND data_abertura_cnpj IS NULL
      AND bonus_por_vida_aplicado IS NULL)
  ),
  CONSTRAINT contract_holder_imports_ttl CHECK (
    expires_at > created_at AND expires_at <= created_at + interval '168 hours'
  )
);

CREATE INDEX contract_holder_imports_expiry_idx
  ON public.contract_holder_imports (expires_at, id)
  WHERE status = 'pending';
CREATE INDEX contract_holder_imports_expired_tombstone_idx
  ON public.contract_holder_imports (expires_at, id)
  WHERE status = 'expired';
CREATE INDEX contract_holder_imports_consumed_tombstone_idx
  ON public.contract_holder_imports (consumed_at, id)
  WHERE status = 'consumed';

ALTER TABLE public.contract_holder_imports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.contract_holder_imports FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.contract_dependent_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id uuid,
  holder_id uuid,
  create_request_fingerprint text NOT NULL CHECK (
    create_request_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  nome_completo text,
  cpf text,
  data_nascimento date,
  relacao text,
  elegibilidade text,
  valor_individual numeric(10,2),
  carencia_individual text,
  bonus_por_vida_aplicado boolean,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'consumed', 'expired')),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  dependent_id uuid,
  CONSTRAINT contract_dependent_imports_actor_request_key
    UNIQUE (actor_id, create_request_fingerprint),
  CONSTRAINT contract_dependent_imports_payload_shape CHECK (
    octet_length(concat_ws('|', nome_completo, cpf, data_nascimento::text, relacao,
      elegibilidade, valor_individual::text, carencia_individual,
      bonus_por_vida_aplicado::text)) <= 16384
  ),
  CONSTRAINT contract_dependent_imports_required_fields CHECK (
    status <> 'pending' OR (
      NULLIF(btrim(nome_completo), '') IS NOT NULL
      AND data_nascimento IS NOT NULL
      AND NULLIF(btrim(relacao), '') IS NOT NULL
    )
  ),
  CONSTRAINT contract_dependent_imports_status_payload CHECK (
    (status = 'pending' AND consumed_at IS NULL AND dependent_id IS NULL)
    OR (status = 'consumed' AND consumed_at IS NOT NULL AND dependent_id IS NOT NULL
      AND nome_completo IS NULL AND cpf IS NULL AND data_nascimento IS NULL AND relacao IS NULL
      AND elegibilidade IS NULL AND valor_individual IS NULL AND carencia_individual IS NULL
      AND bonus_por_vida_aplicado IS NULL)
    OR (status = 'expired' AND consumed_at IS NULL AND dependent_id IS NULL
      AND nome_completo IS NULL AND cpf IS NULL AND data_nascimento IS NULL AND relacao IS NULL
      AND elegibilidade IS NULL AND valor_individual IS NULL AND carencia_individual IS NULL
      AND bonus_por_vida_aplicado IS NULL)
  ),
  CONSTRAINT contract_dependent_imports_ttl CHECK (
    expires_at > created_at AND expires_at <= created_at + interval '168 hours'
  ),
  CONSTRAINT contract_dependent_imports_metadata_ids CHECK (
    holder_id IS NULL OR contract_id IS NOT NULL
  )
);

CREATE INDEX contract_dependent_imports_expiry_idx
  ON public.contract_dependent_imports (expires_at, id)
  WHERE status = 'pending';
CREATE INDEX contract_dependent_imports_expired_tombstone_idx
  ON public.contract_dependent_imports (expires_at, id)
  WHERE status = 'expired';
CREATE INDEX contract_dependent_imports_consumed_tombstone_idx
  ON public.contract_dependent_imports (consumed_at, id)
  WHERE status = 'consumed';

ALTER TABLE public.contract_dependent_imports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.contract_dependent_imports FROM PUBLIC, anon, authenticated, service_role;

-- Value-free lifecycle audit. Raw request keys are never stored; the audit
-- keeps only their actor- and operation-scoped SHA-256 fingerprint.
CREATE TABLE public.contract_person_import_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_type text NOT NULL CHECK (import_type IN ('holder', 'dependent')),
  import_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  lead_id uuid,
  contract_id uuid,
  holder_id uuid,
  client_request_id_fingerprint text CHECK (
    client_request_id_fingerprint IS NULL OR client_request_id_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  operation text NOT NULL CHECK (operation IN (
    'holder.import.create', 'holder.import.consume', 'dependent.import.create'
  )),
  action text NOT NULL CHECK (action IN ('created', 'consumed', 'expired', 'purged')),
  result text NOT NULL CHECK (result IN ('success', 'expired', 'purged')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contract_person_import_audit_entity_created_idx
  ON public.contract_person_import_audit_log (import_type, import_id, created_at DESC);
CREATE INDEX contract_person_import_audit_actor_created_idx
  ON public.contract_person_import_audit_log (actor_id, created_at DESC);
ALTER TABLE public.contract_person_import_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.contract_person_import_audit_log FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER contract_person_import_audit_immutable
  BEFORE UPDATE OR DELETE ON public.contract_person_import_audit_log
  FOR EACH ROW EXECUTE FUNCTION public._mcp_contract_audit_no_change();

CREATE OR REPLACE FUNCTION public._mcp_contract_import_missing_fields(
  p_payload jsonb,
  p_import_type text
)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_required_fields text[];
  v_missing_fields text[];
  v_field text;
BEGIN
  CASE p_import_type
    WHEN 'holder' THEN
      v_required_fields := ARRAY['nome_completo', 'cpf', 'data_nascimento', 'telefone'];
    WHEN 'dependent' THEN
      v_required_fields := ARRAY['nome_completo', 'data_nascimento', 'relacao'];
    ELSE
      RAISE EXCEPTION 'MCP_IMPORT_TYPE_INVALID' USING ERRCODE = '22023';
  END CASE;

  FOREACH v_field IN ARRAY v_required_fields LOOP
    IF NULLIF(btrim(p_payload->>v_field), '') IS NULL THEN
      v_missing_fields := array_append(v_missing_fields, v_field);
    END IF;
  END LOOP;
  RETURN COALESCE(v_missing_fields, ARRAY[]::text[]);
END;
$function$;

CREATE OR REPLACE FUNCTION public._mcp_audit_contract_person_import(
  p_import_type text,
  p_import_id uuid,
  p_actor_user_id uuid,
  p_lead_id uuid,
  p_contract_id uuid,
  p_holder_id uuid,
  p_client_request_id_fingerprint text,
  p_operation text,
  p_action text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, extensions
AS $function$
DECLARE
  v_fingerprint text := p_client_request_id_fingerprint;
  v_result text;
BEGIN
  IF v_fingerprint IS NOT NULL AND v_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'MCP_IMPORT_AUDIT_FINGERPRINT_INVALID' USING ERRCODE = '22023';
  END IF;
  v_result := CASE p_action
    WHEN 'created' THEN 'success'
    WHEN 'consumed' THEN 'success'
    WHEN 'expired' THEN 'expired'
    WHEN 'purged' THEN 'purged'
    ELSE NULL
  END;
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'MCP_IMPORT_AUDIT_ACTION_INVALID' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.contract_person_import_audit_log (
    import_type, import_id, actor_id, lead_id, contract_id, holder_id,
    client_request_id_fingerprint, operation, action, result
  ) VALUES (
    p_import_type, p_import_id, p_actor_user_id, p_lead_id, p_contract_id, p_holder_id,
    v_fingerprint, p_operation, p_action, v_result
  );
END;
$function$;

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
    'holder.import.create', 'holder.import.consume', 'dependent.import.create'
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

CREATE OR REPLACE FUNCTION public.create_contract_holder_import(
  p_actor_user_id uuid,
  p_client_request_id text,
  p_holder_payload jsonb,
  p_lead_id uuid DEFAULT NULL,
  p_contract_id uuid DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_ttl_hours integer DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_request jsonb;
  v_import public.contract_holder_imports;
  v_holder_row public.contract_holders;
  v_request_fingerprint text;
  v_normalized_payload jsonb;
  v_existing_payload jsonb;
  v_contract_lead_id uuid;
  v_missing_fields text[];
  v_now timestamptz := clock_timestamp();
  v_result jsonb;
BEGIN
  PERFORM public._mcp_assert_active_contract_admin(p_actor_user_id);
  IF p_ttl_hours IS NULL OR p_ttl_hours NOT BETWEEN 1 AND 168 THEN
    RAISE EXCEPTION 'MCP_INVALID_HOLDER_DATA' USING ERRCODE = '22023';
  END IF;
  IF p_source IS NOT NULL AND p_source NOT IN ('mcp', 'chatgpt_mcp', 'automation', 'importer', 'admin_bulk', 'other') THEN
    RAISE EXCEPTION 'MCP_INVALID_HOLDER_DATA' USING ERRCODE = '22023';
  END IF;
  IF p_holder_payload IS NULL OR octet_length(p_holder_payload::text) > 32768 THEN
    RAISE EXCEPTION 'MCP_INVALID_HOLDER_DATA' USING ERRCODE = '22023';
  END IF;

  BEGIN
    PERFORM public._mcp_validate_holder_payload(p_holder_payload, false);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'MCP_INVALID_HOLDER_DATA' USING ERRCODE = '22023';
  END;
  v_missing_fields := public._mcp_contract_import_missing_fields(p_holder_payload, 'holder');
  IF cardinality(v_missing_fields) > 0 THEN
    RAISE EXCEPTION 'MCP_MISSING_REQUIRED_HOLDER_FIELDS'
      USING ERRCODE = '22023', DETAIL = jsonb_build_object('missing_fields', to_jsonb(v_missing_fields))::text;
  END IF;
  BEGIN
    v_holder_row := jsonb_populate_record(NULL::public.contract_holders, p_holder_payload);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'MCP_INVALID_HOLDER_DATA' USING ERRCODE = '22023';
  END;
  v_normalized_payload := jsonb_strip_nulls(
    to_jsonb(v_holder_row) - ARRAY['id', 'contract_id', 'created_at', 'updated_at']::text[]
  );
  v_request_fingerprint := public._mcp_contract_import_request_fingerprint(
    p_actor_user_id, 'holder.import.create', p_client_request_id
  );

  v_request := public._mcp_begin_contract_write_request(
    p_actor_user_id, 'holder.import.create', v_request_fingerprint,
    jsonb_build_object(
      'lead_id', p_lead_id, 'contract_id', p_contract_id,
      'source', p_source, 'ttl_hours', p_ttl_hours
    )
  );
  IF (v_request->>'replayed')::boolean THEN
    SELECT * INTO v_import
    FROM public.contract_holder_imports AS staged
    WHERE staged.id = NULLIF(v_request->'result'->>'import_id', '')::uuid
      AND staged.actor_id = p_actor_user_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'MCP_IMPORT_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    IF v_import.status = 'consumed' THEN
      RAISE EXCEPTION 'MCP_IMPORT_ALREADY_CONSUMED' USING ERRCODE = '55000';
    END IF;
    IF v_import.status = 'expired' OR v_import.expires_at <= clock_timestamp() THEN
      RAISE EXCEPTION 'MCP_IMPORT_EXPIRED' USING ERRCODE = '55000';
    END IF;
    v_existing_payload := jsonb_strip_nulls(to_jsonb(v_import) - ARRAY[
      'id', 'actor_id', 'lead_id', 'contract_id', 'source',
      'create_request_fingerprint', 'consume_request_fingerprint', 'status',
      'created_at', 'updated_at', 'expires_at', 'consumed_at', 'contract_holder_id'
    ]::text[]);
    IF v_existing_payload IS DISTINCT FROM v_normalized_payload THEN
      RAISE EXCEPTION 'MCP_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD' USING ERRCODE = '22023';
    END IF;
    IF v_import.contract_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.contracts AS contract WHERE contract.id = v_import.contract_id
    ) THEN
      RAISE EXCEPTION 'MCP_CONTRACT_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    RETURN jsonb_build_object(
      'success', true, 'import_id', v_import.id,
      'expires_at', v_import.expires_at, 'replayed', true
    );
  END IF;

  IF p_lead_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.leads AS lead WHERE lead.id = p_lead_id
  ) THEN
    RAISE EXCEPTION 'MCP_LEAD_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF p_contract_id IS NOT NULL THEN
    SELECT contract.lead_id INTO v_contract_lead_id
    FROM public.contracts AS contract
    WHERE contract.id = p_contract_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'MCP_CONTRACT_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    IF p_lead_id IS NOT NULL AND v_contract_lead_id IS DISTINCT FROM p_lead_id THEN
      RAISE EXCEPTION 'MCP_IMPORT_CONTRACT_MISMATCH' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (SELECT 1 FROM public.contract_holders AS holder WHERE holder.contract_id = p_contract_id) THEN
      RAISE EXCEPTION 'MCP_CONTRACT_ALREADY_HAS_HOLDER' USING ERRCODE = '22023';
    END IF;
  END IF;

  v_now := clock_timestamp();
  INSERT INTO public.contract_holder_imports (
    actor_id, lead_id, contract_id, source, create_request_fingerprint,
    nome_completo, cpf, rg, data_nascimento, sexo, estado_civil, telefone,
    email, cep, endereco, numero, complemento, bairro, cidade, estado, cns,
    cnpj, razao_social, nome_fantasia, percentual_societario,
    data_abertura_cnpj, bonus_por_vida_aplicado,
    status, created_at, updated_at, expires_at
  ) VALUES (
    p_actor_user_id, p_lead_id, p_contract_id, p_source,
    v_request_fingerprint,
    v_holder_row.nome_completo, v_holder_row.cpf, v_holder_row.rg,
    v_holder_row.data_nascimento, v_holder_row.sexo, v_holder_row.estado_civil,
    v_holder_row.telefone, v_holder_row.email, v_holder_row.cep, v_holder_row.endereco,
    v_holder_row.numero, v_holder_row.complemento, v_holder_row.bairro, v_holder_row.cidade,
    v_holder_row.estado, v_holder_row.cns, v_holder_row.cnpj, v_holder_row.razao_social,
    v_holder_row.nome_fantasia, v_holder_row.percentual_societario,
    v_holder_row.data_abertura_cnpj, v_holder_row.bonus_por_vida_aplicado,
    'pending', v_now, v_now, v_now + make_interval(hours => p_ttl_hours)
  ) RETURNING * INTO v_import;

  PERFORM public._mcp_audit_contract_person_import(
    'holder', v_import.id, p_actor_user_id, p_lead_id, p_contract_id,
    NULL, v_request_fingerprint, 'holder.import.create', 'created'
  );

  v_result := jsonb_build_object(
    'success', true, 'import_id', v_import.id, 'expires_at', v_import.expires_at
  );
  PERFORM public._mcp_complete_contract_write_request(
    p_actor_user_id, 'holder.import.create', v_request_fingerprint, v_result
  );
  RETURN v_result || jsonb_build_object('replayed', false);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'MCP_DUPLICATE_HOLDER' USING ERRCODE = '23505';
END;
$function$;

CREATE OR REPLACE FUNCTION public.mcp_create_contract_holder_from_import(
  p_actor_user_id uuid,
  p_import_id uuid,
  p_contract_id uuid,
  p_client_request_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_request jsonb;
  v_import public.contract_holder_imports;
  v_contract public.contracts;
  v_holder public.contract_holders;
  v_holder_payload jsonb;
  v_request_fingerprint text;
  v_result jsonb;
BEGIN
  PERFORM public._mcp_assert_active_contract_admin(p_actor_user_id);
  IF p_import_id IS NULL OR p_contract_id IS NULL THEN
    RAISE EXCEPTION 'MCP_INVALID_HOLDER_DATA' USING ERRCODE = '22023';
  END IF;
  v_request_fingerprint := public._mcp_contract_import_request_fingerprint(
    p_actor_user_id, 'holder.import.consume', p_client_request_id
  );
  v_request := public._mcp_begin_contract_write_request(
    p_actor_user_id, 'holder.import.consume', v_request_fingerprint,
    jsonb_build_object('import_id', p_import_id, 'contract_id', p_contract_id)
  );
  IF (v_request->>'replayed')::boolean THEN
    RETURN (v_request->'result') || jsonb_build_object('replayed', true);
  END IF;

  SELECT * INTO v_import
  FROM public.contract_holder_imports AS staged
  WHERE staged.id = p_import_id
    AND staged.actor_id = p_actor_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MCP_IMPORT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_import.contract_id IS NOT NULL AND v_import.contract_id IS DISTINCT FROM p_contract_id THEN
    RAISE EXCEPTION 'MCP_IMPORT_CONTRACT_MISMATCH' USING ERRCODE = '22023';
  END IF;
  IF v_import.status = 'consumed' THEN
    RAISE EXCEPTION 'MCP_IMPORT_ALREADY_CONSUMED' USING ERRCODE = '55000';
  END IF;
  IF v_import.status = 'expired' OR v_import.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'MCP_IMPORT_EXPIRED' USING ERRCODE = '55000';
  END IF;

  SELECT * INTO v_contract
  FROM public.contracts AS contract
  WHERE contract.id = p_contract_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MCP_CONTRACT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_import.lead_id IS NOT NULL AND v_contract.lead_id IS DISTINCT FROM v_import.lead_id THEN
    RAISE EXCEPTION 'MCP_IMPORT_CONTRACT_MISMATCH' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.contract_holders AS holder
    WHERE holder.contract_id = p_contract_id
  ) THEN
    RAISE EXCEPTION 'MCP_CONTRACT_ALREADY_HAS_HOLDER' USING ERRCODE = '22023';
  END IF;

  v_holder_payload := jsonb_strip_nulls(to_jsonb(v_import) - ARRAY[
    'id', 'actor_id', 'lead_id', 'contract_id', 'source',
    'create_request_fingerprint', 'consume_request_fingerprint', 'status',
    'created_at', 'updated_at', 'expires_at', 'consumed_at', 'contract_holder_id'
  ]::text[]);

  -- The mutation audit trigger records this opaque UUID instead of a caller
  -- supplied idempotency key, which may contain a client's name.
  PERFORM set_config('mcp.contract_client_request_id', v_import.id::text, true);
  BEGIN
    v_holder := public._mcp_insert_holder(p_contract_id, v_holder_payload);
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
        RAISE EXCEPTION 'MCP_DUPLICATE_HOLDER' USING ERRCODE = '23505';
      END IF;
      RAISE EXCEPTION 'MCP_INVALID_HOLDER_DATA' USING ERRCODE = '22023';
    END;
  END;

  UPDATE public.contract_holder_imports AS staged
     SET status = 'consumed',
         source = NULL,
         nome_completo = NULL, cpf = NULL, rg = NULL, data_nascimento = NULL,
         sexo = NULL, estado_civil = NULL, telefone = NULL, email = NULL,
         cep = NULL, endereco = NULL, numero = NULL, complemento = NULL,
         bairro = NULL, cidade = NULL, estado = NULL, cns = NULL, cnpj = NULL,
         razao_social = NULL, nome_fantasia = NULL, percentual_societario = NULL,
         data_abertura_cnpj = NULL, bonus_por_vida_aplicado = NULL,
         consumed_at = clock_timestamp(),
         contract_holder_id = v_holder.id,
         consume_request_fingerprint = v_request_fingerprint,
         updated_at = clock_timestamp()
   WHERE staged.id = v_import.id;

  PERFORM public._mcp_audit_contract_person_import(
    'holder', v_import.id, p_actor_user_id, v_import.lead_id,
    p_contract_id, v_holder.id, v_request_fingerprint,
    'holder.import.consume', 'consumed'
  );

  v_result := jsonb_build_object(
    'success', true,
    'import_id', v_import.id,
    'contract_id', v_holder.contract_id,
    'holder_id', v_holder.id
  );
  PERFORM public._mcp_complete_contract_write_request(
    p_actor_user_id, 'holder.import.consume', v_request_fingerprint, v_result
  );
  RETURN v_result || jsonb_build_object('replayed', false);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'MCP_DUPLICATE_HOLDER' USING ERRCODE = '23505';
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_contract_dependent_import(
  p_actor_user_id uuid,
  p_client_request_id text,
  p_payload jsonb,
  p_ttl_hours integer DEFAULT 24,
  p_contract_id uuid DEFAULT NULL,
  p_holder_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_request jsonb;
  v_import public.contract_dependent_imports;
  v_dependent_row public.dependents;
  v_request_fingerprint text;
  v_normalized_payload jsonb;
  v_existing_payload jsonb;
  v_contract_id uuid := p_contract_id;
  v_holder_contract_id uuid;
  v_missing_fields text[];
  v_now timestamptz := clock_timestamp();
  v_result jsonb;
BEGIN
  PERFORM public._mcp_assert_active_contract_admin(p_actor_user_id);
  IF p_ttl_hours IS NULL OR p_ttl_hours NOT BETWEEN 1 AND 168 THEN
    RAISE EXCEPTION 'MCP_INVALID_DEPENDENT_DATA' USING ERRCODE = '22023';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR octet_length(p_payload::text) > 16384 THEN
    RAISE EXCEPTION 'MCP_INVALID_DEPENDENT_DATA' USING ERRCODE = '22023';
  END IF;

  PERFORM public._mcp_assert_contract_payload_keys(
    p_payload,
    ARRAY[
      'nome_completo', 'cpf', 'data_nascimento', 'relacao', 'elegibilidade',
      'valor_individual', 'carencia_individual', 'bonus_por_vida_aplicado'
    ]
  );
  v_missing_fields := public._mcp_contract_import_missing_fields(p_payload, 'dependent');
  IF cardinality(v_missing_fields) > 0 THEN
    RAISE EXCEPTION 'MCP_REQUIRED_DEPENDENT_FIELD_MISSING'
      USING ERRCODE = '22023', DETAIL = jsonb_build_object('missing_fields', to_jsonb(v_missing_fields))::text;
  END IF;
  BEGIN
    PERFORM public._mcp_validate_dependent_payload(p_payload);
  EXCEPTION WHEN OTHERS THEN
    DECLARE
      v_error_message text;
      v_error_state text;
    BEGIN
      GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT, v_error_state = RETURNED_SQLSTATE;
      IF v_error_message ~ '^MCP_[A-Z0-9_]+$' THEN
        RAISE EXCEPTION '%', v_error_message USING ERRCODE = v_error_state;
      END IF;
      RAISE EXCEPTION 'MCP_CONTRACT_DEPENDENT_IMPORT_INVALID' USING ERRCODE = '22023';
    END;
  END;

  BEGIN
    v_dependent_row := jsonb_populate_record(NULL::public.dependents, p_payload);
    v_dependent_row.bonus_por_vida_aplicado := COALESCE(v_dependent_row.bonus_por_vida_aplicado, false);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'MCP_INVALID_DEPENDENT_DATA' USING ERRCODE = '22023';
  END;
  v_normalized_payload := jsonb_strip_nulls(
    to_jsonb(v_dependent_row) - ARRAY['id', 'contract_id', 'holder_id', 'created_at', 'updated_at']::text[]
  );
  v_request_fingerprint := public._mcp_contract_import_request_fingerprint(
    p_actor_user_id, 'dependent.import.create', p_client_request_id
  );

  v_request := public._mcp_begin_contract_write_request(
    p_actor_user_id, 'dependent.import.create', v_request_fingerprint,
    jsonb_build_object(
      'contract_id', v_contract_id,
      'holder_id', p_holder_id,
      'ttl_hours', p_ttl_hours
    )
  );
  IF (v_request->>'replayed')::boolean THEN
    SELECT * INTO v_import
    FROM public.contract_dependent_imports AS staged
    WHERE staged.id = NULLIF(v_request->'result'->>'import_id', '')::uuid
      AND staged.actor_id = p_actor_user_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'MCP_IMPORT_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    IF v_import.status = 'consumed' THEN
      RAISE EXCEPTION 'MCP_IMPORT_ALREADY_CONSUMED' USING ERRCODE = '55000';
    END IF;
    IF v_import.status = 'expired' OR v_import.expires_at <= clock_timestamp() THEN
      RAISE EXCEPTION 'MCP_IMPORT_EXPIRED' USING ERRCODE = '55000';
    END IF;
    v_existing_payload := jsonb_strip_nulls(to_jsonb(v_import) - ARRAY[
      'id', 'actor_id', 'contract_id', 'holder_id', 'create_request_fingerprint',
      'status', 'created_at', 'updated_at', 'expires_at', 'consumed_at', 'dependent_id'
    ]::text[]);
    IF v_existing_payload IS DISTINCT FROM v_normalized_payload THEN
      RAISE EXCEPTION 'MCP_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_strip_nulls(jsonb_build_object(
      'success', true,
      'import_id', v_import.id,
      'contract_id', v_import.contract_id,
      'holder_id', v_import.holder_id,
      'expires_at', v_import.expires_at,
      'replayed', true
    ));
  END IF;

  IF p_holder_id IS NOT NULL THEN
    SELECT holder.contract_id INTO v_holder_contract_id
    FROM public.contract_holders AS holder
    WHERE holder.id = p_holder_id
    FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'MCP_HOLDER_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    IF v_contract_id IS NOT NULL AND v_contract_id IS DISTINCT FROM v_holder_contract_id THEN
      RAISE EXCEPTION 'MCP_HOLDER_CONTRACT_MISMATCH' USING ERRCODE = '22023';
    END IF;
    v_contract_id := COALESCE(v_contract_id, v_holder_contract_id);
  END IF;
  IF v_contract_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.contracts AS contract WHERE contract.id = v_contract_id
  ) THEN
    RAISE EXCEPTION 'MCP_CONTRACT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  v_now := clock_timestamp();
  INSERT INTO public.contract_dependent_imports (
    actor_id, contract_id, holder_id, create_request_fingerprint,
    nome_completo, cpf, data_nascimento, relacao, elegibilidade,
    valor_individual, carencia_individual, bonus_por_vida_aplicado,
    status, created_at, updated_at, expires_at
  ) VALUES (
    p_actor_user_id, v_contract_id, p_holder_id, v_request_fingerprint,
    v_dependent_row.nome_completo, v_dependent_row.cpf, v_dependent_row.data_nascimento,
    v_dependent_row.relacao, v_dependent_row.elegibilidade, v_dependent_row.valor_individual,
    v_dependent_row.carencia_individual, v_dependent_row.bonus_por_vida_aplicado,
    'pending', v_now, v_now, v_now + make_interval(hours => p_ttl_hours)
  ) RETURNING * INTO v_import;

  PERFORM public._mcp_audit_contract_person_import(
    'dependent', v_import.id, p_actor_user_id, NULL, v_contract_id, p_holder_id,
    v_request_fingerprint, 'dependent.import.create', 'created'
  );

  v_result := jsonb_strip_nulls(jsonb_build_object(
    'success', true,
    'import_id', v_import.id,
    'contract_id', v_import.contract_id,
    'holder_id', v_import.holder_id,
    'expires_at', v_import.expires_at
  ));
  PERFORM public._mcp_complete_contract_write_request(
    p_actor_user_id, 'dependent.import.create', v_request_fingerprint, v_result
  );
  RETURN v_result || jsonb_build_object('replayed', false);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'MCP_CONTRACT_DEPENDENT_IMPORT_DUPLICATE' USING ERRCODE = '23505';
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_contract_person_imports(
  p_batch_limit integer DEFAULT 500
)
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
    SELECT staged.*
    FROM public.contract_holder_imports AS staged
    WHERE staged.status = 'pending' AND staged.expires_at <= clock_timestamp()
    ORDER BY staged.expires_at, staged.id
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.contract_holder_imports AS staged
       SET status = 'expired', source = NULL,
           nome_completo = NULL, cpf = NULL, rg = NULL, data_nascimento = NULL,
           sexo = NULL, estado_civil = NULL, telefone = NULL, email = NULL,
           cep = NULL, endereco = NULL, numero = NULL, complemento = NULL,
           bairro = NULL, cidade = NULL, estado = NULL, cns = NULL, cnpj = NULL,
           razao_social = NULL, nome_fantasia = NULL, percentual_societario = NULL,
           data_abertura_cnpj = NULL, bonus_por_vida_aplicado = NULL,
           updated_at = clock_timestamp()
     WHERE staged.id = v_holder.id;
    PERFORM public._mcp_audit_contract_person_import(
      'holder', v_holder.id, v_holder.actor_id, v_holder.lead_id,
      v_holder.contract_id, NULL, v_holder.create_request_fingerprint,
      'holder.import.create', 'expired'
    );
    v_count := v_count + 1;
  END LOOP;

  FOR v_dependent IN
    SELECT staged.*
    FROM public.contract_dependent_imports AS staged
    WHERE staged.status = 'pending' AND staged.expires_at <= clock_timestamp()
    ORDER BY staged.expires_at, staged.id
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.contract_dependent_imports AS staged
       SET status = 'expired',
           nome_completo = NULL, cpf = NULL, data_nascimento = NULL,
           relacao = NULL, elegibilidade = NULL, valor_individual = NULL,
           carencia_individual = NULL, bonus_por_vida_aplicado = NULL,
           updated_at = clock_timestamp()
     WHERE staged.id = v_dependent.id;
    PERFORM public._mcp_audit_contract_person_import(
      'dependent', v_dependent.id, v_dependent.actor_id, NULL,
      v_dependent.contract_id, v_dependent.holder_id,
      v_dependent.create_request_fingerprint,
      'dependent.import.create', 'expired'
    );
    v_count := v_count + 1;
  END LOOP;

  FOR v_holder IN
    SELECT staged.*
    FROM public.contract_holder_imports AS staged
    WHERE (staged.status = 'expired' AND staged.expires_at <= clock_timestamp() - interval '7 days')
       OR (staged.status = 'consumed' AND staged.consumed_at <= clock_timestamp() - interval '7 days')
    ORDER BY COALESCE(staged.consumed_at, staged.expires_at), staged.id
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    DELETE FROM public.mcp_contract_write_requests AS request
    WHERE request.actor_id = v_holder.actor_id
      AND ((request.operation = 'holder.import.create'
            AND request.client_request_id = v_holder.create_request_fingerprint)
        OR (request.operation = 'holder.import.consume'
            AND request.client_request_id = v_holder.consume_request_fingerprint));
    PERFORM public._mcp_audit_contract_person_import(
      'holder', v_holder.id, v_holder.actor_id, v_holder.lead_id,
      v_holder.contract_id, v_holder.contract_holder_id,
      COALESCE(v_holder.consume_request_fingerprint, v_holder.create_request_fingerprint),
      CASE WHEN v_holder.consume_request_fingerprint IS NULL
        THEN 'holder.import.create' ELSE 'holder.import.consume' END,
      'purged'
    );
    DELETE FROM public.contract_holder_imports AS staged WHERE staged.id = v_holder.id;
    v_count := v_count + 1;
  END LOOP;

  FOR v_dependent IN
    SELECT staged.*
    FROM public.contract_dependent_imports AS staged
    WHERE (staged.status = 'expired' AND staged.expires_at <= clock_timestamp() - interval '7 days')
       OR (staged.status = 'consumed' AND staged.consumed_at <= clock_timestamp() - interval '7 days')
    ORDER BY COALESCE(staged.consumed_at, staged.expires_at), staged.id
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    DELETE FROM public.mcp_contract_write_requests AS request
    WHERE request.actor_id = v_dependent.actor_id
      AND request.operation = 'dependent.import.create'
      AND request.client_request_id = v_dependent.create_request_fingerprint;
    PERFORM public._mcp_audit_contract_person_import(
      'dependent', v_dependent.id, v_dependent.actor_id, NULL,
      v_dependent.contract_id, v_dependent.holder_id,
      v_dependent.create_request_fingerprint,
      'dependent.import.create', 'purged'
    );
    DELETE FROM public.contract_dependent_imports AS staged WHERE staged.id = v_dependent.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public._mcp_contract_import_missing_fields(jsonb, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._mcp_audit_contract_person_import(text, uuid, uuid, uuid, uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public._mcp_contract_import_request_fingerprint(uuid, text, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_contract_holder_import(uuid, text, jsonb, uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mcp_create_contract_holder_from_import(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_contract_dependent_import(uuid, text, jsonb, integer, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_contract_person_imports(integer) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.create_contract_holder_import(uuid, text, jsonb, uuid, uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.mcp_create_contract_holder_from_import(uuid, uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_contract_dependent_import(uuid, text, jsonb, integer, uuid, uuid) TO service_role;

COMMENT ON TABLE public.contract_holder_imports IS
  'Short-lived, service-only holder PII staging. Payload is erased at consume or expiry; non-PII tombstones are retained for at most seven days after that event.';
COMMENT ON TABLE public.contract_dependent_imports IS
  'Short-lived, service-only dependent PII staging. Payload is erased at expiry; non-PII tombstones are retained for at most seven days after that event.';
COMMENT ON FUNCTION public.create_contract_holder_import(uuid, text, jsonb, uuid, uuid, text, integer) IS
  'Stages holder fields for up to 168 hours, requiring a current admin actor and idempotent client request.';
COMMENT ON FUNCTION public.mcp_create_contract_holder_from_import(uuid, uuid, uuid, text) IS
  'Atomically consumes a staged holder import into an existing contract, erases staged PII, and returns only entity IDs.';
COMMENT ON FUNCTION public.create_contract_dependent_import(uuid, text, jsonb, integer, uuid, uuid) IS
  'Stages dependent fields and optional contract/holder IDs for up to 168 hours; no import consumer is enabled yet.';
COMMENT ON FUNCTION public.cleanup_contract_person_imports(integer) IS
  'Expires and erases staged holder/dependent PII in bounded batches, then deletes tombstones and idempotency records after seven days.';

DO $scheduler$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'pg_cron extension unavailable, skipping contract-person-import cleanup schedule.';
  END;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-contract-person-imports-hourly') THEN
      PERFORM cron.unschedule('cleanup-contract-person-imports-hourly');
    END IF;
    PERFORM cron.schedule(
      'cleanup-contract-person-imports-hourly',
      '17 * * * *',
      $job$SELECT public.cleanup_contract_person_imports();$job$
    );
  END IF;
END $scheduler$;

COMMIT;
