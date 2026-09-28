import assert from 'node:assert/strict';
import { test } from 'vitest';

import type { CommWhatsAppMessage } from '../types';
import {
  formatDurationLabel,
  formatFileSize,
  getVisualMediaBubbleWidth,
  isPdfDocumentMessage,
} from '../messageMediaPresentation';
import { isChatMediaViewerMessage } from '../mediaViewerPresentation';

const createMessage = (overrides: Partial<CommWhatsAppMessage> = {}): CommWhatsAppMessage => ({
  id: 'message-1',
  chat_id: 'chat-1',
  channel_id: 'channel-1',
  external_message_id: 'external-1',
  direction: 'inbound',
  message_type: 'document',
  delivery_status: 'delivered',
  text_content: null,
  message_at: '2026-09-08T12:00:00.000Z',
  metadata: {},
  created_at: '2026-09-08T12:00:00.000Z',
  ...overrides,
});

test('recognizes PDF documents from MIME type or filename', () => {
  assert.equal(isPdfDocumentMessage(createMessage({ media_mime_type: 'application/pdf; charset=binary' })), true);
  assert.equal(isPdfDocumentMessage(createMessage({ media_mime_type: 'application/octet-stream', media_file_name: 'Contrato.PDF' })), true);
  assert.equal(isPdfDocumentMessage(createMessage({ media_mime_type: 'image/png', media_file_name: 'foto.png' })), false);
});

test('uses a wider bubble for PDF previews', () => {
  assert.equal(getVisualMediaBubbleWidth(createMessage({ media_file_name: 'contrato.pdf' })), 'w-[18rem]');
  assert.equal(getVisualMediaBubbleWidth(createMessage({ media_file_name: 'foto.png' })), 'w-[13.75rem]');
});

test('formats media sizes and durations for compact labels', () => {
  assert.equal(formatFileSize(512), '512 B');
  assert.equal(formatFileSize(2048), '2 KB');
  assert.equal(formatFileSize(2.5 * 1024 * 1024), '2.5 MB');
  assert.equal(formatFileSize(0), '');
  assert.equal(formatDurationLabel(0), '00:00');
  assert.equal(formatDurationLabel(65), '01:05');
});

test('only exposes live images and videos to the media viewer', () => {
  assert.equal(isChatMediaViewerMessage(createMessage({ message_type: 'image' })), true);
  assert.equal(isChatMediaViewerMessage(createMessage({ message_type: 'video' })), true);
  assert.equal(isChatMediaViewerMessage(createMessage({ message_type: 'image', delivery_status: 'deleted' })), false);
  assert.equal(isChatMediaViewerMessage(createMessage({ message_type: 'document' })), false);
});
