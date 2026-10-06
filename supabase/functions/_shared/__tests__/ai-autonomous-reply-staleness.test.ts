import assert from 'node:assert/strict';
import { test } from 'vitest';
import { getLatestAutonomousInboundMessageId, isAutonomousReplyStale } from '../ai-autonomous-reply-staleness.ts';
import { buildTranscriptLine, getMessageContent, type MessageRow } from '../comm-whatsapp-transcript.ts';

const message = (overrides: Partial<MessageRow> = {}): MessageRow => ({
  id: 'inbound-1',
  direction: 'inbound',
  message_type: 'text',
  delivery_status: 'received',
  text_content: 'Para mim e minha família.',
  message_at: '2026-10-06T10:00:21Z',
  media_caption: null,
  transcription_text: null,
  ...overrides,
});

const technicalEvent = message({ id: 'technical-event', message_type: 'unknown', text_content: '[Mensagem]' });

test('catch-up after approach has no customer message when only a technical event arrived', () => {
  const opening = message({ id: 'opening', direction: 'outbound', text_content: 'Você busca um plano só para você ou para a família?' });
  const history = [technicalEvent, opening];
  assert.equal(getMessageContent(technicalEvent), '');
  assert.equal(buildTranscriptLine(technicalEvent, 'Cliente', 'America/Sao_Paulo'), null);
  assert.equal(getLatestAutonomousInboundMessageId(history), null);
  assert.deepEqual(history.map(getMessageContent).filter(Boolean), [opening.text_content]);
});

test('technical event during generation does not invalidate a real customer turn', () => {
  const latest = getLatestAutonomousInboundMessageId([technicalEvent, message()]);
  assert.equal(latest, 'inbound-1');
  assert.equal(isAutonomousReplyStale('inbound-1', latest), false);
});

test('real inbound after technical event still invalidates the earlier turn', () => {
  const latest = getLatestAutonomousInboundMessageId([technicalEvent, message({ id: 'inbound-2' }), message()]);
  assert.equal(isAutonomousReplyStale('inbound-1', latest), true);
});

test.each([
  { message_type: 'text', text_content: 'Mensagem' },
  { message_type: 'text', text_content: '[Mensagem]' },
  { message_type: 'unknown', text_content: 'Quero saber sobre o plano.' },
  { message_type: 'unknown', text_content: '[Mensagem]', media_caption: 'Minha dúvida sobre o plano' },
  { message_type: 'image', text_content: '[Imagem]' },
  { message_type: 'audio', text_content: null },
  { message_type: 'voice', text_content: null, transcription_text: 'Quero um plano.' },
])('preserves real text and supported media: %j', (overrides) => {
  const row = message(overrides);
  assert.ok(getMessageContent(row));
  assert.equal(getLatestAutonomousInboundMessageId([row]), row.id);
});

test('keeps a generated reply when the prompt inbound is still the latest one', () => {
  assert.equal(isAutonomousReplyStale('inbound-1', 'inbound-1'), false);
});

test('discards a generated reply when the customer wrote again during generation', () => {
  assert.equal(isAutonomousReplyStale('inbound-1', 'inbound-2'), true);
});

test('fails closed when the prompt inbound is no longer available', () => {
  assert.equal(isAutonomousReplyStale('inbound-1', null), true);
});
