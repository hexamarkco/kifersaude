import { describe, expect, it } from 'vitest';

import {
  buildWhapiPresenceEventKey,
  extractWhapiPresenceItems,
  normalizeWhapiPresenceItem,
  normalizeWhapiPresenceStatus,
} from '../whapi-presence-parser';

describe('whapi presence parser', () => {
  it('normalizes the official webhook fields and Unix timestamps', () => {
    const item = normalizeWhapiPresenceItem({
      contact_id: '5511999999999',
      status: 'recording',
      last_seen: 1712995377,
    });

    expect(item).toEqual({
      entryId: '5511999999999',
      status: 'recording',
      lastSeenAt: '2024-04-13T16:02:57.000Z',
      raw: {
        contact_id: '5511999999999',
        status: 'recording',
        last_seen: 1712995377,
      },
    });
  });

  it('accepts a single presence response and preserves group ids', () => {
    const items = extractWhapiPresenceItems({
      presence: {
        contact_id: '120363012345678901@g.us',
        status: 'online',
      },
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.entryId).toBe('120363012345678901@g.us');
    expect(items[0]?.lastSeenAt).toBeNull();
  });

  it('maps provider extensions to unknown and builds deterministic receipts', () => {
    expect(normalizeWhapiPresenceStatus('away')).toBe('unknown');
    const item = normalizeWhapiPresenceItem({ contact_id: '5511999999999', status: 'typing' });
    expect(item).not.toBeNull();
    expect(buildWhapiPresenceEventKey('post', item!)).toBe(
      'presence:post:5511999999999:typing:no-last-seen',
    );
  });
});
