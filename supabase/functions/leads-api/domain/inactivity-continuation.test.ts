import assert from 'node:assert/strict';
import { test } from 'vitest';

import { resolveContinuationTriggerMessageAt } from './inactivity-continuation';

test('anchors the next inactivity step after its automatic outbound', () => {
  const completedAt = new Date('2026-09-12T12:00:02.000Z');

  assert.equal(
    resolveContinuationTriggerMessageAt({
      triggerType: 'inactivity_duration',
      actionType: 'send_message',
      completedAt,
      inheritedTriggerMessageAt: '2026-09-10T12:00:00.000Z',
    }),
    completedAt.toISOString(),
  );
});

test('keeps the inherited anchor for non-message and non-inactivity steps', () => {
  const inheritedTriggerMessageAt = '2026-09-10T12:00:00.000Z';
  const completedAt = new Date('2026-09-12T12:00:02.000Z');

  assert.equal(
    resolveContinuationTriggerMessageAt({
      triggerType: 'inactivity_duration',
      actionType: 'update_status',
      completedAt,
      inheritedTriggerMessageAt,
    }),
    inheritedTriggerMessageAt,
  );
  assert.equal(
    resolveContinuationTriggerMessageAt({
      triggerType: 'status_duration',
      actionType: 'send_message',
      completedAt,
      inheritedTriggerMessageAt,
    }),
    inheritedTriggerMessageAt,
  );
});
