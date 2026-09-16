BEGIN;
SET LOCAL search_path = extensions, public, pg_catalog;
SELECT no_plan();

-- The migration defines the whole import boundary with typed columns and
-- security-definer RPCs. These catalog checks are deliberately independent of
-- local user data and verify no client-facing role can inspect staged PII.
SELECT ok(to_regclass('public.contract_holder_imports') IS NOT NULL, 'holder import table exists');
SELECT ok(to_regclass('public.contract_dependent_imports') IS NOT NULL, 'dependent import table exists');
SELECT ok(to_regclass('public.contract_person_import_audit_log') IS NOT NULL, 'value-free import audit table exists');

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.contract_holder_imports'::regclass),
  'holder staging has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.contract_dependent_imports'::regclass),
  'dependent staging has RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.contract_person_import_audit_log'::regclass),
  'import audit has RLS enabled'
);
SELECT ok(NOT has_table_privilege('service_role', 'public.contract_holder_imports', 'SELECT'), 'service_role cannot read holder staging directly');
SELECT ok(NOT has_table_privilege('service_role', 'public.contract_holder_imports', 'INSERT'), 'service_role cannot insert holder staging directly');
SELECT ok(NOT has_table_privilege('service_role', 'public.contract_holder_imports', 'UPDATE'), 'service_role cannot update holder staging directly');
SELECT ok(NOT has_table_privilege('service_role', 'public.contract_holder_imports', 'DELETE'), 'service_role cannot delete holder staging directly');
SELECT ok(NOT has_table_privilege('authenticated', 'public.contract_holder_imports', 'SELECT'), 'authenticated cannot read holder staging');
SELECT ok(NOT has_table_privilege('anon', 'public.contract_holder_imports', 'SELECT'), 'anon cannot read holder staging');
SELECT ok(NOT has_table_privilege('service_role', 'public.contract_dependent_imports', 'SELECT'), 'service_role cannot read dependent staging directly');
SELECT ok(NOT has_table_privilege('service_role', 'public.contract_person_import_audit_log', 'SELECT'), 'service_role cannot read import audit directly');

SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid IN ('public.contract_holder_imports'::regclass, 'public.contract_dependent_imports'::regclass)
      AND attnum > 0 AND NOT attisdropped AND atttypid IN ('json'::regtype, 'jsonb'::regtype)
  ),
  'staged holder and dependent fields are typed columns, not JSON payload blobs'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.contract_holder_imports'::regclass
      AND attname IN ('lead_id', 'contract_id') AND attnotnull
  ),
  'holder import lead and contract bindings are optional'
);
SELECT ok(
  (SELECT count(*) = 23 FROM pg_attribute
   WHERE attrelid = 'public.contract_holder_imports'::regclass
     AND attnum > 0 AND NOT attisdropped
     AND attname = ANY (ARRAY[
       'nome_completo', 'cpf', 'rg', 'data_nascimento', 'sexo', 'estado_civil',
       'telefone', 'email', 'cep', 'endereco', 'numero', 'complemento', 'bairro',
       'cidade', 'estado', 'cns', 'cnpj', 'razao_social', 'nome_fantasia',
       'percentual_societario', 'data_abertura_cnpj', 'bonus_por_vida_aplicado', 'source'
     ])),
  'holder staging contains its typed holder fields and bounded source field'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.contract_person_import_audit_log'::regclass
      AND attnum > 0 AND NOT attisdropped
      AND attname = ANY (ARRAY[
        'cpf', 'nome_completo', 'telefone', 'email', 'endereco', 'raw_client_request_id',
        'client_request_id', 'holder_payload', 'dependent_payload'
      ])
  ),
  'import audit schema has no PII or raw request key columns'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.contract_person_import_audit_log'::regclass
      AND attname = 'client_request_id_fingerprint' AND NOT attisdropped
  ),
  'import audit stores only a request fingerprint'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.contract_holder_imports'::regclass
      AND conname = 'contract_holder_imports_ttl'
      AND position('168' IN pg_get_constraintdef(oid)) > 0
  ),
  'holder staging caps TTL at 168 hours'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.contract_holder_imports'::regclass
      AND conname = 'contract_holder_imports_status_pii'
  ),
  'holder status constraint requires PII to be erased after consume or expiry'
);
SELECT ok(
  position('missing_fields' IN pg_get_functiondef('public.create_contract_holder_import(uuid,text,jsonb,uuid,uuid,text,integer)'::regprocedure)) > 0,
  'holder validation error detail is limited to missing field names'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.contract_person_import_audit_log'::regclass
      AND tgname = 'contract_person_import_audit_immutable' AND NOT tgisinternal
  ),
  'import lifecycle audit is append-only'
);

SELECT ok(to_regprocedure('public.create_contract_holder_import(uuid,text,jsonb,uuid,uuid,text,integer)') IS NOT NULL, 'holder staging RPC has the expected signature');
SELECT ok(to_regprocedure('public.mcp_create_contract_holder_from_import(uuid,uuid,uuid,text)') IS NOT NULL, 'holder consume RPC has the expected signature');
SELECT ok(to_regprocedure('public.create_contract_dependent_import(uuid,text,jsonb,integer,uuid,uuid)') IS NOT NULL, 'dependent staging RPC has the expected signature');
SELECT ok(to_regprocedure('public.cleanup_contract_person_imports(integer)') IS NOT NULL, 'bounded import cleanup function exists');

SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.create_contract_holder_import(uuid,text,jsonb,uuid,uuid,text,integer)'::regprocedure), 'holder staging is SECURITY DEFINER');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.mcp_create_contract_holder_from_import(uuid,uuid,uuid,text)'::regprocedure), 'holder consume is SECURITY DEFINER');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.create_contract_dependent_import(uuid,text,jsonb,integer,uuid,uuid)'::regprocedure), 'dependent staging is SECURITY DEFINER');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.cleanup_contract_person_imports(integer)'::regprocedure), 'cleanup is SECURITY DEFINER');
SELECT ok(
  (SELECT bool_and(proconfig @> ARRAY['search_path=""'])
   FROM pg_proc
   WHERE oid IN (
     'public.create_contract_holder_import(uuid,text,jsonb,uuid,uuid,text,integer)'::regprocedure,
     'public.mcp_create_contract_holder_from_import(uuid,uuid,uuid,text)'::regprocedure,
     'public.create_contract_dependent_import(uuid,text,jsonb,integer,uuid,uuid)'::regprocedure,
     'public.cleanup_contract_person_imports(integer)'::regprocedure
   )),
  'all security-definer functions pin an empty search_path'
);
SELECT ok(has_function_privilege('service_role', 'public.create_contract_holder_import(uuid,text,jsonb,uuid,uuid,text,integer)'::regprocedure, 'EXECUTE'), 'service_role can stage holders through the RPC');
SELECT ok(has_function_privilege('service_role', 'public.mcp_create_contract_holder_from_import(uuid,uuid,uuid,text)'::regprocedure, 'EXECUTE'), 'service_role can consume holders through the RPC');
SELECT ok(has_function_privilege('service_role', 'public.create_contract_dependent_import(uuid,text,jsonb,integer,uuid,uuid)'::regprocedure, 'EXECUTE'), 'service_role can stage dependents through the RPC');
SELECT ok(NOT has_function_privilege('anon', 'public.create_contract_holder_import(uuid,text,jsonb,uuid,uuid,text,integer)'::regprocedure, 'EXECUTE'), 'anon cannot stage holders');
SELECT ok(NOT has_function_privilege('authenticated', 'public.create_contract_holder_import(uuid,text,jsonb,uuid,uuid,text,integer)'::regprocedure, 'EXECUTE'), 'authenticated cannot stage holders');
SELECT ok(NOT has_function_privilege('anon', 'public.mcp_create_contract_holder_from_import(uuid,uuid,uuid,text)'::regprocedure, 'EXECUTE'), 'anon cannot consume staged holders');
SELECT ok(NOT has_function_privilege('authenticated', 'public.mcp_create_contract_holder_from_import(uuid,uuid,uuid,text)'::regprocedure, 'EXECUTE'), 'authenticated cannot consume staged holders');
SELECT ok(NOT has_function_privilege('service_role', 'public._mcp_audit_contract_person_import(text,uuid,uuid,uuid,uuid,uuid,text,text,text)'::regprocedure, 'EXECUTE'), 'service_role cannot call the audit helper directly');
SELECT ok(NOT has_function_privilege('service_role', 'public._mcp_contract_import_request_fingerprint(uuid,text,text)'::regprocedure, 'EXECUTE'), 'service_role cannot call the fingerprint helper directly');
SELECT ok(NOT has_function_privilege('service_role', 'public.cleanup_contract_person_imports(integer)'::regprocedure, 'EXECUTE'), 'cleanup is not directly callable by service_role');
SELECT ok(
  position('FOR UPDATE SKIP LOCKED' IN pg_get_functiondef('public.cleanup_contract_person_imports(integer)'::regprocedure)) > 0
    AND position('7 days' IN pg_get_functiondef('public.cleanup_contract_person_imports(integer)'::regprocedure)) > 0,
  'cleanup uses bounded row locks and retains tombstones for seven days'
);
SELECT ok(
  position('source = NULL' IN pg_get_functiondef('public.cleanup_contract_person_imports(integer)'::regprocedure)) > 0
    AND position('nome_completo = NULL' IN pg_get_functiondef('public.cleanup_contract_person_imports(integer)'::regprocedure)) > 0,
  'cleanup redacts source and typed holder PII on expiry'
);

SELECT is(
  public._mcp_contract_import_missing_fields('{}'::jsonb, 'holder'),
  ARRAY['nome_completo', 'cpf', 'data_nascimento', 'telefone']::text[],
  'missing holder fields expose field names only'
);
SELECT is(
  public._mcp_contract_import_missing_fields('{}'::jsonb, 'dependent'),
  ARRAY['nome_completo', 'data_nascimento', 'relacao']::text[],
  'missing dependent fields expose field names only'
);
SELECT ok(
  public._mcp_contract_import_request_fingerprint(
    '11111111-1111-4111-8111-111111111111'::uuid,
    'holder.import.create',
    'stable-test-key'
  ) ~ '^[0-9a-f]{64}$',
  'request fingerprint is a SHA-256 hex digest'
);
SELECT throws_ok(
  $$SELECT public._mcp_contract_import_request_fingerprint('11111111-1111-4111-8111-111111111111'::uuid, 'not.allowed', 'stable-test-key')$$,
  '22023', 'MCP_IMPORT_OPERATION_NOT_ALLOWED', 'request fingerprint rejects unapproved operations'
);

