import assert from 'node:assert/strict';
import { test } from 'vitest';

import { isAutoContactFlowOutputMessage } from './inactivity-flow-enrollment';

const messageAt = '2026-09-15T12:00:00.000Z';

test('the same flow output cannot start a new inactivity enrollment', () => {
  assert.equal(isAutoContactFlowOutputMessage({
    source: 'auto_contact',
    metadata: { automation_flow_id: 'contact-followup-1' },
    messageAt,
  }, 'contact-followup-1'), true);
});

test('an automated message from another flow may start this flow', () => {
  assert.equal(isAutoContactFlowOutputMessage({
    source: 'auto_contact',
    metadata: { automation_flow_id: 'contact-initial' },
    messageAt,
  }, 'contact-followup-1'), false);
});

test('legacy automated messages are attributed through a nearby completed send job', () => {
  assert.equal(isAutoContactFlowOutputMessage({
    source: 'auto_contact',
    metadata: { automation: 'auto_contact' },
    messageAt,
    completedSendJobAt: '2026-09-15T12:04:59.000Z',
  }, 'contact-followup-1'), true);
  assert.equal(isAutoContactFlowOutputMessage({
    source: 'auto_contact',
    metadata: { automation: 'auto_contact' },
    messageAt,
    completedSendJobAt: '2026-09-15T12:05:01.000Z',
  }, 'contact-followup-1'), false);
});

test('a manual outbound does not get attributed to the flow', () => {
  assert.equal(isAutoContactFlowOutputMessage({
    source: 'whatsapp_inbox',
    metadata: { automation_flow_id: 'contact-followup-1' },
    messageAt,
    completedSendJobAt: '2026-09-15T12:00:01.000Z',
  }, 'contact-followup-1'), false);
});
