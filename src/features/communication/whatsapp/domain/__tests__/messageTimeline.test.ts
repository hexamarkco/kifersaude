import assert from 'node:assert/strict';
import { test } from 'vitest';

import type { MessageDeliveryStatusEvent } from '../messageMetadata';
import type { CommWhatsAppMessage } from '../types';
import {
  compareMessageDeliveryStatusEvents,
  compareMessageChronology,
  dedupeObviousDuplicateMessages,
  findMessageByIdOrExternalId,
  formatMessageDaySeparatorLabel,
  getMessageDeliveryTimeline,
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

test('orders delivery progression when status events share a timestamp', () => {
  const at = '2026-09-21T22:06:00.000Z';
  const events: MessageDeliveryStatusEvent[] = [
    { status: 'delivered', at, error: null },
    { status: 'sent', at, error: null },
    { status: 'pending', at, error: null },
  ];

  assert.deepEqual(events.sort(compareMessageDeliveryStatusEvents).map((event) => event.status), [
    'pending',
    'sent',
    'delivered',
  ]);
});

test('keeps actual delivery timestamps ahead of status tie-break order', () => {
  const events: MessageDeliveryStatusEvent[] = [
    { status: 'delivered', at: '2026-09-21T22:06:02.000Z', error: null },
    { status: 'pending', at: '2026-09-21T22:06:00.000Z', error: null },
  ];

  assert.deepEqual(events.sort(compareMessageDeliveryStatusEvents).map((event) => event.status), [
    'pending',
    'delivered',
  ]);
});

test('keeps provider-confirmed status chronology even with mixed second and millisecond precision', () => {
  // Real regression: delivered webhook has second precision, pending has milliseconds.
  const message = createMessage({
    delivery_status: 'read',
    message_at: '2026-11-19T20:51:51.370Z',
    status_updated_at: '2026-11-19T22:47:29.000Z',
    metadata: {
      delivery_status_history: [
        { status: 'pending', at: '2026-11-19T20:51:51.370Z' },
        { status: 'delivered', at: '2026-11-19T20:51:51.000Z' },
        { status: 'read', at: '2026-11-19T22:47:29.000Z' },
      ],
    },
  });

  const timeline = getMessageDeliveryTimeline(message);
  assert.deepEqual(timeline.map((event) => event.status), ['pending', 'delivered', 'read']);
  assert.equal(timeline[1]?.at, '2026-11-19T20:51:51.000Z');
  assert.equal(timeline.some((event) => event.status === 'sent'), false);
});

test('follows confirmed delivery progression when provider timestamps arrive out of order', () => {
  const events: MessageDeliveryStatusEvent[] = [
    { status: 'read', at: '2026-11-19T22:47:27.000Z', error: null },
    { status: 'delivered', at: '2026-11-19T22:47:29.000Z', error: null },
    { status: 'pending', at: '2026-11-19T20:51:51.370Z', error: null },
  ];

  assert.deepEqual(events.sort(compareMessageDeliveryStatusEvents).map((event) => event.status), [
    'pending', 'delivered', 'read',
  ]);
});

test('uses the persisted sent status when confirmed, but does not invent missing milestones', () => {
  const sent = createMessage({
    delivery_status: 'sent',
    status_updated_at: '2026-11-19T20:51:52.000Z',
    metadata: {},
  });
  assert.deepEqual(getMessageDeliveryTimeline(sent).map((event) => event.status), ['sent']);

  const delivered = createMessage({
    delivery_status: 'delivered',
    status_updated_at: '2026-11-19T20:51:53.000Z',
    metadata: { delivery_status_history: [{ status: 'pending', at: '2026-11-19T20:51:51.000Z' }] },
  });
  assert.deepEqual(getMessageDeliveryTimeline(delivered).map((event) => event.status), ['pending', 'delivered']);
});

test('preserves error chronology when a later delivered event supersedes a failure', () => {
  const events: MessageDeliveryStatusEvent[] = [
    { status: 'delivered', at: '2026-11-19T20:52:20.000Z', error: null },
    { status: 'failed', at: '2026-11-19T20:52:15.000Z', error: 'Falha temporária' },
    { status: 'pending', at: '2026-11-19T20:51:51.000Z', error: null },
  ];
  assert.deepEqual(events.sort(compareMessageDeliveryStatusEvents).map((event) => event.status), [
    'pending', 'failed', 'delivered',
  ]);
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

test('does not find a message from another chat when the chat scope is provided', () => {
  const otherChatMessage = createMessage({
    id: 'target-message',
    chat_id: 'chat-2',
    external_message_id: 'target-external',
  });

  assert.equal(
    findMessageByIdOrExternalId([otherChatMessage], 'target-message', 'chat-1'),
    null,
  );
  assert.equal(
    findMessageByIdOrExternalId([otherChatMessage], 'target-external', 'chat-2')?.id,
    'target-message',
  );
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