-- A fake auth/profile fixture is isolated to this rolled-back test transaction.
-- Replication mode suppresses app triggers/FK trigger checks so the fixture does
-- not depend on the project's external User Management schema implementation.
SET LOCAL session_replication_role = replica;
INSERT INTO auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated',
  'mcp-import-test@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
);
DO $fixture$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.user_profiles'::regclass
      AND attname = 'username' AND attnum > 0 AND NOT attisdropped
  ) THEN
    EXECUTE $sql$
      INSERT INTO public.user_profiles (id, email, username, role, created_at)
      VALUES ('11111111-1111-4111-8111-111111111111',
        'mcp-import-test@example.invalid', 'mcp_import_test_actor', 'admin', now())
    $sql$;
  ELSE
    INSERT INTO public.user_profiles (id, email, role, created_at)
    VALUES (
      '11111111-1111-4111-8111-111111111111',
      'mcp-import-test@example.invalid', 'admin', now()
    );
  END IF;
END;
$fixture$;
SET LOCAL session_replication_role = origin;

INSERT INTO public.contracts (
  id, codigo_contrato, status, modalidade, operadora, produto_plano, responsavel
) VALUES
  ('22222222-2222-4222-8222-222222222222', 'TEST-MCP-IMPORT-ROLLBACK', 'Ativo', 'Adesão', 'Teste', 'Plano teste', 'Teste'),
  ('33333333-3333-4333-8333-333333333333', 'TEST-MCP-IMPORT-MISMATCH', 'Ativo', 'Adesão', 'Teste', 'Plano teste', 'Teste'),
  ('44444444-4444-4444-8444-444444444444', 'TEST-MCP-IMPORT-HAS-HOLDER', 'Ativo', 'Adesão', 'Teste', 'Plano teste', 'Teste');
INSERT INTO public.contract_holders (
  contract_id, nome_completo, cpf, data_nascimento, telefone
) VALUES (
  '44444444-4444-4444-8444-444444444444', 'TEST HOLDER', '00000000000', DATE '1980-01-01', '11900000000'
);
INSERT INTO public.leads (
  id, nome_completo, telefone, origem, tipo_contratacao, responsavel
) VALUES
  ('55555555-5555-4555-8555-555555555555', 'MCP TEST LEAD A', '11900000005', 'Teste', 'Adesão', 'Teste'),
  ('66666666-6666-4666-8666-666666666666', 'MCP TEST LEAD B', '11900000006', 'Teste', 'Adesão', 'Teste');
UPDATE public.contracts
SET lead_id = '55555555-5555-4555-8555-555555555555'
WHERE id = '22222222-2222-4222-8222-222222222222';

SELECT throws_ok(
  $$SELECT public.create_contract_holder_import('11111111-1111-4111-8111-111111111111'::uuid, 'lead-contract-mismatch-test', '{"nome_completo":"TEST HOLDER","cpf":"00000000006","data_nascimento":"1980-01-01","telefone":"11900000006"}'::jsonb, '66666666-6666-4666-8666-666666666666'::uuid, '22222222-2222-4222-8222-222222222222'::uuid, 'mcp', 24)$$,
  '22023', 'MCP_IMPORT_CONTRACT_MISMATCH', 'staging rejects inconsistent lead and contract bindings'
);

SELECT throws_ok(
  $$SELECT public.create_contract_holder_import('99999999-9999-4999-8999-999999999999'::uuid, 'unauthorized-holder-create', '{}'::jsonb)$$,
  '42501', 'MCP_ACTOR_NOT_ACTIVE_ADMIN', 'holder staging rejects a non-admin actor with a safe code'
);
SELECT throws_ok(
  $$SELECT public.mcp_create_contract_holder_from_import('99999999-9999-4999-8999-999999999999'::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, 'unauthorized-holder-consume')$$,
  '42501', 'MCP_ACTOR_NOT_ACTIVE_ADMIN', 'holder consume rejects a non-admin actor with a safe code'
);
SELECT throws_ok(
  $$SELECT public.create_contract_dependent_import('99999999-9999-4999-8999-999999999999'::uuid, 'unauthorized-dependent-create', '{}'::jsonb)$$,
  '42501', 'MCP_ACTOR_NOT_ACTIVE_ADMIN', 'dependent staging rejects a non-admin actor with a safe code'
);

SELECT throws_ok(
  $$SELECT public.create_contract_holder_import('11111111-1111-4111-8111-111111111111'::uuid, 'missing-fields-test', '{"nome_completo":"TEST HOLDER"}'::jsonb)$$,
  '22023', 'MCP_MISSING_REQUIRED_HOLDER_FIELDS', 'holder staging reports missing required fields with a safe code'
);
CREATE FUNCTION pg_temp.mcp_test_holder_missing_detail()
RETURNS jsonb
LANGUAGE plpgsql
AS $test$
DECLARE
  v_message text;
  v_detail text;
