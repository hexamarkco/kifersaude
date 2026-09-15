BEGIN;
SET LOCAL search_path = extensions, public, pg_catalog;

SELECT plan(61);

SELECT ok(to_regprocedure('public.mcp_comm_whatsapp_set_chat_archived(uuid, uuid, boolean, timestamptz, text)') IS NOT NULL, 'archive and unarchive RPC exists');
SELECT ok(to_regprocedure('public.mcp_comm_whatsapp_set_chat_pinned(uuid, uuid, boolean, timestamptz, text)') IS NOT NULL, 'pin and unpin RPC exists');
SELECT ok(to_regprocedure('public.mcp_comm_whatsapp_set_chat_muted(uuid, uuid, boolean, timestamptz, text)') IS NOT NULL, 'mute and unmute RPC exists');
SELECT ok(to_regprocedure('public.mcp_comm_whatsapp_set_chat_unread(uuid, uuid, boolean, timestamptz, text)') IS NOT NULL, 'manual read and unread RPC exists');
SELECT ok(to_regprocedure('public.mcp_comm_whatsapp_mark_chat_read(uuid, uuid, timestamptz, uuid, timestamptz, text)') IS NOT NULL, 'cursor-aware mark-read RPC exists');
SELECT ok(to_regprocedure('public.mcp_comm_whatsapp_link_chat_lead(uuid, uuid, uuid, timestamptz, text)') IS NOT NULL, 'link chat to lead RPC exists');
SELECT ok(to_regprocedure('public.mcp_comm_whatsapp_unlink_chat_lead(uuid, uuid, timestamptz, text)') IS NOT NULL, 'unlink chat from lead RPC exists');

SELECT ok((SELECT proargnames = ARRAY['p_actor_user_id', 'p_chat_id', 'p_is_archived', 'p_expected_updated_at', 'p_client_request_id'] FROM pg_proc WHERE oid = 'public.mcp_comm_whatsapp_set_chat_archived(uuid, uuid, boolean, timestamptz, text)'::regprocedure), 'archive RPC exposes stable PostgREST argument names');
SELECT ok((SELECT proargnames = ARRAY['p_actor_user_id', 'p_chat_id', 'p_is_pinned', 'p_expected_updated_at', 'p_client_request_id'] FROM pg_proc WHERE oid = 'public.mcp_comm_whatsapp_set_chat_pinned(uuid, uuid, boolean, timestamptz, text)'::regprocedure), 'pin RPC exposes stable PostgREST argument names');
SELECT ok((SELECT proargnames = ARRAY['p_actor_user_id', 'p_chat_id', 'p_is_muted', 'p_expected_updated_at', 'p_client_request_id'] FROM pg_proc WHERE oid = 'public.mcp_comm_whatsapp_set_chat_muted(uuid, uuid, boolean, timestamptz, text)'::regprocedure), 'mute RPC exposes stable PostgREST argument names');
SELECT ok((SELECT proargnames = ARRAY['p_actor_user_id', 'p_chat_id', 'p_is_unread', 'p_expected_updated_at', 'p_client_request_id'] FROM pg_proc WHERE oid = 'public.mcp_comm_whatsapp_set_chat_unread(uuid, uuid, boolean, timestamptz, text)'::regprocedure), 'unread RPC exposes stable PostgREST argument names');
SELECT ok((SELECT proargnames = ARRAY['p_actor_user_id', 'p_chat_id', 'p_last_seen_message_at', 'p_last_seen_message_id', 'p_expected_updated_at', 'p_client_request_id'] FROM pg_proc WHERE oid = 'public.mcp_comm_whatsapp_mark_chat_read(uuid, uuid, timestamptz, uuid, timestamptz, text)'::regprocedure), 'mark-read RPC exposes stable PostgREST argument names');
SELECT ok((SELECT proargnames = ARRAY['p_actor_user_id', 'p_chat_id', 'p_lead_id', 'p_expected_updated_at', 'p_client_request_id'] FROM pg_proc WHERE oid = 'public.mcp_comm_whatsapp_link_chat_lead(uuid, uuid, uuid, timestamptz, text)'::regprocedure), 'link RPC exposes stable PostgREST argument names');
SELECT ok((SELECT proargnames = ARRAY['p_actor_user_id', 'p_chat_id', 'p_expected_updated_at', 'p_client_request_id'] FROM pg_proc WHERE oid = 'public.mcp_comm_whatsapp_unlink_chat_lead(uuid, uuid, timestamptz, text)'::regprocedure), 'unlink RPC exposes stable PostgREST argument names');

