import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  buildWhapiWebhookMessageReceiptKey,
  extractWhapiWebhookMessageItems,
  hasWhapiPatchTextChange,
} from '../whapi-webhook-parser';

const pollPatchPayload = (triggerId: string) => ({
  messages_updates: [
    {
      id: 'poll-message-id',
      trigger: {
        id: triggerId,
        from_me: false,
        type: 'action',
        chat_id: '5511999999999@s.whatsapp.net',
        timestamp: 1747730574,
        action: {
          target: 'poll-message-id',
          type: 'vote',
          votes: ['option-1'],
        },
      },
      before_update: {
        id: 'poll-message-id',
        from_me: true,
        type: 'poll',
        chat_id: '5511999999999@s.whatsapp.net',
        timestamp: 1747730565,
        poll: { total: 0 },
      },
      after_update: {
        id: 'poll-message-id',
        from_me: true,
        type: 'poll',
        chat_id: '5511999999999@s.whatsapp.net',
        timestamp: 1747730565,
        poll: { total: 1, results: [{ id: 'option-1', count: 1 }] },
      },
      changes: ['poll'],
    },
  ],
  event: {
    type: 'messages',
    event: 'patch',
  },
  channel_id: 'MANTIS-TEST',
});

test('keeps regular Whapi message payloads unchanged', () => {
  const [item] = extractWhapiWebhookMessageItems({
    messages: [{ id: 'message-1', timestamp: 1712995245, type: 'text' }],
  });

  assert.ok(item);
  assert.equal(item.message.id, 'message-1');
  assert.equal(item.receipt.id, 'message-1');
  assert.equal(item.patch, null);
});

test('accepts a message sent directly inside data by a custom webhook body', () => {
  const [item] = extractWhapiWebhookMessageItems({
    data: {
      id: 'message-in-data',
      chat_id: '5511999999999@s.whatsapp.net',
      from_me: false,
      timestamp: 1712995245,
      type: 'text',
    },
  });

  assert.ok(item);
  assert.equal(item.message.id, 'message-in-data');
  assert.equal(item.patch, null);
});

test('accepts a custom webhook body containing the message itself', () => {
  const [item] = extractWhapiWebhookMessageItems({
    id: 'direct-message',
    from: '5511999999999@s.whatsapp.net',
    from_me: false,
    timestamp: 1712995245,
    type: 'text',
  });

  assert.ok(item);
  assert.equal(item.message.id, 'direct-message');
});

test('does not mistake a status object for a direct message', () => {
  const items = extractWhapiWebhookMessageItems({
    id: 'message-status',
    status: 'delivered',
    timestamp: '1712995245',
  });

  assert.deepEqual(items, []);
});

test('unwraps documented messages.patch payloads from after_update', () => {
  const [item] = extractWhapiWebhookMessageItems(pollPatchPayload('vote-event-1'));

  assert.ok(item);
  assert.equal(item.message.id, 'poll-message-id');
  assert.deepEqual(item.message.poll, {
    total: 1,
    results: [{ id: 'option-1', count: 1 }],
  });
  assert.equal(item.receipt.id, 'vote-event-1');
  assert.deepEqual(item.patch?.changes, ['poll']);
});

test('ignores malformed messages.patch entries without after_update', () => {
  const items = extractWhapiWebhookMessageItems({
    messages_updates: [{ trigger: { id: 'event-1' } }, null, 'invalid'],
  });

  assert.deepEqual(items, []);
});

test('uses the patch trigger identifier to deduplicate repeated target updates', () => {
  const [first] = extractWhapiWebhookMessageItems(pollPatchPayload('vote-event-1'));
  const [second] = extractWhapiWebhookMessageItems(pollPatchPayload('vote-event-2'));

  assert.ok(first);
  assert.ok(second);
  assert.notEqual(
    buildWhapiWebhookMessageReceiptKey('patch', first),
    buildWhapiWebhookMessageReceiptKey('patch', second),
  );
});

test('recognizes text-oriented patch changes', () => {
  const [item] = extractWhapiWebhookMessageItems({
    messages_updates: [{
      trigger: { id: 'edit-event-1', timestamp: 1712995300 },
      after_update: {
        id: 'message-1',
        type: 'text',
        text: { body: 'Texto editado' },
      },
      changes: ['text.body'],
    }],
  });

  assert.ok(item);
  assert.equal(hasWhapiPatchTextChange(item.patch), true);
});