BEGIN
  PERFORM public.create_contract_holder_import(
    '11111111-1111-4111-8111-111111111111'::uuid,
    'missing-fields-detail-test',
    '{"nome_completo":"TEST HOLDER"}'::jsonb
  );
  RETURN NULL;
EXCEPTION WHEN SQLSTATE '22023' THEN
  GET STACKED DIAGNOSTICS v_message = MESSAGE_TEXT, v_detail = PG_EXCEPTION_DETAIL;
  IF v_message <> 'MCP_MISSING_REQUIRED_HOLDER_FIELDS' THEN
    RAISE EXCEPTION 'MCP_TEST_EXPECTED_DIFFERENT_ERROR';
  END IF;
  RETURN v_detail::jsonb;
END;
$test$;
SELECT is(
  pg_temp.mcp_test_holder_missing_detail(),
  '{"missing_fields":["cpf","data_nascimento","telefone"]}'::jsonb,
  'missing-field DETAIL is JSON containing only field names'
);
SELECT throws_ok(
  $$SELECT public.create_contract_holder_import('11111111-1111-4111-8111-111111111111'::uuid, 'invalid-source-test', '{"nome_completo":"TEST HOLDER","cpf":"00000000000","data_nascimento":"1980-01-01","telefone":"11900000000"}'::jsonb, NULL, NULL, 'unbounded-source', 24)$$,
  '22023', 'MCP_INVALID_HOLDER_DATA', 'holder staging rejects source values outside the bounded enum'
);
SELECT throws_ok(
  $$SELECT public.create_contract_holder_import('11111111-1111-4111-8111-111111111111'::uuid, 'invalid-ttl-test', '{"nome_completo":"TEST HOLDER","cpf":"00000000000","data_nascimento":"1980-01-01","telefone":"11900000000"}'::jsonb, NULL, NULL, 'mcp', 169)$$,
  '22023', 'MCP_INVALID_HOLDER_DATA', 'holder staging caps TTL at 168 hours'
);
SELECT throws_ok(
  $$SELECT public.mcp_create_contract_holder_from_import('11111111-1111-4111-8111-111111111111'::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, 'missing-import-test')$$,
  'P0002', 'MCP_IMPORT_NOT_FOUND', 'holder consume rejects an unknown staged import safely'
);

CREATE TEMP TABLE mcp_import_test_state (
  scenario text PRIMARY KEY,
  response jsonb NOT NULL,
  import_id uuid NOT NULL
) ON COMMIT DROP;

WITH created AS (
  SELECT public.create_contract_holder_import(
    '11111111-1111-4111-8111-111111111111'::uuid,
    'test-holder-create-key',
    '{"nome_completo":"MCP TEST PII MARKER","cpf":"00000000000","data_nascimento":"1980-01-01","telefone":"11900000000","email":"pii-marker@example.invalid","endereco":"TEST ADDRESS MARKER"}'::jsonb,
    NULL,
    '22222222-2222-4222-8222-222222222222'::uuid,
    'mcp',
    24
  ) AS response
)
INSERT INTO mcp_import_test_state (scenario, response, import_id)
SELECT 'rollback', created.response, (created.response->>'import_id')::uuid
FROM created;

SELECT ok(
  (SELECT response->>'success' = 'true'
      AND response->>'replayed' = 'false'
      AND response ?& ARRAY['import_id', 'expires_at']
      AND jsonb_object_length(response) = 4
   FROM mcp_import_test_state WHERE scenario = 'rollback'),
  'holder staging response contains only success, replay state, import ID, and expiry'
);
SELECT ok(
  (SELECT (response->>'expires_at')::timestamptz BETWEEN now() + interval '23 hours' AND now() + interval '25 hours'
   FROM mcp_import_test_state WHERE scenario = 'rollback'),
  'holder staging defaults to a 24-hour TTL'
);
SELECT ok(
  (SELECT staged.status = 'pending' AND staged.nome_completo = 'MCP TEST PII MARKER'
     AND staged.email = 'pii-marker@example.invalid' AND staged.source = 'mcp'
   FROM mcp_import_test_state AS state
   JOIN public.contract_holder_imports AS staged ON staged.id = state.import_id
   WHERE state.scenario = 'rollback'),
  'typed staging row holds fields only while pending'
);
SELECT ok(
  (SELECT request.client_request_id ~ '^[0-9a-f]{64}$'
      AND request.client_request_id <> 'test-holder-create-key'
   FROM public.mcp_contract_write_requests AS request
   WHERE request.actor_id = '11111111-1111-4111-8111-111111111111'
     AND request.operation = 'holder.import.create'
     AND request.client_request_id = public._mcp_contract_import_request_fingerprint(
       '11111111-1111-4111-8111-111111111111'::uuid,
       'holder.import.create', 'test-holder-create-key'
     )),
  'import idempotency ledger stores a fingerprint rather than a caller request key'
);
SELECT ok(
  (SELECT audit.client_request_id_fingerprint ~ '^[0-9a-f]{64}$'
      AND audit.client_request_id_fingerprint <> 'test-holder-create-key'
      AND audit.action = 'created' AND audit.result = 'success'
   FROM mcp_import_test_state AS state
   JOIN public.contract_person_import_audit_log AS audit
     ON audit.import_id = state.import_id AND audit.import_type = 'holder'
   WHERE state.scenario = 'rollback'),
  'creation audit stores a fingerprint and no raw request key'
);

