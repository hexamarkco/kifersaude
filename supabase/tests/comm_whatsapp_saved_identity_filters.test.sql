BEGIN;
SET LOCAL search_path = extensions, public, pg_catalog;

SELECT plan(9);

SELECT ok(
  to_regprocedure('public.comm_whatsapp_list_chats(text, text, text, text, text, text[], text[], integer, integer)') IS NOT NULL,
  'chat list RPC exists'
);
SELECT ok(
  position('contact.saved = true' IN pg_get_functiondef('public.comm_whatsapp_list_chats(text, text, text, text, text, text[], text[], integer, integer)'::regprocedure)) > 0,
  'chat list checks saved contact cache'
);
SELECT ok(
  position('comm_whatsapp_normalize_search(contact.display_name)' IN lower(pg_get_functiondef('public.comm_whatsapp_list_chats(text, text, text, text, text, text[], text[], integer, integer)'::regprocedure))) > 0,
  'chat search includes cached saved contact name'
);
SELECT ok(
  position('comm_whatsapp_preferred_saved_contact_name(' IN pg_get_functiondef('public.comm_whatsapp_list_chats(text, text, text, text, text, text[], text[], integer, integer)'::regprocedure)) > 0,
  'chat filters use the canonical saved contact resolver'
);
SELECT ok(
  position('coalesce(c.phone_digits, c.phone_number)' IN lower(pg_get_functiondef('public.comm_whatsapp_list_chats(text, text, text, text, text, text[], text[], integer, integer)'::regprocedure))) > 0,
  'canonical resolver receives a phone fallback for identifier-only chats'
);
SELECT ok(
  position('coalesce(v_chat.phone_digits, v_chat.phone_number)' IN lower(pg_get_functiondef('public.comm_whatsapp_refresh_chat_identity(uuid)'::regprocedure))) > 0,
  'chat identity refresh uses the phone number fallback'
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
