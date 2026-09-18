BEGIN;
SET LOCAL search_path = extensions, public, pg_catalog;

SELECT plan(15);

SELECT ok(to_regclass('public.comm_whatsapp_presences') IS NOT NULL, 'presence snapshot table exists');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.comm_whatsapp_presences'::regclass), 'presence snapshot has RLS enabled');
SELECT ok(has_table_privilege('authenticated', 'public.comm_whatsapp_presences', 'SELECT'), 'Inbox users can read presence snapshots');
SELECT ok(NOT has_table_privilege('authenticated', 'public.comm_whatsapp_presences', 'INSERT'), 'Inbox users cannot write presence snapshots directly');
SELECT ok(NOT has_table_privilege('authenticated', 'public.comm_whatsapp_presences', 'UPDATE'), 'Inbox users cannot update presence snapshots directly');
SELECT ok(has_table_privilege('service_role', 'public.comm_whatsapp_presences', 'INSERT'), 'service role can persist presence snapshots');
SELECT ok(has_table_privilege('service_role', 'public.comm_whatsapp_presences', 'UPDATE'), 'service role can update presence snapshots');
SELECT ok(to_regprocedure('public.comm_whatsapp_list_chats_with_presence(text, text, text, text, text, text[], text[], integer, integer)') IS NOT NULL, 'presence-aware chat list RPC exists');
SELECT ok(to_regprocedure('public.comm_whatsapp_get_chat_thread_with_groups(uuid, integer)') IS NOT NULL, 'thread RPC remains available with presence fields');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid = 'public.comm_whatsapp_list_chats_with_presence(text, text, text, text, text, text[], text[], integer, integer)'::regprocedure), 'presence list RPC is SECURITY DEFINER');
SELECT ok(NOT has_function_privilege('anon', 'public.comm_whatsapp_list_chats_with_presence(text, text, text, text, text, text[], text[], integer, integer)'::regprocedure, 'EXECUTE'), 'anonymous users cannot read presence list');
SELECT ok(has_function_privilege('authenticated', 'public.comm_whatsapp_list_chats_with_presence(text, text, text, text, text, text[], text[], integer, integer)'::regprocedure, 'EXECUTE'), 'authorized Inbox users can read presence list');
SELECT ok(position('comm_whatsapp_presences' IN pg_get_functiondef('public.comm_whatsapp_list_chats_with_presence(text, text, text, text, text, text[], text[], integer, integer)'::regprocedure)) > 0, 'presence list joins the snapshot table');
SELECT ok((SELECT COUNT(*) = 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'comm_whatsapp_presences'), 'presence snapshots are available through realtime');
SELECT ok((SELECT COUNT(*) = 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'comm_whatsapp_presences' AND column_name = 'last_seen_at'), 'presence snapshot stores last seen');

SELECT * FROM finish();
ROLLBACK;
