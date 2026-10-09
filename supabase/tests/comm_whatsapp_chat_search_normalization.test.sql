BEGIN;
SET LOCAL search_path = extensions, public, pg_catalog;
SELECT plan(9);

SELECT is(public.comm_whatsapp_normalize_search('Cláudia'), 'claudia', 'ignores composed accents');
SELECT is(public.comm_whatsapp_normalize_search('CLAUDIA'), 'claudia', 'ignores case');
SELECT is(public.comm_whatsapp_normalize_search(U&'Cla\0301udia'), 'claudia', 'ignores decomposed accents');
SELECT is(public.comm_whatsapp_normalize_search(U&' Cla\0301udia\00a0   Santos '), 'claudia santos', 'collapses pasted whitespace');
SELECT is(public.comm_whatsapp_normalize_search(U&'Clau\200bdia'), 'claudia', 'removes invisible formatting');
SELECT is(public.comm_whatsapp_normalize_search('São Gonçalo'), 'sao goncalo', 'handles Portuguese accents and cedilla');
SELECT is(public.comm_whatsapp_normalize_search(NULL), '', 'handles null identity fields');
SELECT ok(NOT has_function_privilege('anon', 'public.comm_whatsapp_list_chats(text,text,text,text,text,text[],text[],integer,integer)', 'EXECUTE'), 'preserves anonymous denial');
SELECT ok(has_function_privilege('authenticated', 'public.comm_whatsapp_list_chats(text,text,text,text,text,text[],text[],integer,integer)', 'EXECUTE'), 'preserves authenticated RPC access');

SELECT * FROM finish();
ROLLBACK;
