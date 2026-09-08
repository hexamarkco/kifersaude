import assert from 'node:assert/strict';
import { test } from 'vitest';

import {
  DEFAULT_SCHEDULING,
  buildTimeZoneDayWindow,
  getNextAllowedSendAt,
} from './scheduling';

test('keeps an eligible lead at its current instant inside the send window', () => {
  const reference = new Date('2026-09-08T14:00:00Z');
  assert.equal(getNextAllowedSendAt(reference, DEFAULT_SCHEDULING).toISOString(), reference.toISOString());
});

test('moves an after-hours lead to the next allowed weekday opening', () => {
  const fridayAfterHours = new Date('2026-09-12T01:00:00Z');
  assert.equal(
    getNextAllowedSendAt(fridayAfterHours, DEFAULT_SCHEDULING).toISOString(),
    '2026-09-14T11:00:00.000Z',
  );
});

test('builds calendar-day boundaries in the configured timezone', () => {
  const window = buildTimeZoneDayWindow(new Date('2026-09-08T14:00:00Z'), 'America/Sao_Paulo');
  assert.equal(window.dayKey, '2026-09-08');
  assert.equal(window.start.toISOString(), '2026-09-08T03:00:00.000Z');
  assert.equal(window.end.toISOString(), '2026-09-09T03:00:00.000Z');
});