SELECT ok(
  (SELECT replay.response->>'replayed' = 'true'
      AND replay.response->>'import_id' = state.import_id::text
   FROM mcp_import_test_state AS state
   CROSS JOIN LATERAL (
     SELECT public.create_contract_holder_import(
       '11111111-1111-4111-8111-111111111111'::uuid,
       'test-holder-create-key',
       '{"nome_completo":"MCP TEST PII MARKER","cpf":"00000000000","data_nascimento":"1980-01-01","telefone":"11900000000","email":"pii-marker@example.invalid","endereco":"TEST ADDRESS MARKER"}'::jsonb,
       NULL,
       '22222222-2222-4222-8222-222222222222'::uuid,
       'mcp',
       24
     ) AS response
   ) AS replay
   WHERE state.scenario = 'rollback'),
  'replaying the same holder import request returns its staged ID'
);

CREATE FUNCTION public._mcp_test_force_import_rollback()
RETURNS trigger
LANGUAGE plpgsql
AS $test$
BEGIN
  RAISE EXCEPTION 'MCP_TEST_FORCE_ROLLBACK' USING ERRCODE = 'P0001';
END;
$test$;
CREATE TRIGGER mcp_test_force_import_rollback
  BEFORE UPDATE ON public.contract_holder_imports
  FOR EACH ROW EXECUTE FUNCTION public._mcp_test_force_import_rollback();

SELECT throws_ok(
  $$SELECT public.mcp_create_contract_holder_from_import('11111111-1111-4111-8111-111111111111'::uuid, (SELECT import_id FROM mcp_import_test_state WHERE scenario = 'rollback'), '22222222-2222-4222-8222-222222222222'::uuid, 'test-holder-consume-rollback')$$,
  'P0001', 'MCP_TEST_FORCE_ROLLBACK', 'an injected late failure aborts the holder consume transaction'
);
DROP TRIGGER mcp_test_force_import_rollback ON public.contract_holder_imports;
DROP FUNCTION public._mcp_test_force_import_rollback();

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.contract_holders WHERE contract_id = '22222222-2222-4222-8222-222222222222'),
  'a failed consume leaves no holder row behind'
);
SELECT ok(
  (SELECT staged.status = 'pending'
      AND staged.nome_completo = 'MCP TEST PII MARKER'
      AND staged.contract_holder_id IS NULL
   FROM mcp_import_test_state AS state
   JOIN public.contract_holder_imports AS staged ON staged.id = state.import_id
   WHERE state.scenario = 'rollback'),
  'a failed consume leaves the staged import pending with its PII intact'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.mcp_contract_write_requests AS request
    WHERE request.actor_id = '11111111-1111-4111-8111-111111111111'
      AND request.operation = 'holder.import.consume'
      AND request.client_request_id = public._mcp_contract_import_request_fingerprint(
        '11111111-1111-4111-8111-111111111111'::uuid,
        'holder.import.consume', 'test-holder-consume-rollback'
      )
  ),
  'a failed consume rolls back its idempotency ledger row too'
);

WITH consumed AS (
  SELECT public.mcp_create_contract_holder_from_import(
    '11111111-1111-4111-8111-111111111111'::uuid,
    state.import_id,
    '22222222-2222-4222-8222-222222222222'::uuid,
    'test-holder-consume-success'
  ) AS response
  FROM mcp_import_test_state AS state WHERE state.scenario = 'rollback'
)
UPDATE mcp_import_test_state AS state
SET response = consumed.response
FROM consumed
WHERE state.scenario = 'rollback';

SELECT ok(
  (SELECT response->>'success' = 'true'
      AND response->>'replayed' = 'false'
      AND response ?& ARRAY['contract_id', 'holder_id', 'import_id']
      AND jsonb_object_length(response) = 5
      AND NOT (response ?| ARRAY['nome_completo', 'cpf', 'telefone', 'email'])
   FROM mcp_import_test_state WHERE scenario = 'rollback'),
  'holder consume returns IDs only and never returns holder PII'
);
SELECT ok(
  (SELECT staged.status = 'consumed'
      AND staged.consumed_at IS NOT NULL
      AND staged.contract_holder_id = (state.response->>'holder_id')::uuid
      AND staged.source IS NULL
      AND staged.nome_completo IS NULL AND staged.cpf IS NULL
      AND staged.data_nascimento IS NULL AND staged.telefone IS NULL
      AND staged.email IS NULL AND staged.endereco IS NULL
   FROM mcp_import_test_state AS state
   JOIN public.contract_holder_imports AS staged ON staged.id = state.import_id
   WHERE state.scenario = 'rollback'),
  'successful consume atomically erases staged PII and source'
);
SELECT ok(
  (SELECT audit.holder_id = (state.response->>'holder_id')::uuid
      AND audit.action = 'consumed' AND audit.result = 'success'
      AND audit.client_request_id_fingerprint ~ '^[0-9a-f]{64}$'
   FROM mcp_import_test_state AS state
   JOIN public.contract_person_import_audit_log AS audit
     ON audit.import_id = state.import_id AND audit.action = 'consumed'
   WHERE state.scenario = 'rollback'),
  'consume audit records actor, contract, holder, import, and hashed request identity'
);
SELECT ok(
  (SELECT audit.client_request_id = state.import_id::text
   FROM mcp_import_test_state AS state
   JOIN public.mcp_contract_mutation_audit_log AS audit
     ON audit.entity_type = 'holder'
    AND audit.entity_id = (state.response->>'holder_id')::uuid
   WHERE state.scenario = 'rollback'),
  'core holder audit receives the opaque import ID instead of the caller key'
);

