import assert from 'node:assert/strict';
import { test } from 'vitest';
import { getLatestAutonomousInboundMessageId, isAutonomousReplyStale, orderAutonomousConversationalMessages } from '../ai-autonomous-reply-staleness.ts';
import { buildTranscriptLine, getMessageContent, isTechnicalWhatsAppEvent, type MessageRow } from '../comm-whatsapp-transcript.ts';
import { shouldHideTechnicalMessage } from '../../../../src/features/communication/whatsapp/domain/messageVisibility.ts';
import type { CommWhatsAppMessage } from '../../../../src/features/communication/whatsapp/domain/types.ts';

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

const technicalCases = [
  ['action', '[Ação]'], ['action', '[Reação]'], ['action', '[Voto em enquete]'],
  ['action', '[Atualização de mídia]'], ['action', '[Mensagem apagada]'],
  ['unknown', '[Mensagem]'], ['unknown', '[Mensagem sem texto]'],
  ['album', '[Álbum]'], ['unknown', '[Payload inválido]'],
  ['text', '[Mensagem]'], ['text', '[Mensagem sem conteúdo]'],
  ['reaction', '[Reação]'], ['receipt', 'read'], ['ack', 'ack'],
  ['status', 'delivered'], ['notification', '[Notificação]'],
  ['protocol', 'meta'], ['system', '[Sistema]'],
  ['call', '[Chamada]'], ['pin', '[Fixada]'], ['story', '[Status]'],
] as const;

test.each(technicalCases)('technical %s %s is invisible to the AI', (type, body) => {
  const row = message({ id: 'tech', message_type: type, text_content: body });
  assert.equal(isTechnicalWhatsAppEvent(row), true);
  assert.equal(getMessageContent(row), '');
  assert.equal(buildTranscriptLine(row, 'Cliente', 'America/Sao_Paulo'), null);
  assert.equal(getLatestAutonomousInboundMessageId([row]), null);
});

test.each([
  ['action', '[Ação]'], ['action', '[Reação]'], ['action', '[Voto em enquete]'],
  ['unknown', '[Mensagem]'], ['album', '[Álbum]'], ['text', '[Mensagem]'],
])('Inbox and autonomous engine agree on hidden %s %s', (type, body) => {
  const row = message({ message_type: type, text_content: body });
  assert.equal(shouldHideTechnicalMessage({
    ...row, chat_id: 'chat', channel_id: 'channel', metadata: {}, created_at: row.message_at,
  } as CommWhatsAppMessage), true);
  assert.equal(getMessageContent(row), '');
});

test('keeps customer-selected actions, genuine unknown text, media and captions', () => {
  const real = [
    message({ id: 'button', message_type: 'action', text_content: 'Sim, só para mim' }),
    message({ id: 'unknown-real', message_type: 'unknown', text_content: 'Eu tenho 53 anos' }),
    message({ id: 'photo', message_type: 'image', text_content: '[Imagem]', media_url: 'https://example.com/photo.jpg' }),
    message({ id: 'caption', message_type: 'album', text_content: '[Álbum]', media_caption: 'Esses são os documentos' }),
    message({ id: 'voice', message_type: 'voice', text_content: '[Audio]', transcription_text: 'Boa tarde' }),
  ];
  for (const row of real) {
    assert.equal(isTechnicalWhatsAppEvent(row), false, row.id);
    assert.ok(getMessageContent(row), row.id);
    assert.equal(getLatestAutonomousInboundMessageId([row]), row.id);
  }
});

test('Edna regression: ignore action and honor arrival time over second-resolution provider time', () => {
  const opening = message({ id: 'opening', direction: 'outbound', text_content: 'Você busca um plano só para você ou para a família?',
    message_at: '2026-11-17T16:19:19.966Z', created_at: '2026-11-17T16:19:19.976Z' });
  const action = message({ id: 'action', message_type: 'action', text_content: '[Ação]',
    message_at: '2026-11-17T16:40:33Z', created_at: '2026-11-17T16:40:35.119Z' });
  const outgoing = message({ id: 'ai', direction: 'outbound', text_content: 'Me conta, quantas pessoas seriam e qual a idade de cada uma?',
    message_at: '2026-11-17T16:41:04.079Z', created_at: '2026-11-17T16:41:04.154Z' });
  const customer = message({ id: 'real', text_content: 'Boa tarde gostaria de saber como funciona, só pra mim',
    message_at: '2026-11-17T16:41:04.000Z', created_at: '2026-11-17T16:41:06.600Z' });
  const chronology = orderAutonomousConversationalMessages([outgoing, action, customer, opening]);
  assert.deepEqual(chronology.map(item => item.id), ['opening', 'ai', 'real']);
  assert.equal(chronology.at(-1)?.direction, 'inbound');
  assert.equal(getLatestAutonomousInboundMessageId([action, outgoing, customer, opening]), 'real');
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