SELECT ok((SELECT prorettype = 'jsonb'::regtype FROM pg_proc WHERE oid = 'public.mcp_comm_whatsapp_set_chat_archived(uuid, uuid, boolean, timestamptz, text)'::regprocedure), 'archive RPC returns a JSON contract');
SELECT ok((SELECT prorettype = 'jsonb'::regtype FROM pg_proc WHERE oid = 'public.mcp_comm_whatsapp_set_chat_pinned(uuid, uuid, boolean, timestamptz, text)'::regprocedure), 'pin RPC returns a JSON contract');
SELECT ok((SELECT prorettype = 'jsonb'::regtype FROM pg_proc WHERE oid = 'public.mcp_comm_whatsapp_set_chat_muted(uuid, uuid, boolean, timestamptz, text)'::regprocedure), 'mute RPC returns a JSON contract');
SELECT ok((SELECT prorettype = 'jsonb'::regtype FROM pg_proc WHERE oid = 'public.mcp_comm_whatsapp_set_chat_unread(uuid, uuid, boolean, timestamptz, text)'::regprocedure), 'unread RPC returns a JSON contract');
SELECT ok((SELECT prorettype = 'jsonb'::regtype FROM pg_proc WHERE oid = 'public.mcp_comm_whatsapp_mark_chat_read(uuid, uuid, timestamptz, uuid, timestamptz, text)'::regprocedure), 'mark-read RPC returns a JSON contract');
SELECT ok((SELECT prorettype = 'jsonb'::regtype FROM pg_proc WHERE oid = 'public.mcp_comm_whatsapp_link_chat_lead(uuid, uuid, uuid, timestamptz, text)'::regprocedure), 'link RPC returns a JSON contract');
SELECT ok((SELECT prorettype = 'jsonb'::regtype FROM pg_proc WHERE oid = 'public.mcp_comm_whatsapp_unlink_chat_lead(uuid, uuid, timestamptz, text)'::regprocedure), 'unlink RPC returns a JSON contract');

SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.mcp_comm_whatsapp_set_chat_archived(uuid, uuid, boolean, timestamptz, text)'::regprocedure), 'archive RPC is SECURITY DEFINER');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.mcp_comm_whatsapp_set_chat_pinned(uuid, uuid, boolean, timestamptz, text)'::regprocedure), 'pin RPC is SECURITY DEFINER');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.mcp_comm_whatsapp_set_chat_muted(uuid, uuid, boolean, timestamptz, text)'::regprocedure), 'mute RPC is SECURITY DEFINER');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.mcp_comm_whatsapp_set_chat_unread(uuid, uuid, boolean, timestamptz, text)'::regprocedure), 'unread RPC is SECURITY DEFINER');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.mcp_comm_whatsapp_mark_chat_read(uuid, uuid, timestamptz, uuid, timestamptz, text)'::regprocedure), 'mark-read RPC is SECURITY DEFINER');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.mcp_comm_whatsapp_link_chat_lead(uuid, uuid, uuid, timestamptz, text)'::regprocedure), 'link RPC is SECURITY DEFINER');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.mcp_comm_whatsapp_unlink_chat_lead(uuid, uuid, timestamptz, text)'::regprocedure), 'unlink RPC is SECURITY DEFINER');

