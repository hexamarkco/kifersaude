BEGIN;
SET LOCAL search_path = extensions, public, pg_catalog;

SELECT plan(12);

SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.mcp_get_contact_permission(uuid, text, text)'::regprocedure), 'permission read RPC is SECURITY DEFINER');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.mcp_set_contact_permission(uuid, text, text, text, text, text, text, jsonb, uuid, timestamptz)'::regprocedure), 'permission write RPC is SECURITY DEFINER');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.mcp_bulk_set_contact_permission(uuid, text, jsonb)'::regprocedure), 'permission bulk RPC is SECURITY DEFINER');

SELECT ok(has_function_privilege('service_role', 'public.mcp_get_contact_permission(uuid, text, text)'::regprocedure, 'EXECUTE'), 'service_role can invoke permission read RPC');
SELECT ok(has_function_privilege('service_role', 'public.mcp_set_contact_permission(uuid, text, text, text, text, text, text, jsonb, uuid, timestamptz)'::regprocedure, 'EXECUTE'), 'service_role can invoke permission write RPC');
SELECT ok(has_function_privilege('service_role', 'public.mcp_bulk_set_contact_permission(uuid, text, jsonb)'::regprocedure, 'EXECUTE'), 'service_role can invoke permission bulk RPC');

SELECT ok(NOT has_function_privilege('anon', 'public.mcp_get_contact_permission(uuid, text, text)'::regprocedure, 'EXECUTE'), 'anon cannot invoke permission read RPC');
SELECT ok(NOT has_function_privilege('anon', 'public.mcp_set_contact_permission(uuid, text, text, text, text, text, text, jsonb, uuid, timestamptz)'::regprocedure, 'EXECUTE'), 'anon cannot invoke permission write RPC');
SELECT ok(NOT has_function_privilege('anon', 'public.mcp_bulk_set_contact_permission(uuid, text, jsonb)'::regprocedure, 'EXECUTE'), 'anon cannot invoke permission bulk RPC');

SELECT ok(NOT has_function_privilege('authenticated', 'public.mcp_get_contact_permission(uuid, text, text)'::regprocedure, 'EXECUTE'), 'authenticated cannot invoke permission read RPC');
SELECT ok(NOT has_function_privilege('authenticated', 'public.mcp_set_contact_permission(uuid, text, text, text, text, text, text, jsonb, uuid, timestamptz)'::regprocedure, 'EXECUTE'), 'authenticated cannot invoke permission write RPC');
SELECT ok(NOT has_function_privilege('authenticated', 'public.mcp_bulk_set_contact_permission(uuid, text, jsonb)'::regprocedure, 'EXECUTE'), 'authenticated cannot invoke permission bulk RPC');

SELECT * FROM finish();
ROLLBACK;
