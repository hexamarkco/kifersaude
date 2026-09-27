import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const migrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260927194827_index_comm_whatsapp_media_id_lookup.sql'),
  'utf8',
);

test('mantém o lookup de metadados de mídia indexado por media_id', () => {
  assert.match(migrationSource, /CREATE INDEX IF NOT EXISTS idx_comm_whatsapp_messages_media_id/);
  assert.match(migrationSource, /ON public\.comm_whatsapp_messages \(media_id\)/);
  assert.match(migrationSource, /WHERE media_id IS NOT NULL/);
});