SELECT ok(
  (SELECT replay.response->>'replayed' = 'true'
      AND replay.response->>'holder_id' = state.response->>'holder_id'
   FROM mcp_import_test_state AS state
   CROSS JOIN LATERAL (
     SELECT public.mcp_create_contract_holder_from_import(
       '11111111-1111-4111-8111-111111111111'::uuid,
       state.import_id,
       '22222222-2222-4222-8222-222222222222'::uuid,
       'test-holder-consume-success'
     ) AS response
   ) AS replay
   WHERE state.scenario = 'rollback'),
  'replaying a successful consume returns the same holder ID without PII'
);
SELECT throws_ok(
  $$SELECT public.mcp_create_contract_holder_from_import('11111111-1111-4111-8111-111111111111'::uuid, (SELECT import_id FROM mcp_import_test_state WHERE scenario = 'rollback'), '22222222-2222-4222-8222-222222222222'::uuid, 'test-holder-consume-again')$$,
  '55000', 'MCP_IMPORT_ALREADY_CONSUMED', 'a new request cannot consume an already consumed import'
);

WITH staged AS (
  SELECT public.create_contract_dependent_import(
    '11111111-1111-4111-8111-111111111111'::uuid,
    'test-dependent-expire-create',
    '{"nome_completo":"MCP TEST DEPENDENT","cpf":"00000000005","data_nascimento":"2000-01-01","relacao":"Filho(a)"}'::jsonb,
    24,
    NULL,
    NULL
  ) AS response
)
INSERT INTO mcp_import_test_state (scenario, response, import_id)
SELECT 'dependent_expired', response, (response->>'import_id')::uuid FROM staged;
SELECT ok(
  (SELECT response->>'success' = 'true'
      AND response->>'replayed' = 'false'
      AND response ?& ARRAY['import_id', 'expires_at']
      AND jsonb_object_length(response) = 4
      AND NOT (response ?| ARRAY['nome_completo', 'cpf', 'data_nascimento', 'relacao'])
   FROM mcp_import_test_state WHERE scenario = 'dependent_expired'),
  'dependent staging response contains only import metadata'
);
SELECT ok(
  (SELECT staged.status = 'pending' AND staged.nome_completo = 'MCP TEST DEPENDENT'
   FROM mcp_import_test_state AS state
   JOIN public.contract_dependent_imports AS staged ON staged.id = state.import_id
   WHERE state.scenario = 'dependent_expired'),
  'dependent import uses typed staging columns'
);
SELECT ok(
  (SELECT audit.client_request_id_fingerprint ~ '^[0-9a-f]{64}$'
      AND audit.action = 'created' AND audit.result = 'success'
   FROM mcp_import_test_state AS state
   JOIN public.contract_person_import_audit_log AS audit
     ON audit.import_id = state.import_id AND audit.import_type = 'dependent'
   WHERE state.scenario = 'dependent_expired'),
  'dependent creation audit stores a request fingerprint only'
);
SELECT ok(
  (SELECT request.client_request_id ~ '^[0-9a-f]{64}$'
   FROM public.mcp_contract_write_requests AS request
   WHERE request.actor_id = '11111111-1111-4111-8111-111111111111'
     AND request.operation = 'dependent.import.create'
     AND request.client_request_id = public._mcp_contract_import_request_fingerprint(
       '11111111-1111-4111-8111-111111111111'::uuid,
       'dependent.import.create', 'test-dependent-expire-create'
     )),
  'dependent idempotency ledger stores a fingerprint rather than the caller key'
);
SELECT ok(
  (SELECT replay.response->>'replayed' = 'true'
      AND replay.response->>'import_id' = state.import_id::text
   FROM mcp_import_test_state AS state
   CROSS JOIN LATERAL (
     SELECT public.create_contract_dependent_import(
       '11111111-1111-4111-8111-111111111111'::uuid,
       'test-dependent-expire-create',
       '{"nome_completo":"MCP TEST DEPENDENT","cpf":"00000000005","data_nascimento":"2000-01-01","relacao":"Filho(a)"}'::jsonb,
       24,
       NULL,
       NULL
     ) AS response
   ) AS replay
   WHERE state.scenario = 'dependent_expired'),
  'dependent staging request replays with the same import ID'
);