SELECT ok(has_function_privilege('service_role', 'public.mcp_comm_whatsapp_set_chat_archived(uuid, uuid, boolean, timestamptz, text)'::regprocedure, 'EXECUTE'), 'service_role can invoke archive RPC');
SELECT ok(has_function_privilege('service_role', 'public.mcp_comm_whatsapp_set_chat_pinned(uuid, uuid, boolean, timestamptz, text)'::regprocedure, 'EXECUTE'), 'service_role can invoke pin RPC');
SELECT ok(has_function_privilege('service_role', 'public.mcp_comm_whatsapp_set_chat_muted(uuid, uuid, boolean, timestamptz, text)'::regprocedure, 'EXECUTE'), 'service_role can invoke mute RPC');
SELECT ok(has_function_privilege('service_role', 'public.mcp_comm_whatsapp_set_chat_unread(uuid, uuid, boolean, timestamptz, text)'::regprocedure, 'EXECUTE'), 'service_role can invoke unread RPC');
SELECT ok(has_function_privilege('service_role', 'public.mcp_comm_whatsapp_mark_chat_read(uuid, uuid, timestamptz, uuid, timestamptz, text)'::regprocedure, 'EXECUTE'), 'service_role can invoke mark-read RPC');
SELECT ok(has_function_privilege('service_role', 'public.mcp_comm_whatsapp_link_chat_lead(uuid, uuid, uuid, timestamptz, text)'::regprocedure, 'EXECUTE'), 'service_role can invoke link RPC');
SELECT ok(has_function_privilege('service_role', 'public.mcp_comm_whatsapp_unlink_chat_lead(uuid, uuid, timestamptz, text)'::regprocedure, 'EXECUTE'), 'service_role can invoke unlink RPC');

SELECT ok(NOT has_function_privilege('anon', 'public.mcp_comm_whatsapp_set_chat_archived(uuid, uuid, boolean, timestamptz, text)'::regprocedure, 'EXECUTE'), 'anon cannot invoke archive RPC');
SELECT ok(NOT has_function_privilege('anon', 'public.mcp_comm_whatsapp_set_chat_pinned(uuid, uuid, boolean, timestamptz, text)'::regprocedure, 'EXECUTE'), 'anon cannot invoke pin RPC');
SELECT ok(NOT has_function_privilege('anon', 'public.mcp_comm_whatsapp_set_chat_muted(uuid, uuid, boolean, timestamptz, text)'::regprocedure, 'EXECUTE'), 'anon cannot invoke mute RPC');
SELECT ok(NOT has_function_privilege('anon', 'public.mcp_comm_whatsapp_set_chat_unread(uuid, uuid, boolean, timestamptz, text)'::regprocedure, 'EXECUTE'), 'anon cannot invoke unread RPC');
SELECT ok(NOT has_function_privilege('anon', 'public.mcp_comm_whatsapp_mark_chat_read(uuid, uuid, timestamptz, uuid, timestamptz, text)'::regprocedure, 'EXECUTE'), 'anon cannot invoke mark-read RPC');
SELECT ok(NOT has_function_privilege('anon', 'public.mcp_comm_whatsapp_link_chat_lead(uuid, uuid, uuid, timestamptz, text)'::regprocedure, 'EXECUTE'), 'anon cannot invoke link RPC');
SELECT ok(NOT has_function_privilege('anon', 'public.mcp_comm_whatsapp_unlink_chat_lead(uuid, uuid, timestamptz, text)'::regprocedure, 'EXECUTE'), 'anon cannot invoke unlink RPC');

