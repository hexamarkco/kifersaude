import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  DEFAULT_TRANSCRIPT_TIME_ZONE,
  buildTranscriptContent,
  buildTranscriptLine,
  formatTranscriptTimestamp,
  normalizeSystemTimeZone,
} from '../messageTranscript';
import type { CommWhatsAppMessage } from '../types';

const createMessage = (overrides: Partial<CommWhatsAppMessage> = {}): CommWhatsAppMessage => ({
  id: 'message-1',
  chat_id: 'chat-1',
  channel_id: 'channel-1',
  direction: 'inbound',
  message_type: 'text',
  delivery_status: 'received',
  text_content: 'Olá',
  message_at: '2026-09-08T15:30:00.000Z',
  metadata: {},
  created_at: '2026-09-08T15:30:00.000Z',
  ...overrides,
});

test('normalizes invalid time zones and formats transcript timestamps', () => {
  assert.equal(normalizeSystemTimeZone('Invalid/Zone'), DEFAULT_TRANSCRIPT_TIME_ZONE);
  assert.equal(formatTranscriptTimestamp('invalid', DEFAULT_TRANSCRIPT_TIME_ZONE), '[--:--, --/--/----]');
  assert.equal(formatTranscriptTimestamp('2026-09-08T15:30:00.000Z', DEFAULT_TRANSCRIPT_TIME_ZONE), '[12:30, 08/09/2026]');
});

test('omits system, failed outbound, and hidden technical messages', () => {
  assert.equal(buildTranscriptContent(createMessage({ direction: 'system' })), '');
  assert.equal(buildTranscriptContent(createMessage({ direction: 'outbound', delivery_status: 'failed' })), '');
  assert.equal(buildTranscriptContent(createMessage({ text_content: '[Mensagem]' })), '');
});

test('builds media and audio transcript content', () => {
  assert.equal(buildTranscriptContent(createMessage({ message_type: 'image', media_caption: '  Proposta   atualizada ' })), '[Imagem] Proposta atualizada');
  assert.equal(buildTranscriptContent(createMessage({ message_type: 'voice', transcription_text: 'Vou analisar' })), 'Vou analisar');
  assert.equal(buildTranscriptContent(createMessage({ message_type: 'audio', transcription_text: null })), '[Áudio sem transcrição]');
});

test('marks deleted content and uses the correct author in complete lines', () => {
  const deleted = createMessage({ direction: 'outbound', delivery_status: 'deleted', text_content: 'Texto anterior' });
  assert.equal(buildTranscriptContent(deleted), '[Mensagem apagada] Texto anterior');
  assert.equal(
    buildTranscriptLine(deleted, 'Maria', DEFAULT_TRANSCRIPT_TIME_ZONE),
    '[12:30, 08/09/2026] Eu: [Mensagem apagada] Texto anterior',
  );
});