WITH staged AS (
  SELECT public.create_contract_holder_import(
    '11111111-1111-4111-8111-111111111111'::uuid,
    'test-holder-mismatch-create',
    '{"nome_completo":"MCP TEST MISMATCH","cpf":"00000000001","data_nascimento":"1981-01-01","telefone":"11900000001"}'::jsonb,
    NULL,
    '33333333-3333-4333-8333-333333333333'::uuid,
    'importer',
    24
  ) AS response
)
INSERT INTO mcp_import_test_state (scenario, response, import_id)
SELECT 'mismatch', response, (response->>'import_id')::uuid FROM staged;
SELECT throws_ok(
  $$SELECT public.mcp_create_contract_holder_from_import('11111111-1111-4111-8111-111111111111'::uuid, (SELECT import_id FROM mcp_import_test_state WHERE scenario = 'mismatch'), '44444444-4444-4444-8444-444444444444'::uuid, 'test-holder-mismatch-consume')$$,
  '22023', 'MCP_IMPORT_CONTRACT_MISMATCH', 'a staged contract binding cannot be changed during consume'
);

CREATE FUNCTION public._mcp_test_force_holder_duplicate()
RETURNS trigger
LANGUAGE plpgsql
AS $test$
BEGIN
  RAISE EXCEPTION 'duplicate key detail deliberately hidden' USING ERRCODE = '23505';
END;
$test$;
CREATE TRIGGER mcp_test_force_holder_duplicate
  BEFORE INSERT ON public.contract_holders
  FOR EACH ROW EXECUTE FUNCTION public._mcp_test_force_holder_duplicate();
SELECT throws_ok(
  $$SELECT public.mcp_create_contract_holder_from_import('11111111-1111-4111-8111-111111111111'::uuid, (SELECT import_id FROM mcp_import_test_state WHERE scenario = 'mismatch'), '33333333-3333-4333-8333-333333333333'::uuid, 'test-holder-duplicate-insert')$$,
  '23505', 'MCP_DUPLICATE_HOLDER', 'holder insert unique violations map to a safe duplicate code'
);
DROP TRIGGER mcp_test_force_holder_duplicate ON public.contract_holders;
DROP FUNCTION public._mcp_test_force_holder_duplicate();
SELECT ok(
  (SELECT staged.status = 'pending' AND staged.nome_completo = 'MCP TEST MISMATCH'
   FROM mcp_import_test_state AS state
   JOIN public.contract_holder_imports AS staged ON staged.id = state.import_id
   WHERE state.scenario = 'mismatch'),
  'a duplicate holder error rolls back the import consume and retains staging data'
);

WITH staged AS (
  SELECT public.create_contract_holder_import(
    '11111111-1111-4111-8111-111111111111'::uuid,
    'test-holder-has-holder-create',
    '{"nome_completo":"MCP TEST EXISTING HOLDER","cpf":"00000000002","data_nascimento":"1982-01-01","telefone":"11900000002"}'::jsonb,
    NULL, NULL, 'mcp', 24
  ) AS response
)
INSERT INTO mcp_import_test_state (scenario, response, import_id)
SELECT 'has_holder', response, (response->>'import_id')::uuid FROM staged;
SELECT throws_ok(
  $$SELECT public.mcp_create_contract_holder_from_import('11111111-1111-4111-8111-111111111111'::uuid, (SELECT import_id FROM mcp_import_test_state WHERE scenario = 'has_holder'), '44444444-4444-4444-8444-444444444444'::uuid, 'test-holder-existing-consume')$$,
  '22023', 'MCP_CONTRACT_ALREADY_HAS_HOLDER', 'consume rejects a contract that already has a holder'
);

WITH staged AS (
  SELECT public.create_contract_holder_import(
    '11111111-1111-4111-8111-111111111111'::uuid,
    'test-holder-expired-create',
    '{"nome_completo":"MCP TEST EXPIRED","cpf":"00000000003","data_nascimento":"1983-01-01","telefone":"11900000003"}'::jsonb,
    NULL, NULL, 'mcp', 24
  ) AS response
)
INSERT INTO mcp_import_test_state (scenario, response, import_id)
SELECT 'expired', response, (response->>'import_id')::uuid FROM staged;
UPDATE public.contract_holder_imports AS staged
SET created_at = now() - interval '48 hours', expires_at = now() - interval '24 hours'
FROM mcp_import_test_state AS state
WHERE state.scenario = 'expired' AND staged.id = state.import_id;
SELECT throws_ok(
  $$SELECT public.mcp_create_contract_holder_from_import('11111111-1111-4111-8111-111111111111'::uuid, (SELECT import_id FROM mcp_import_test_state WHERE scenario = 'expired'), '22222222-2222-4222-8222-222222222222'::uuid, 'test-holder-expired-consume')$$,
  '55000', 'MCP_IMPORT_EXPIRED', 'consume rejects an expired staged import safely'
);
UPDATE public.contract_dependent_imports AS staged
SET created_at = now() - interval '48 hours', expires_at = now() - interval '24 hours'
FROM mcp_import_test_state AS state
WHERE state.scenario = 'dependent_expired' AND staged.id = state.import_id;

