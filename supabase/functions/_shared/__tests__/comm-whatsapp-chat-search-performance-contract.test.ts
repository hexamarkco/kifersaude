import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const migration = readFileSync(resolve(process.cwd(),
  'supabase/migrations/20261015020002_fix_inbox_chat_search_timeout_and_accents.sql'), 'utf8');

test('busca aliases uma vez e resolve nomes apenas depois da paginação', () => {
  const list = migration.split('CREATE OR REPLACE FUNCTION public.comm_whatsapp_list_chats(')[1]
    .split('$function$;')[0];
  const searchPredicate = list.slice(list.indexOf('input.search_text IS NULL'), list.indexOf('    ORDER BY c.is_pinned'));
  assert.match(list, /matching_contacts AS MATERIALIZED/);
  assert.match(list, /c\.id IN \(SELECT id FROM matching_contact_chats\)/);
  assert.match(searchPredicate, /comm_whatsapp_normalize_search\(l\.nome_completo\)/);
  assert.doesNotMatch(searchPredicate, /comm_whatsapp_preferred_saved_contact_name/);
  assert.match(migration, /idx_comm_whatsapp_contacts_saved_normalized_id/);
});

test('resolve identidades somente para os chats distintos da página de mensagens', () => {
  const messages = migration.split('CREATE OR REPLACE FUNCTION public.comm_whatsapp_search_messages(')[1];
  const page = messages.split('message_page AS MATERIALIZED (')[1].split('page_chats AS MATERIALIZED (')[0];
  assert.match(page, /LIMIT \(SELECT safe_limit FROM input\)/);
  assert.doesNotMatch(page, /comm_whatsapp_preferred_saved_contact_name/);
  assert.match(messages, /chat_row\.id IN \(SELECT chat_id FROM message_page\)/);
  assert.match(messages, /'lead_name', lead\.nome_completo/);
});
