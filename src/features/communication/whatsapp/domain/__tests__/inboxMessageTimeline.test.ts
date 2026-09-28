import assert from 'node:assert/strict';
import { test } from 'vitest';

import type { CommWhatsAppMessage } from '../types';
import { buildInboxMessageTimeline } from '../inboxMessageTimeline';

const createMessage = (id: string, messageAt: string, overrides: Partial<CommWhatsAppMessage> = {}): CommWhatsAppMessage => ({
  id,
  chat_id: 'chat-1',
  channel_id: 'channel-1',
  external_message_id: id,
  direction: 'inbound',
  message_type: 'image',
  delivery_status: 'delivered',
  text_content: '[Imagem]',
  message_at: messageAt,
  metadata: {},
  created_at: messageAt,
  ...overrides,
});

test('groups consecutive uncaptained media and preserves day separators', () => {
  const timeline = buildInboxMessageTimeline([
    createMessage('first', '2026-09-08T12:00:00.000Z'),
    createMessage('second', '2026-09-08T12:00:30.000Z'),
    createMessage('third', '2026-09-09T12:00:00.000Z'),
  ]);

  assert.deepEqual(timeline.map((item) => item.type), ['day', 'media-group', 'day', 'message']);
  assert.equal(timeline[1]?.type === 'media-group' ? timeline[1].messages.length : 0, 2);
});

test('does not group media with captions', () => {
  const timeline = buildInboxMessageTimeline([
    createMessage('first', '2026-09-08T12:00:00.000Z'),
    createMessage('second', '2026-09-08T12:00:30.000Z', { text_content: '[Imagem] legenda' }),
  ]);

  assert.deepEqual(timeline.map((item) => item.type), ['day', 'message', 'message']);
});
