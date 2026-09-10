import assert from 'node:assert/strict';
import { test } from 'vitest';

import { resolveBatchFollowUpFinalStatus } from '../batchFollowUpOutcome';

const baseInput = {
  approvedScheduleAction: 'no_schedule' as const,
  approvedScheduleDate: null,
  opportunityRecommendation: 'continue' as const,
};

test('moves an item without a next reminder to Reativação by default', () => {
  assert.equal(resolveBatchFollowUpFinalStatus(baseInput), 'Reativação');
});

test('moves an item without a next reminder to Perdido when loss is recommended', () => {
  assert.equal(resolveBatchFollowUpFinalStatus({
    ...baseInput,
    opportunityRecommendation: 'mark_lost_recommended',
  }), 'Perdido');
});

test('does not change the lead status when a next reminder is scheduled', () => {
  assert.equal(resolveBatchFollowUpFinalStatus({
    ...baseInput,
    approvedScheduleAction: 'schedule',
    approvedScheduleDate: '2026-09-15T13:00:00.000Z',
  }), null);
});

test('does not move finalized leads back to Reativação', () => {
  assert.equal(resolveBatchFollowUpFinalStatus({
    ...baseInput,
    currentLeadStatus: 'Perdido',
  }), null);
  assert.equal(resolveBatchFollowUpFinalStatus({
    ...baseInput,
    currentLeadStatus: 'Convertido',
  }), null);
});
