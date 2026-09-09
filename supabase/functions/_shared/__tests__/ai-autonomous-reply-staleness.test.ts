import assert from 'node:assert/strict';
import { test } from 'vitest';
import { isAutonomousReplyStale } from '../ai-autonomous-reply-staleness.ts';

test('keeps a generated reply when the prompt inbound is still the latest one', () => {
  assert.equal(isAutonomousReplyStale('inbound-1', 'inbound-1'), false);
});

test('discards a generated reply when the customer wrote again during generation', () => {
  assert.equal(isAutonomousReplyStale('inbound-1', 'inbound-2'), true);
});

test('fails closed when the prompt inbound is no longer available', () => {
  assert.equal(isAutonomousReplyStale('inbound-1', null), true);
});
