import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'vitest';

const migrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260927205632_fix_scheduled_sequence_chat_scope.sql'),
  'utf8',
);
const serviceSource = readFileSync(
  resolve(process.cwd(), 'src/features/communication/whatsapp/data/commWhatsAppService.ts'),
  'utf8',
);

test('sequence creation resolves the chat inside the selected channel', () => {
  assert.match(migrationSource, /CREATE OR REPLACE FUNCTION public\.create_scheduled_message_sequence/);
  assert.match(
    migrationSource,
    /WHERE channel_id = p_channel_id\s+AND phone_digits = p_phone_digits\s+AND deleted_at IS NULL/,
  );
  assert.match(
    migrationSource,
    /WHERE id = v_chat_id\s+AND channel_id = p_channel_id\s+AND deleted_at IS NULL/,
  );
  assert.match(migrationSource, /Conversa de WhatsApp não encontrada no canal selecionado/);
  assert.match(migrationSource, /COALESCE\(v_phone_digits, p_phone_digits\)/);
});

test('the inbox service sends the selected chat when creating a sequence', () => {
  const scheduleSequenceSource = serviceSource.slice(serviceSource.indexOf('async scheduleSequence'));
  assert.match(scheduleSequenceSource, /p_chat_id: input\.chatId \?\? null/);
});
