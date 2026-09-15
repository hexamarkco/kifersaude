BEGIN;
SET LOCAL search_path = extensions, public, pg_catalog;

SELECT plan(48);

SELECT ok(to_regprocedure('public.mcp_create_contract(uuid, text, jsonb)') IS NOT NULL, 'contract create RPC exists');
SELECT ok(to_regprocedure('public.mcp_update_contract(uuid, uuid, timestamptz, jsonb)') IS NOT NULL, 'contract update RPC exists');
SELECT ok(to_regprocedure('public.mcp_create_contract_holder(uuid, uuid, text, jsonb)') IS NOT NULL, 'holder create RPC exists');
SELECT ok(to_regprocedure('public.mcp_update_contract_holder(uuid, uuid, timestamptz, jsonb)') IS NOT NULL, 'holder update RPC exists');
SELECT ok(to_regprocedure('public.mcp_create_contract_dependent(uuid, uuid, uuid, text, jsonb)') IS NOT NULL, 'dependent create RPC exists');
SELECT ok(to_regprocedure('public.mcp_update_contract_dependent(uuid, uuid, timestamptz, jsonb)') IS NOT NULL, 'dependent update RPC exists');
SELECT ok(to_regprocedure('public.mcp_create_contract_bundle(uuid, text, jsonb, jsonb, jsonb)') IS NOT NULL, 'atomic bundle RPC exists');

SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.mcp_create_contract(uuid, text, jsonb)'::regprocedure), 'contract create is SECURITY DEFINER');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.mcp_update_contract(uuid, uuid, timestamptz, jsonb)'::regprocedure), 'contract update is SECURITY DEFINER');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.mcp_create_contract_holder(uuid, uuid, text, jsonb)'::regprocedure), 'holder create is SECURITY DEFINER');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.mcp_update_contract_holder(uuid, uuid, timestamptz, jsonb)'::regprocedure), 'holder update is SECURITY DEFINER');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.mcp_create_contract_dependent(uuid, uuid, uuid, text, jsonb)'::regprocedure), 'dependent create is SECURITY DEFINER');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.mcp_update_contract_dependent(uuid, uuid, timestamptz, jsonb)'::regprocedure), 'dependent update is SECURITY DEFINER');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.mcp_create_contract_bundle(uuid, text, jsonb, jsonb, jsonb)'::regprocedure), 'bundle create is SECURITY DEFINER');

SELECT ok(has_function_privilege('service_role', 'public.mcp_create_contract(uuid, text, jsonb)'::regprocedure, 'EXECUTE'), 'service_role can call contract create');
SELECT ok(has_function_privilege('service_role', 'public.mcp_update_contract(uuid, uuid, timestamptz, jsonb)'::regprocedure, 'EXECUTE'), 'service_role can call contract update');
SELECT ok(has_function_privilege('service_role', 'public.mcp_create_contract_holder(uuid, uuid, text, jsonb)'::regprocedure, 'EXECUTE'), 'service_role can call holder create');
SELECT ok(has_function_privilege('service_role', 'public.mcp_update_contract_holder(uuid, uuid, timestamptz, jsonb)'::regprocedure, 'EXECUTE'), 'service_role can call holder update');
SELECT ok(has_function_privilege('service_role', 'public.mcp_create_contract_dependent(uuid, uuid, uuid, text, jsonb)'::regprocedure, 'EXECUTE'), 'service_role can call dependent create');
SELECT ok(has_function_privilege('service_role', 'public.mcp_update_contract_dependent(uuid, uuid, timestamptz, jsonb)'::regprocedure, 'EXECUTE'), 'service_role can call dependent update');
SELECT ok(has_function_privilege('service_role', 'public.mcp_create_contract_bundle(uuid, text, jsonb, jsonb, jsonb)'::regprocedure, 'EXECUTE'), 'service_role can call atomic bundle');

SELECT ok(NOT has_function_privilege('anon', 'public.mcp_create_contract(uuid, text, jsonb)'::regprocedure, 'EXECUTE'), 'anon cannot call contract create');
SELECT ok(NOT has_function_privilege('anon', 'public.mcp_update_contract(uuid, uuid, timestamptz, jsonb)'::regprocedure, 'EXECUTE'), 'anon cannot call contract update');
SELECT ok(NOT has_function_privilege('anon', 'public.mcp_create_contract_holder(uuid, uuid, text, jsonb)'::regprocedure, 'EXECUTE'), 'anon cannot call holder create');
SELECT ok(NOT has_function_privilege('anon', 'public.mcp_update_contract_holder(uuid, uuid, timestamptz, jsonb)'::regprocedure, 'EXECUTE'), 'anon cannot call holder update');
SELECT ok(NOT has_function_privilege('anon', 'public.mcp_create_contract_dependent(uuid, uuid, uuid, text, jsonb)'::regprocedure, 'EXECUTE'), 'anon cannot call dependent create');
SELECT ok(NOT has_function_privilege('anon', 'public.mcp_update_contract_dependent(uuid, uuid, timestamptz, jsonb)'::regprocedure, 'EXECUTE'), 'anon cannot call dependent update');
SELECT ok(NOT has_function_privilege('anon', 'public.mcp_create_contract_bundle(uuid, text, jsonb, jsonb, jsonb)'::regprocedure, 'EXECUTE'), 'anon cannot call bundle create');

