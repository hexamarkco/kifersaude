BEGIN;
SET LOCAL search_path = extensions, public, pg_catalog;

SELECT plan(6);

SELECT ok(
  to_regprocedure('public.comm_whatsapp_list_chats(text, text, text, text, text, text[], text[], integer, integer)') IS NOT NULL,
  'chat list RPC exists'
);
SELECT ok(
  position('contact.saved = true' IN pg_get_functiondef('public.comm_whatsapp_list_chats(text, text, text, text, text, text[], text[], integer, integer)'::regprocedure)) > 0,
  'chat list checks saved contact cache'
);
SELECT ok(
  position('contact.display_name ilike' IN lower(pg_get_functiondef('public.comm_whatsapp_list_chats(text, text, text, text, text, text[], text[], integer, integer)'::regprocedure))) > 0,
  'chat search includes cached saved contact name'
);
SELECT ok(
  position('input.saved_filter = ''saved''' IN pg_get_functiondef('public.comm_whatsapp_list_chats(text, text, text, text, text, text[], text[], integer, integer)'::regprocedure)) > 0,
  'saved filter remains part of the RPC'
);
SELECT ok(
  has_function_privilege(
    'authenticated',
    'public.comm_whatsapp_list_chats(text, text, text, text, text, text[], text[], integer, integer)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated Inbox users can execute the RPC'
);
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.comm_whatsapp_list_chats(text, text, text, text, text, text[], text[], integer, integer)'::regprocedure,
    'EXECUTE'
  ),
  'anonymous users cannot execute the RPC'
);

SELECT * FROM finish();
ROLLBACK;