SELECT ok(NOT has_function_privilege('authenticated', 'public.mcp_comm_whatsapp_set_chat_archived(uuid, uuid, boolean, timestamptz, text)'::regprocedure, 'EXECUTE'), 'authenticated cannot invoke archive RPC');
SELECT ok(NOT has_function_privilege('authenticated', 'public.mcp_comm_whatsapp_set_chat_pinned(uuid, uuid, boolean, timestamptz, text)'::regprocedure, 'EXECUTE'), 'authenticated cannot invoke pin RPC');
SELECT ok(NOT has_function_privilege('authenticated', 'public.mcp_comm_whatsapp_set_chat_muted(uuid, uuid, boolean, timestamptz, text)'::regprocedure, 'EXECUTE'), 'authenticated cannot invoke mute RPC');
SELECT ok(NOT has_function_privilege('authenticated', 'public.mcp_comm_whatsapp_set_chat_unread(uuid, uuid, boolean, timestamptz, text)'::regprocedure, 'EXECUTE'), 'authenticated cannot invoke unread RPC');
SELECT ok(NOT has_function_privilege('authenticated', 'public.mcp_comm_whatsapp_mark_chat_read(uuid, uuid, timestamptz, uuid, timestamptz, text)'::regprocedure, 'EXECUTE'), 'authenticated cannot invoke mark-read RPC');
SELECT ok(NOT has_function_privilege('authenticated', 'public.mcp_comm_whatsapp_link_chat_lead(uuid, uuid, uuid, timestamptz, text)'::regprocedure, 'EXECUTE'), 'authenticated cannot invoke link RPC');
SELECT ok(NOT has_function_privilege('authenticated', 'public.mcp_comm_whatsapp_unlink_chat_lead(uuid, uuid, timestamptz, text)'::regprocedure, 'EXECUTE'), 'authenticated cannot invoke unlink RPC');

SELECT ok(NOT has_function_privilege('service_role', 'public._mcp_comm_whatsapp_assert_active_admin(uuid)'::regprocedure, 'EXECUTE'), 'service_role cannot call actor validation directly');
SELECT ok(NOT has_function_privilege('service_role', 'public._mcp_comm_whatsapp_begin_action(uuid, text, text, uuid, jsonb)'::regprocedure, 'EXECUTE'), 'service_role cannot call idempotency helper directly');
SELECT ok(NOT has_function_privilege('service_role', 'public._mcp_comm_whatsapp_complete_action(uuid, text, uuid, jsonb, jsonb, jsonb)'::regprocedure, 'EXECUTE'), 'service_role cannot call audit completion helper directly');
SELECT ok(NOT has_function_privilege('service_role', 'public._mcp_comm_whatsapp_chat_state(uuid)'::regprocedure, 'EXECUTE'), 'service_role cannot call projection helper directly');
SELECT ok(NOT has_function_privilege('service_role', 'public._mcp_comm_whatsapp_mutate_chat_flag(uuid, uuid, text, boolean, timestamptz, text)'::regprocedure, 'EXECUTE'), 'service_role cannot call state mutation helper directly');
SELECT ok(NOT has_function_privilege('service_role', 'public._mcp_comm_whatsapp_mark_chat_read(uuid, uuid, timestamptz, uuid, timestamptz, text)'::regprocedure, 'EXECUTE'), 'service_role cannot call mark-read helper directly');
SELECT ok(NOT has_function_privilege('service_role', 'public._mcp_comm_whatsapp_mutate_chat_lead(uuid, uuid, uuid, boolean, timestamptz, text)'::regprocedure, 'EXECUTE'), 'service_role cannot call lead mutation helper directly');

SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.mcp_comm_whatsapp_action_audit'::regclass), 'MCP Inbox audit table has RLS enabled');
SELECT ok(NOT has_table_privilege('service_role', 'public.mcp_comm_whatsapp_action_audit', 'SELECT'), 'service_role has no direct audit-table read access');
SELECT ok(NOT has_table_privilege('service_role', 'public.mcp_comm_whatsapp_action_audit', 'INSERT'), 'service_role has no direct audit-table insert access');
SELECT ok(NOT has_table_privilege('authenticated', 'public.mcp_comm_whatsapp_action_audit', 'SELECT'), 'authenticated has no direct audit-table access');
SELECT ok(NOT has_table_privilege('anon', 'public.mcp_comm_whatsapp_action_audit', 'SELECT'), 'anon has no direct audit-table access');

SELECT * FROM finish();
ROLLBACK;
