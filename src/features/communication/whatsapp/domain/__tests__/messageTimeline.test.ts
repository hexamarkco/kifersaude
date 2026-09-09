import assert from 'node:assert/strict';
import { test } from 'vitest';

import type { CommWhatsAppMessage } from '../types';
import {
  compareMessageChronology,
  dedupeObviousDuplicateMessages,
  formatMessageDaySeparatorLabel,
  getMessageDayKey,
  getMessageTimestampMs,
  mergeMessages,
  parseCommMessageDate,
} from '../messageTimeline';

const createMessage = (overrides: Partial<CommWhatsAppMessage> = {}): CommWhatsAppMessage => ({
  id: 'message-1',
  chat_id: 'chat-1',
  channel_id: 'channel-1',
  external_message_id: 'external-1',
  direction: 'outbound',
  message_type: 'text',
  delivery_status: 'sent',
  text_content: 'Mensagem suficientemente longa',
  message_at: '2026-09-08T12:00:00.000Z',
  sender_phone: '5511999999999',
  metadata: {},
  created_at: '2026-09-08T12:00:00.000Z',
  ...overrides,
});

test('parses timestamps with and without an explicit timezone', () => {
  assert.equal(
    parseCommMessageDate('2026-09-08 12:00:00').toISOString(),
    new Date('2026-09-08 12:00:00').toISOString(),
  );
  assert.equal(getMessageTimestampMs('invalid'), null);
  assert.equal(getMessageDayKey('invalid'), '');
});

test('uses optimistic client order before persisted message time', () => {
  const first = createMessage({
    id: 'first',
    message_at: '2026-09-08T12:01:00.000Z',
    metadata: { client_order_at: '2026-09-08T12:00:00.000Z' },
  });
  const second = createMessage({ id: 'second', message_at: '2026-09-08T12:00:30.000Z' });

  assert.equal(compareMessageChronology(first, second) < 0, true);
});

test('merges an optimistic message with its persisted delivery', () => {
  const optimistic = createMessage({
    id: 'local-1',
    external_message_id: null,
    delivery_status: 'pending',
    metadata: { client_request_id: 'request-1' },
  });
  const persisted = createMessage({
    id: 'server-1',
    external_message_id: 'external-1',
    delivery_status: 'delivered',
    metadata: { client_request_id: 'request-1' },
  });

  const merged = mergeMessages([optimistic], [persisted]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'server-1');
  assert.equal(merged[0].delivery_status, 'delivered');
});

test('deduplicates only sufficiently descriptive messages from the same second', () => {
  const incomplete = createMessage({ id: 'local-1', external_message_id: null, media_id: null });
  const complete = createMessage({ id: 'server-1', external_message_id: 'external-1', media_id: 'media-1' });
  const shortA = createMessage({ id: 'short-1', text_content: 'Oi' });
  const shortB = createMessage({ id: 'short-2', text_content: 'Oi' });

  const result = dedupeObviousDuplicateMessages([incomplete, complete, shortA, shortB]);
  assert.deepEqual(result.map((message) => message.id), ['server-1', 'short-1', 'short-2']);
});

test('formats relative day labels against an explicit clock', () => {
  const now = new Date('2026-09-09T15:00:00.000Z');
  assert.equal(formatMessageDaySeparatorLabel('2026-09-09T12:00:00.000Z', now), 'Hoje');
  assert.equal(formatMessageDaySeparatorLabel('2026-09-08T12:00:00.000Z', now), 'Ontem');
});
