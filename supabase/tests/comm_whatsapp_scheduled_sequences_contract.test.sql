BEGIN;
SET LOCAL search_path = extensions, public, pg_catalog;

SELECT plan(20);

SELECT ok(to_regclass('public.comm_whatsapp_scheduled_sequences') IS NOT NULL, 'scheduled sequence table exists');
SELECT ok(to_regclass('public.comm_whatsapp_scheduled_sequence_steps') IS NOT NULL, 'scheduled sequence steps table exists');
SELECT ok(to_regclass('public.comm_whatsapp_scheduled_sequence_actions') IS NOT NULL, 'scheduled sequence actions table exists');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.comm_whatsapp_scheduled_sequences'::regclass), 'scheduled sequences have RLS enabled');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.comm_whatsapp_scheduled_sequence_steps'::regclass), 'scheduled sequence steps have RLS enabled');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.comm_whatsapp_scheduled_sequence_actions'::regclass), 'scheduled sequence actions have RLS enabled');
SELECT ok(has_table_privilege('authenticated', 'public.comm_whatsapp_scheduled_sequences', 'SELECT'), 'authenticated users can read scheduled sequences');
SELECT ok(has_table_privilege('authenticated', 'public.comm_whatsapp_scheduled_sequences', 'UPDATE'), 'authenticated users can manage scheduled sequences through RLS');
SELECT ok(has_table_privilege('service_role', 'public.comm_whatsapp_scheduled_sequence_steps', 'UPDATE'), 'service role can claim sequence steps');
SELECT ok(to_regprocedure('public.create_scheduled_message_sequence(uuid, text, timestamptz, jsonb, uuid, uuid, uuid, uuid, text, boolean)') IS NOT NULL, 'sequence creation RPC exists');
SELECT ok(to_regprocedure('public.claim_scheduled_message_sequence_steps(integer)') IS NOT NULL, 'sequence claim RPC exists');
SELECT ok(to_regprocedure('public.cancel_scheduled_message_sequence(uuid, text)') IS NOT NULL, 'sequence cancellation RPC exists');
SELECT ok(to_regprocedure('public.retry_scheduled_message_sequence(uuid)') IS NOT NULL, 'sequence retry RPC exists');
SELECT ok((SELECT COUNT(*) = 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'comm_whatsapp_scheduled_sequences' AND column_name = 'mcp_client_request_id'), 'scheduled sequences support MCP idempotency');
SELECT ok(to_regprocedure('public.create_scheduled_message_sequence_for_mcp(uuid, text, timestamptz, jsonb, uuid, text, uuid, uuid, uuid, uuid, text, boolean)') IS NOT NULL, 'MCP sequence creation RPC exists');
SELECT ok(has_function_privilege('service_role', 'public.create_scheduled_message_sequence_for_mcp(uuid, text, timestamptz, jsonb, uuid, text, uuid, uuid, uuid, uuid, text, boolean)'::regprocedure, 'EXECUTE'), 'service role can create MCP sequences');
SELECT ok(NOT has_function_privilege('authenticated', 'public.create_scheduled_message_sequence_for_mcp(uuid, text, timestamptz, jsonb, uuid, text, uuid, uuid, uuid, uuid, text, boolean)'::regprocedure, 'EXECUTE'), 'authenticated users cannot call MCP sequence creation RPC');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.claim_scheduled_message_sequence_steps(integer)'::regprocedure), 'sequence claim RPC is SECURITY DEFINER');
SELECT ok(NOT has_function_privilege('anon', 'public.claim_scheduled_message_sequence_steps(integer)'::regprocedure, 'EXECUTE'), 'anonymous users cannot claim sequence steps');
SELECT ok((SELECT COUNT(*) = 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'comm_whatsapp_scheduled_messages' AND column_name = 'sequence_step_id'), 'scheduled messages keep sequence step provenance');

SELECT * FROM finish();
ROLLBACK;
