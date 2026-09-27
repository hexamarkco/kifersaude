import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'vitest';

const migrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261013140000_optimize_campaign_stop_on_reply_lock.sql'),
  'utf8',
);

const functionSource = migrationSource.slice(
  migrationSource.indexOf('CREATE OR REPLACE FUNCTION public.resolve_comm_whatsapp_campaign_stop_on_reply'),
);

test('stop-on-reply resolve o chat sem esperar lock de atualização de identidade', () => {
  assert.match(functionSource, /v_chat_id uuid := public\.comm_whatsapp_resolve_chat_uuid\(p_chat_id\)/);
  assert.doesNotMatch(functionSource, /v_chat_id uuid := public\.comm_whatsapp_lock_canonical_chat_uuid\(p_chat_id\)/);
  assert.match(functionSource, /UPDATE public\.comm_whatsapp_campaign_targets/);
});