SELECT ok(NOT has_function_privilege('authenticated', 'public.mcp_create_contract(uuid, text, jsonb)'::regprocedure, 'EXECUTE'), 'authenticated cannot call contract create');
SELECT ok(NOT has_function_privilege('authenticated', 'public.mcp_update_contract(uuid, uuid, timestamptz, jsonb)'::regprocedure, 'EXECUTE'), 'authenticated cannot call contract update');
SELECT ok(NOT has_function_privilege('authenticated', 'public.mcp_create_contract_holder(uuid, uuid, text, jsonb)'::regprocedure, 'EXECUTE'), 'authenticated cannot call holder create');
SELECT ok(NOT has_function_privilege('authenticated', 'public.mcp_update_contract_holder(uuid, uuid, timestamptz, jsonb)'::regprocedure, 'EXECUTE'), 'authenticated cannot call holder update');
SELECT ok(NOT has_function_privilege('authenticated', 'public.mcp_create_contract_dependent(uuid, uuid, uuid, text, jsonb)'::regprocedure, 'EXECUTE'), 'authenticated cannot call dependent create');
SELECT ok(NOT has_function_privilege('authenticated', 'public.mcp_update_contract_dependent(uuid, uuid, timestamptz, jsonb)'::regprocedure, 'EXECUTE'), 'authenticated cannot call dependent update');
SELECT ok(NOT has_function_privilege('authenticated', 'public.mcp_create_contract_bundle(uuid, text, jsonb, jsonb, jsonb)'::regprocedure, 'EXECUTE'), 'authenticated cannot call bundle create');

SELECT ok(NOT has_function_privilege('service_role', 'public._mcp_assert_active_contract_admin(uuid)'::regprocedure, 'EXECUTE'), 'service_role cannot call actor-check helper directly');
SELECT ok(NOT has_function_privilege('service_role', 'public._mcp_assert_contract_payload_keys(jsonb, text[], text[])'::regprocedure, 'EXECUTE'), 'service_role cannot call key-check helper directly');
SELECT ok(NOT has_function_privilege('service_role', 'public._mcp_begin_contract_write_request(uuid, text, text, jsonb)'::regprocedure, 'EXECUTE'), 'service_role cannot call idempotency-start helper directly');
SELECT ok(NOT has_function_privilege('service_role', 'public._mcp_complete_contract_write_request(uuid, text, text, jsonb)'::regprocedure, 'EXECUTE'), 'service_role cannot call idempotency-complete helper directly');
SELECT ok(NOT has_function_privilege('service_role', 'public._mcp_validate_contract_row(jsonb, jsonb)'::regprocedure, 'EXECUTE'), 'service_role cannot call contract validator directly');
SELECT ok(NOT has_function_privilege('service_role', 'public._mcp_validate_holder_payload(jsonb, boolean)'::regprocedure, 'EXECUTE'), 'service_role cannot call holder validator directly');
SELECT ok(NOT has_function_privilege('service_role', 'public._mcp_validate_dependent_payload(jsonb)'::regprocedure, 'EXECUTE'), 'service_role cannot call dependent validator directly');
SELECT ok(NOT has_function_privilege('service_role', 'public._mcp_insert_contract(jsonb)'::regprocedure, 'EXECUTE'), 'service_role cannot call contract insert helper directly');
SELECT ok(NOT has_function_privilege('service_role', 'public._mcp_insert_holder(uuid, jsonb)'::regprocedure, 'EXECUTE'), 'service_role cannot call holder insert helper directly');
SELECT ok(NOT has_function_privilege('service_role', 'public._mcp_insert_dependent(uuid, uuid, jsonb)'::regprocedure, 'EXECUTE'), 'service_role cannot call dependent insert helper directly');

SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.mcp_contract_write_requests'::regclass), 'idempotency table has RLS enabled');
SELECT ok(NOT has_table_privilege('service_role', 'public.mcp_contract_write_requests', 'SELECT'), 'service_role has no direct idempotency table access');
SELECT ok(NOT has_table_privilege('authenticated', 'public.mcp_contract_write_requests', 'SELECT'), 'authenticated has no idempotency table access');

SELECT * FROM finish();
ROLLBACK;
