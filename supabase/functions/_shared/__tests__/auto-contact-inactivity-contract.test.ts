import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'vitest';

const migrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260915151927_prevent_auto_contact_flow_self_reentry.sql'),
  'utf8',
);
const leadsApiSource = readFileSync(
  resolve(process.cwd(), 'supabase/functions/leads-api/index.ts'),
  'utf8',
);

test('the inactivity scanner ignores the same flow own outbound and still honors active enrollments', () => {
  assert.match(migrationSource, /auto_contact_message_is_same_flow_output/);
  assert.equal(
    migrationSource.match(/AND NOT public\.auto_contact_message_is_same_flow_output\(/g)?.length,
    2,
  );
  assert.match(migrationSource, /job\.status IN \('pending', 'processing'\)/);
  assert.match(migrationSource, /trigger_message_id', v_lead\.outbound_msg_id/);
  assert.doesNotMatch(migrationSource, /j3\.status = 'completed'/);
  assert.match(migrationSource, /eligibleLeads', v_elegible/);
});

test('flow messages carry their origin and the edge entry point blocks self-reenrollment', () => {
  assert.match(leadsApiSource, /automation_flow_id: automationFlowId/);
  assert.match(leadsApiSource, /reason: 'flow_output_cannot_restart_same_flow'/);
  assert.match(leadsApiSource, /reason: 'active_enrollment_exists'/);
});

test('a completed step schedules the next step within the same enrollment', () => {
  assert.match(leadsApiSource, /const nextStep = flow\.steps\[completedJob\.step_order \+ 1\]/);
  assert.match(leadsApiSource, /enrollment_id: completedJob\.enrollment_id \?\? null/);
});
