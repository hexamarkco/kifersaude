BEGIN;
SET LOCAL search_path = extensions, public, pg_catalog;

SELECT plan(17);

SELECT ok(to_regprocedure('public.mcp_resolve_whatsapp_identity_conflict(uuid, uuid, uuid, timestamptz, timestamptz, text)') IS NOT NULL, 'identity conflict resolution RPC exists');
SELECT ok((SELECT proargnames = ARRAY['p_actor_user_id', 'p_conflict_id', 'p_lead_id', 'p_expected_conflict_updated_at', 'p_expected_chat_updated_at', 'p_client_request_id'] FROM pg_proc WHERE oid = 'public.mcp_resolve_whatsapp_identity_conflict(uuid, uuid, uuid, timestamptz, timestamptz, text)'::regprocedure), 'identity resolution RPC has stable argument names');
SELECT ok((SELECT prorettype = 'jsonb'::regtype FROM pg_proc WHERE oid = 'public.mcp_resolve_whatsapp_identity_conflict(uuid, uuid, uuid, timestamptz, timestamptz, text)'::regprocedure), 'identity resolution RPC returns JSON');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.mcp_resolve_whatsapp_identity_conflict(uuid, uuid, uuid, timestamptz, timestamptz, text)'::regprocedure), 'identity resolution RPC is SECURITY DEFINER');
SELECT ok(has_function_privilege('service_role', 'public.mcp_resolve_whatsapp_identity_conflict(uuid, uuid, uuid, timestamptz, timestamptz, text)'::regprocedure, 'EXECUTE'), 'service_role can invoke identity resolution RPC');
SELECT ok(NOT has_function_privilege('anon', 'public.mcp_resolve_whatsapp_identity_conflict(uuid, uuid, uuid, timestamptz, timestamptz, text)'::regprocedure, 'EXECUTE'), 'anon cannot invoke identity resolution RPC');
SELECT ok(NOT has_function_privilege('authenticated', 'public.mcp_resolve_whatsapp_identity_conflict(uuid, uuid, uuid, timestamptz, timestamptz, text)'::regprocedure, 'EXECUTE'), 'authenticated cannot invoke identity resolution RPC');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.mcp_whatsapp_identity_resolution_requests'::regclass), 'identity resolution request log has RLS enabled');
SELECT ok(NOT has_table_privilege('service_role', 'public.mcp_whatsapp_identity_resolution_requests', 'SELECT'), 'service_role has no direct request-log read access');
SELECT ok(NOT has_table_privilege('service_role', 'public.mcp_whatsapp_identity_resolution_requests', 'INSERT'), 'service_role has no direct request-log write access');
SELECT ok(position('candidate_lead_ids' IN pg_get_functiondef('public.mcp_resolve_whatsapp_identity_conflict(uuid, uuid, uuid, timestamptz, timestamptz, text)'::regprocedure)) > 0, 'ambiguous lead resolution validates persisted candidates');
SELECT ok(position('selected_lead_is_not_in_persisted_candidates' IN pg_get_functiondef('public.mcp_resolve_whatsapp_identity_conflict(uuid, uuid, uuid, timestamptz, timestamptz, text)'::regprocedure)) > 0, 'arbitrary lead choices return requires_review');
SELECT ok(position('identity_evidence_requires_server_revalidation' IN pg_get_functiondef('public.mcp_resolve_whatsapp_identity_conflict(uuid, uuid, uuid, timestamptz, timestamptz, text)'::regprocedure)) > 0, 'external identity conflicts require server revalidation');
SELECT ok(position('SKIP LOCKED' IN pg_get_functiondef('public.mcp_resolve_whatsapp_identity_conflict(uuid, uuid, uuid, timestamptz, timestamptz, text)'::regprocedure)) > 0, 'conflict lock cannot deadlock with a conflict trigger waiting on the chat');
SELECT ok(position('clock_timestamp()' IN pg_get_functiondef('public.mcp_resolve_whatsapp_identity_conflict(uuid, uuid, uuid, timestamptz, timestamptz, text)'::regprocedure)) > 0, 'resolution advances row versions monotonically');
SELECT ok(position('MCP_IDENTITY_CONFLICT_RESOLUTION_REQUIRED' IN pg_get_functiondef('public.mcp_comm_whatsapp_link_chat_lead(uuid, uuid, uuid, timestamptz, text)'::regprocedure)) > 0, 'ordinary link RPC cannot clear an open lead conflict');
SELECT ok(NOT has_function_privilege('anon', 'public.mcp_comm_whatsapp_link_chat_lead(uuid, uuid, uuid, timestamptz, text)'::regprocedure, 'EXECUTE'), 'ordinary chat link remains unavailable to anon');

SELECT * FROM finish();
ROLLBACK;
