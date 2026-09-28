import assert from 'node:assert/strict';
import { test } from 'vitest';

import type { CommWhatsAppMessage } from '../types';
import {
  buildComposerQueueSnapshotKey,
  buildMediaSummaryText,
  createPendingAttachmentFromFile,
  formatConnectionStatusLabel,
  getMessageBubbleClasses,
  getMessageRowClasses,
  isBubblelessMediaMessage,
  isMediaSendingMessage,
} from '../inboxPresentation';

const createMessage = (overrides: Partial<CommWhatsAppMessage> = {}): CommWhatsAppMessage => ({
  id: 'message-1',
  chat_id: 'chat-1',
  channel_id: 'channel-1',
  external_message_id: 'external-1',
  direction: 'outbound',
  message_type: 'image',
  delivery_status: 'sending',
  text_content: null,
  message_at: '2026-09-08T12:00:00.000Z',
  metadata: {},
  created_at: '2026-09-08T12:00:00.000Z',
  ...overrides,
});

test('keeps inbox presentation labels and bubble alignment stable', () => {
  assert.equal(buildMediaSummaryText('image'), '[Imagem]');
  assert.equal(buildMediaSummaryText('voice'), '[Audio]');
  assert.equal(buildMediaSummaryText('document'), '[Documento]');
  assert.equal(formatConnectionStatusLabel('AUTH'), 'Conectado');
  assert.equal(formatConnectionStatusLabel(''), 'Indisponível');
  assert.equal(getMessageBubbleClasses('outbound'), 'message-bubble message-bubble-outbound ml-auto');
  assert.equal(getMessageRowClasses('inbound'), 'message-bubble-row-inbound justify-start');
});

test('classifies media sending messages without exposing transport details to UI', () => {
  const message = createMessage();
  assert.equal(isBubblelessMediaMessage(message), true);
  assert.equal(isMediaSendingMessage(message, null), true);
  assert.equal(isMediaSendingMessage({ ...message, delivery_status: 'delivered' }, null), false);
  assert.equal(isMediaSendingMessage({ ...message, delivery_status: 'delivered' }, null, true), true);
});

test('builds stable composer queue keys and document attachments', () => {
  const file = new File(['conteúdo'], 'contrato.pdf', { type: 'application/pdf' });
  const attachment = createPendingAttachmentFromFile(file);

  assert.equal(attachment.kind, 'document');
  assert.equal(attachment.previewUrl, null);
  assert.equal(buildComposerQueueSnapshotKey('chat-1', 'Oi', [attachment]), `chat-1:Oi:${attachment.id}:contrato.pdf:${file.size}:document`);
});
