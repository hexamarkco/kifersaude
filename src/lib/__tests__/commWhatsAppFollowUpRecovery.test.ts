import assert from 'node:assert/strict';
import { test } from 'vitest';

import { pollForCompletedFollowUp } from '../commWhatsAppFollowUpRecovery';

test('recovers an audit result that appears after the invoke response is lost', async () => {
  const completed = { generationId: 'generation-1', text: 'Follow-up recuperado' };
  let lookupCount = 0;
  const delays: number[] = [];
  const lookup = async () => {
    lookupCount += 1;
    return lookupCount === 3 ? completed : null;
  };
  const waitForDelay = async (delayMs: number) => {
    delays.push(delayMs);
  };

  const result = await pollForCompletedFollowUp(lookup, [0, 750, 1500], waitForDelay);

  assert.deepEqual(result, completed);
  assert.equal(lookupCount, 3);
  assert.deepEqual(delays, [0, 750, 1500]);
});

test('returns null when no completed audit result exists', async () => {
  let lookupCount = 0;
  const lookup = async () => {
    lookupCount += 1;
    return null;
  };
  const waitForDelay = async () => undefined;

  assert.equal(await pollForCompletedFollowUp(lookup, [0, 1], waitForDelay), null);
  assert.equal(lookupCount, 2);
});
