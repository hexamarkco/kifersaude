import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'vitest';

const migrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260927204749_fix_scheduled_message_chat_scope.sql'),
  'utf8',
);
const serviceSource = readFileSync(
  resolve(process.cwd(), 'src/features/communication/whatsapp/data/commWhatsAppService.ts'),
  'utf8',
);

test('RPC de agendamento usa o chat selecionado e restringe o fallback ao canal', () => {
  assert.match(migrationSource, /CREATE OR REPLACE FUNCTION public\.create_scheduled_message_for_chat\(/);
  assert.match(migrationSource, /WHERE id = p_chat_id\s+AND channel_id = p_channel_id/);
  assert.match(migrationSource, /WHERE channel_id = p_channel_id\s+AND phone_digits = p_phone_digits/);
  assert.match(serviceSource, /create_scheduled_message_for_chat'[\s\S]*p_chat_id: input\.chatId/);
  assert.doesNotMatch(migrationSource, /GRANT EXECUTE[\s\S]*TO (?:PUBLIC|anon)/);
});
