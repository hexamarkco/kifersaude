import assert from 'node:assert/strict';
import { test } from 'vitest';

import type { CommWhatsAppMessage } from '../types';
import {
  canDeleteOutboundMessage,
  canEditOutboundMessage,
  canReplyOrForwardMessage,
  getChatPreviewIconType,
  getMessageSearchPreviewText,
  getMessageVisibleCaption,
  getQuotePayloadFromMessage,
  getVisiblePreviewText,
  isGalleryMediaMessage,
  isHiddenTechnicalMessageMarker,
  isMessageStarred,
  normalizeChatDraftPreview,
} from '../messagePresentation';

const createMessage = (overrides: Partial<CommWhatsAppMessage> = {}): CommWhatsAppMessage => ({
  id: 'message-1',
  chat_id: 'chat-1',
  channel_id: 'channel-1',
  external_message_id: 'external-1',
  direction: 'outbound',
  message_type: 'text',
  delivery_status: 'sent',
  text_content: 'Mensagem de teste',
  message_at: '2026-09-08T12:00:00.000Z',
  metadata: {},
  created_at: '2026-09-08T12:00:00.000Z',
  ...overrides,
});

test('keeps visible media markers while hiding technical placeholders', () => {
  assert.equal(getVisiblePreviewText('[Imagem]', 'image'), '[Imagem]');
  assert.equal(getVisiblePreviewText('[Mensagem]', 'text'), '');
  assert.equal(isHiddenTechnicalMessageMarker('[Ação]', 'action'), true);
  assert.equal(getChatPreviewIconType('[Vídeo] demonstração'), 'video');
});

test('uses a real media caption instead of its storage marker', () => {
  const captionedImage = createMessage({
    message_type: 'image',
    text_content: '[Imagem] Foto da carteirinha',
    media_caption: '[Imagem]',
  });

  assert.equal(getMessageVisibleCaption(captionedImage), 'Foto da carteirinha');
  assert.equal(getMessageSearchPreviewText(captionedImage), 'Foto da carteirinha');
  assert.equal(isGalleryMediaMessage(captionedImage), true);
});

test('preserves the existing permissions for message actions', () => {
  const outbound = createMessage();
  const inbound = createMessage({ direction: 'inbound' });
  const deleted = createMessage({ delivery_status: 'deleted' });
  const system = createMessage({ direction: 'system' });

  assert.equal(canEditOutboundMessage(outbound), true);
  assert.equal(canEditOutboundMessage(inbound), false);
  assert.equal(canDeleteOutboundMessage(outbound), true);
  assert.equal(canDeleteOutboundMessage(deleted), false);
  assert.equal(canReplyOrForwardMessage(inbound), true);
  assert.equal(canReplyOrForwardMessage(system), false);
});

test('builds quote and star presentation from persisted metadata', () => {
  const message = createMessage({
    sender_phone: '5511999999999',
    metadata: { starred: true },
  });

  assert.equal(isMessageStarred(message), true);
  assert.deepEqual(getQuotePayloadFromMessage(message), {
    quotedMessageId: 'external-1',
    quotedPreviewText: 'Mensagem de teste',
    quotedType: 'text',
    quotedAuthorPhone: '5511999999999',
  });
});

test('normalizes a long composer draft without changing the 100 character limit', () => {
  const draft = `  ${'a'.repeat(105)}  `;
  const preview = normalizeChatDraftPreview(draft);

  assert.equal(preview.length, 100);
  assert.equal(preview.endsWith('...'), true);
});
