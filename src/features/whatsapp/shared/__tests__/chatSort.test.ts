import { test } from 'vitest';
import assert from 'node:assert/strict';

import { getPinnedSortValue, sortChatsByLatest } from '../chatSort';

test('prefers pinned chats over recency', () => {
  const pinned = {
    pinned: 2,
    last_message_at: '2026-03-10T12:00:00.000Z',
    created_at: '2026-03-01T12:00:00.000Z',
  };
  const recent = {
    pinned: 0,
    last_message_at: '2026-03-12T12:00:00.000Z',
    created_at: '2026-03-01T12:00:00.000Z',
  };

  assert.ok(sortChatsByLatest(pinned, recent) < 0);
});

test('falls back to timestamps when chats are not pinned', () => {
  const older = {
    pinned: 0,
    last_message_at: '2026-03-10T12:00:00.000Z',
    created_at: '2026-03-01T12:00:00.000Z',
  };
  const newer = {
    pinned: 0,
    last_message_at: '2026-03-12T12:00:00.000Z',
    created_at: '2026-03-01T12:00:00.000Z',
  };

  assert.ok(sortChatsByLatest(older, newer) > 0);
  assert.equal(getPinnedSortValue({ pinned: null }), 0);
});