SELECT ok(
  public.cleanup_contract_person_imports(500) >= 2,
  'cleanup expires the aged holder and dependent test imports'
);
SELECT ok(
  (SELECT staged.status = 'expired' AND staged.source IS NULL
      AND staged.nome_completo IS NULL AND staged.cpf IS NULL
      AND staged.data_nascimento IS NULL AND staged.telefone IS NULL
      AND staged.email IS NULL AND staged.endereco IS NULL
   FROM mcp_import_test_state AS state
   JOIN public.contract_holder_imports AS staged ON staged.id = state.import_id
   WHERE state.scenario = 'expired'),
  'cleanup erases holder PII and source at expiry'
);
SELECT ok(
  (SELECT staged.status = 'expired'
      AND staged.nome_completo IS NULL AND staged.cpf IS NULL
      AND staged.data_nascimento IS NULL AND staged.relacao IS NULL
      AND staged.elegibilidade IS NULL AND staged.valor_individual IS NULL
   FROM mcp_import_test_state AS state
   JOIN public.contract_dependent_imports AS staged ON staged.id = state.import_id
   WHERE state.scenario = 'dependent_expired'),
  'cleanup erases typed dependent PII at expiry'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.mcp_contract_write_requests AS request
    WHERE request.actor_id = '11111111-1111-4111-8111-111111111111'
      AND request.operation = 'holder.import.create'
      AND request.client_request_id = public._mcp_contract_import_request_fingerprint(
        '11111111-1111-4111-8111-111111111111'::uuid,
        'holder.import.create', 'test-holder-expired-create'
      )
  ),
  'expiry retains the idempotency ledger during the tombstone window'
);

UPDATE public.contract_holder_imports AS staged
SET created_at = now() - interval '10 days',
    expires_at = now() - interval '9 days',
    updated_at = now() - interval '9 days'
FROM mcp_import_test_state AS state
WHERE state.scenario = 'expired' AND staged.id = state.import_id;
UPDATE public.contract_dependent_imports AS staged
SET created_at = now() - interval '10 days',
    expires_at = now() - interval '9 days',
    updated_at = now() - interval '9 days'
FROM mcp_import_test_state AS state
WHERE state.scenario = 'dependent_expired' AND staged.id = state.import_id;
UPDATE public.contract_holder_imports AS staged
SET created_at = now() - interval '10 days',
    expires_at = now() - interval '9 days',
    consumed_at = now() - interval '8 days',
    updated_at = now() - interval '8 days'
FROM mcp_import_test_state AS state
WHERE state.scenario = 'rollback' AND staged.id = state.import_id;

SELECT ok(
  public.cleanup_contract_person_imports(500) >= 3,
  'cleanup purges expired tombstones and a consumed holder older than seven days'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.contract_holder_imports AS staged
    JOIN mcp_import_test_state AS state ON state.import_id = staged.id
    WHERE state.scenario IN ('expired', 'rollback')
  ),
  'cleanup deletes the expired and old-consumed holder tombstones'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.contract_dependent_imports AS staged
    JOIN mcp_import_test_state AS state ON state.import_id = staged.id
    WHERE state.scenario = 'dependent_expired'
  ),
  'cleanup deletes dependent tombstones after the retention window'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM public.mcp_contract_write_requests AS request
    WHERE request.actor_id = '11111111-1111-4111-8111-111111111111'
      AND (
        (request.operation = 'holder.import.create' AND request.client_request_id = public._mcp_contract_import_request_fingerprint(
          '11111111-1111-4111-8111-111111111111'::uuid,
          'holder.import.create', 'test-holder-expired-create'
        ))
        OR (request.operation = 'holder.import.create' AND request.client_request_id = public._mcp_contract_import_request_fingerprint(
          '11111111-1111-4111-8111-111111111111'::uuid,
          'holder.import.create', 'test-holder-create-key'
        ))
        OR (request.operation = 'holder.import.consume' AND request.client_request_id = public._mcp_contract_import_request_fingerprint(
          '11111111-1111-4111-8111-111111111111'::uuid,
          'holder.import.consume', 'test-holder-consume-success'
        ))
        OR (request.operation = 'dependent.import.create' AND request.client_request_id = public._mcp_contract_import_request_fingerprint(
          '11111111-1111-4111-8111-111111111111'::uuid,
          'dependent.import.create', 'test-dependent-expire-create'
        ))
      )
  ),
  'cleanup purges request fingerprints from the idempotency ledger with old tombstones'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM public.contract_person_import_audit_log AS audit
    JOIN mcp_import_test_state AS state ON state.import_id = audit.import_id
    WHERE audit.action = 'purged' AND audit.result = 'purged'
      AND state.scenario = 'rollback'
  ),
  'cleanup records a value-free audit event when a consumed holder tombstone is purged'
);

SELECT throws_ok(
  $$SELECT public.create_contract_holder_import('11111111-1111-4111-8111-111111111111'::uuid, 'missing-contract-create', '{"nome_completo":"MCP TEST MISSING CONTRACT","cpf":"00000000004","data_nascimento":"1984-01-01","telefone":"11900000004"}'::jsonb, NULL, 'deadbeef-dead-4eef-8eef-deadbeefdead'::uuid, 'mcp', 24)$$,
  'P0002', 'MCP_CONTRACT_NOT_FOUND', 'staging rejects an explicitly unknown contract binding'
);

SELECT * FROM finish();
ROLLBACK;
