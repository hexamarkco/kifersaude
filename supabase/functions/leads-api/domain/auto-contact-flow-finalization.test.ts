import assert from 'node:assert/strict';
import { test } from 'vitest';

import { resolveAutoContactFlowFinalStatus } from './auto-contact-flow-finalization';

test('applies the configured final status only after the last step', () => {
  const flow = { steps: [{}, {}, {}], finalStatus: 'Reativação' };

  assert.equal(resolveAutoContactFlowFinalStatus(flow, 1), null);
  assert.equal(resolveAutoContactFlowFinalStatus(flow, 2), 'Reativação');
});

test('does not apply an empty final status', () => {
  assert.equal(resolveAutoContactFlowFinalStatus({ steps: [{}], finalStatus: '  ' }, 0), null);
});
