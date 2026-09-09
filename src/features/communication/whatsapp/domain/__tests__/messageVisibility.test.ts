import assert from 'node:assert/strict';
import { test } from 'vitest';

import type { CommWhatsAppMessage } from '../types';
import { shouldHideTechnicalMessage } from '../messageVisibility';

const createMessage = (overrides: Partial<CommWhatsAppMessage> = {}): CommWhatsAppMessage => ({
  id: 'message-1',
  chat_id: 'chat-1',
  channel_id: 'channel-1',
  direction: 'inbound',
  message_type: 'text',
  delivery_status: 'received',
  text_content: 'Olá',
  message_at: '2026-09-08T12:00:00.000Z',
  metadata: {},
  created_at: '2026-09-08T12:00:00.000Z',
  ...overrides,
});

test('hides redundant action events and empty technical messages', () => {
  assert.equal(shouldHideTechnicalMessage(createMessage({ message_type: 'action', text_content: '[Ação]' })), true);
  assert.equal(shouldHideTechnicalMessage(createMessage({ text_content: '[Mensagem]' })), true);
});

test('keeps technical markers when the message still has renderable content', () => {
  assert.equal(shouldHideTechnicalMessage(createMessage({
    message_type: 'image',
    text_content: '[Mensagem]',
    media_url: 'https://example.com/image.jpg',
  })), false);
  assert.equal(shouldHideTechnicalMessage(createMessage({
    text_content: '[Mensagem]',
    metadata: { quote: { external_message_id: 'quoted-1', preview_text: 'Mensagem anterior' } },
  })), false);
});
