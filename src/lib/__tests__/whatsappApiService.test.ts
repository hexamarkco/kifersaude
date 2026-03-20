import { test } from 'vitest';
import assert from 'node:assert/strict';

import { mergeWhapiMessageHistoryResponses, type WhapiMessageListResponse } from '../whatsappApiService';

const buildResponse = (messages: Array<{ id: string; timestamp: number; fromMe: boolean }>, total = messages.length): WhapiMessageListResponse => ({
  messages: messages.map((message) => ({
    id: message.id,
    type: 'text',
    chat_id: '5511999999999@s.whatsapp.net',
    from_me: message.fromMe,
    timestamp: message.timestamp,
  })),
  count: messages.length,
  total,
  offset: 0,
  first: messages[0]?.timestamp ?? 0,
  last: messages[messages.length - 1]?.timestamp ?? 0,
});

test('merges history batches with dedupe and reapplies global pagination', () => {
  const received = buildResponse([
    { id: 'in-4', timestamp: 400, fromMe: false },
    { id: 'shared-3', timestamp: 300, fromMe: false },
    { id: 'in-2', timestamp: 200, fromMe: false },
  ], 3);
  const sent = buildResponse([
    { id: 'shared-3', timestamp: 300, fromMe: true },
    { id: 'out-1', timestamp: 100, fromMe: true },
  ], 2);

  const merged = mergeWhapiMessageHistoryResponses({ count: 2, offset: 1, sort: 'desc' }, received, sent);

  assert.deepEqual(merged.messages.map((message) => message.id), ['shared-3', 'in-2']);
  assert.equal(merged.count, 2);
  assert.equal(merged.offset, 1);
  assert.equal(merged.total, 5);
  assert.equal(merged.first, 300);
  assert.equal(merged.last, 200);
});

test('keeps ascending order when merging message history batches', () => {
  const received = buildResponse([
    { id: 'in-2', timestamp: 200, fromMe: false },
    { id: 'in-4', timestamp: 400, fromMe: false },
  ], 2);
  const sent = buildResponse([
    { id: 'out-1', timestamp: 100, fromMe: true },
    { id: 'out-3', timestamp: 300, fromMe: true },
  ], 2);

  const merged = mergeWhapiMessageHistoryResponses({ count: 3, offset: 0, sort: 'asc' }, received, sent);

  assert.deepEqual(merged.messages.map((message) => message.id), ['out-1', 'in-2', 'out-3']);
  assert.equal(merged.first, 100);
  assert.equal(merged.last, 300);
});
