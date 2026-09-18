BEGIN;
SET LOCAL search_path = extensions, public, pg_catalog;

SELECT plan(27);

SELECT ok(to_regclass('public.comm_whatsapp_groups') IS NOT NULL, 'group metadata table exists');
SELECT ok(to_regclass('public.comm_whatsapp_group_participants') IS NOT NULL, 'group participants table exists');
SELECT ok(to_regclass('public.comm_whatsapp_group_events') IS NOT NULL, 'group events table exists');
SELECT ok((SELECT COUNT(*) = 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'comm_whatsapp_chats' AND column_name = 'is_group'), 'chat exposes is_group');

SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.comm_whatsapp_groups'::regclass), 'group metadata has RLS enabled');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.comm_whatsapp_group_participants'::regclass), 'group participants have RLS enabled');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.comm_whatsapp_group_events'::regclass), 'group events have RLS enabled');

SELECT ok(has_table_privilege('authenticated', 'public.comm_whatsapp_groups', 'SELECT'), 'Inbox users can read group metadata');
SELECT ok(has_table_privilege('authenticated', 'public.comm_whatsapp_group_participants', 'SELECT'), 'Inbox users can read group participants');
SELECT ok(has_table_privilege('authenticated', 'public.comm_whatsapp_group_events', 'SELECT'), 'Inbox users can read group events');
SELECT ok(NOT has_table_privilege('authenticated', 'public.comm_whatsapp_groups', 'INSERT'), 'Inbox users cannot write group metadata directly');
SELECT ok(NOT has_table_privilege('authenticated', 'public.comm_whatsapp_group_participants', 'UPDATE'), 'Inbox users cannot update participants directly');
SELECT ok(NOT has_table_privilege('authenticated', 'public.comm_whatsapp_group_events', 'DELETE'), 'Inbox users cannot delete group events directly');
SELECT ok(has_table_privilege('service_role', 'public.comm_whatsapp_groups', 'INSERT'), 'service role can persist group metadata');
SELECT ok(has_table_privilege('service_role', 'public.comm_whatsapp_group_participants', 'UPDATE'), 'service role can persist participants');
SELECT ok(has_table_privilege('service_role', 'public.comm_whatsapp_group_events', 'INSERT'), 'service role can persist group events');

SELECT ok(to_regprocedure('public.comm_whatsapp_get_group_context(uuid)') IS NOT NULL, 'group context RPC exists');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.comm_whatsapp_get_group_context(uuid)'::regprocedure), 'group context RPC is SECURITY DEFINER');
SELECT ok(has_function_privilege('authenticated', 'public.comm_whatsapp_get_group_context(uuid)'::regprocedure, 'EXECUTE'), 'authorized Inbox users can read group context');
SELECT ok(NOT has_function_privilege('anon', 'public.comm_whatsapp_get_group_context(uuid)'::regprocedure, 'EXECUTE'), 'anonymous users cannot read group context');
SELECT ok(to_regprocedure('public.comm_whatsapp_list_chats_with_groups(text, text, text, text, text, text[], text[], integer, integer)') IS NOT NULL, 'group-aware chat list RPC exists');
SELECT ok(to_regprocedure('public.comm_whatsapp_get_chat_thread_with_groups(uuid, integer)') IS NOT NULL, 'group-aware thread RPC exists');
SELECT ok(to_regprocedure('public.create_comm_whatsapp_group_scheduled_message(uuid, uuid, timestamptz, text, text, text, text, text, text, jsonb, timestamptz, text, text, integer, boolean)') IS NOT NULL, 'group scheduling RPC exists');

SELECT ok(position('lead_id := NULL' IN pg_get_functiondef('public.comm_whatsapp_enforce_group_chat_identity()'::regprocedure)) > 0, 'group trigger clears lead links');
SELECT ok(position('auto_link_blocked := true' IN pg_get_functiondef('public.comm_whatsapp_enforce_group_chat_identity()'::regprocedure)) > 0, 'group trigger blocks CRM auto-link');
SELECT ok(to_regprocedure('public.comm_whatsapp_reject_group_automation_row()') IS NOT NULL, 'group automation guard exists');
SELECT ok(position('campanhas ou automacoes de IA' IN pg_get_functiondef('public.comm_whatsapp_reject_group_automation_row()'::regprocedure)) > 0, 'group automation guard rejects CRM automation');

SELECT * FROM finish();
ROLLBACK;
