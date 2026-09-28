import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'vitest';

const migrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260915151927_prevent_auto_contact_flow_self_reentry.sql'),
  'utf8',
);
const cutoverRepairMigrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260915153939_repair_auto_contact_inactivity_cutover_config_lookup.sql'),
  'utf8',
);
const inactivityOptimizationMigrationSource = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260928001054_20261014030000_optimize_auto_contact_inactivity_scan.sql'),
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

test('cutover lookups use the persisted system configuration key and value columns', () => {
  assert.match(cutoverRepairMigrationSource, /config_value::text/);
  assert.match(cutoverRepairMigrationSource, /config_key = ''inactivity_enrollment_cutover_at''/);
  assert.match(cutoverRepairMigrationSource, /public\.automation_flows_health\(\)/);
  assert.match(cutoverRepairMigrationSource, /public\.check_auto_contact_inactivity_triggers\(\)/);
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

test('the inactivity scanner reads only the latest visible message per chat', () => {
  assert.match(inactivityOptimizationMigrationSource, /idx_comm_whatsapp_messages_chat_latest_visible/);
  assert.match(inactivityOptimizationMigrationSource, /WHERE public\.comm_whatsapp_message_preview_text\(media_caption, text_content, message_type\) IS NOT NULL/);
  assert.match(inactivityOptimizationMigrationSource, /JOIN LATERAL \(\s*SELECT[\s\S]*FROM public\.comm_whatsapp_messages m/);
  assert.match(inactivityOptimizationMigrationSource, /ORDER BY m\.message_at DESC, m\.id DESC\s*LIMIT 1/);
  assert.match(inactivityOptimizationMigrationSource, /ORDER BY l\.created_at DESC\s*LIMIT 20/);
  assert.match(inactivityOptimizationMigrationSource, /v_total_leads := v_total_leads \+ 1/);
});
