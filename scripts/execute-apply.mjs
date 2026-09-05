import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8');

const runId = 'be2026df-c146-4a78-aa85-cf167580f500';
const perdidoId = 'e6dfc1b0-720d-446a-8ed1-d773f781bbba';
const reatId = 'c6131bfc-9d6a-430e-af7c-44f5d6731186';

// Step 1: Get all 358 lead_ids and their original skip_automation
console.log('Step 1: Extracting 358 leads...');
const { data: results } = await supabase
  .from('audit_results')
  .select('lead_id, reason_code')
  .eq('run_id', runId)
  .eq('classification', 'MOVER_PARA_REATIVACAO');

const leadIds = results?.map(r => r.lead_id) || [];
console.log(`  Found: ${leadIds.length}`);

// Get original skip_automation values
const { data: leads } = await supabase.from('leads')
  .select('id, skip_automation')
  .in('id', leadIds);

const leadMap = {};
for (const l of leads || []) {
  leadMap[l.id] = l.skip_automation;
}

// Build the VALUES clause
const values = results?.map(r => {
  const skip = leadMap[r.lead_id] || false;
  return `('${r.lead_id}'::uuid, '${r.reason_code}', ${skip})`;
}).join(',\n    ') || '';

// Step 2: Create the apply function
console.log('Step 2: Creating apply function...');

const funcSql = `CREATE OR REPLACE FUNCTION public.audit_apply_reativacao()
RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_reat_id uuid := '${reatId}';
  v_perdido_id uuid := '${perdidoId}';
  v_count integer;
  v_non_perdido integer;
  v_updated integer;
  v_skip_wrong integer;
BEGIN
  -- Phase 1: Create temp table with targets
  CREATE TEMPORARY TABLE _apply_targets (
    lead_id uuid PRIMARY KEY,
    reason_code text NOT NULL,
    original_skip boolean NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO _apply_targets (lead_id, reason_code, original_skip) VALUES
    ${values};

  -- Pre-validation: exactly 358
  SELECT count(*) INTO v_count FROM _apply_targets;
  IF v_count != 358 THEN
    RAISE EXCEPTION 'Expected 358 targets, found %', v_count;
  END IF;

  -- Pre-validation: all Perdido
  SELECT count(*) INTO v_non_perdido
  FROM _apply_targets t
  JOIN leads l ON l.id = t.lead_id
  WHERE l.status_id != v_perdido_id;
  IF v_non_perdido > 0 THEN
    RAISE EXCEPTION '% leads are not in Perdido status', v_non_perdido;
  END IF;

  -- Pre-validation: destination exists
  IF NOT EXISTS (SELECT 1 FROM lead_status_config WHERE id = v_reat_id) THEN
    RAISE EXCEPTION 'Reativação status not found';
  END IF;

  RAISE NOTICE 'Pre-validation passed: % targets, all Perdido, destination valid', v_count;

  -- Phase 2: Set skip_automation=true for leads that need it
  UPDATE leads
  SET skip_automation = true
  WHERE id IN (SELECT lead_id FROM _apply_targets WHERE original_skip = false);
  RAISE NOTICE 'Phase 2: skip_automation set to true for % leads', (SELECT count(*) FROM _apply_targets WHERE original_skip = false);

  -- Phase 3: Update status Perdido → Reativação
  UPDATE leads
  SET status_id = v_reat_id
  WHERE id IN (SELECT lead_id FROM _apply_targets);
  RAISE NOTICE 'Phase 3: status updated to Reativação for % leads', (SELECT count(*) FROM _apply_targets);

  -- Phase 4: Restore skip_automation
  UPDATE leads
  SET skip_automation = t.original_skip
  FROM _apply_targets t
  WHERE leads.id = t.lead_id;
  RAISE NOTICE 'Phase 4: skip_automation restored';

  -- Post-validation
  SELECT count(*) INTO v_updated
  FROM leads l JOIN _apply_targets t ON l.id = t.lead_id
  WHERE l.status_id = v_reat_id;
  IF v_updated != 358 THEN
    RAISE EXCEPTION 'Expected 358 updated, found %', v_updated;
  END IF;

  SELECT count(*) INTO v_skip_wrong
  FROM leads l JOIN _apply_targets t ON l.id = t.lead_id
  WHERE COALESCE(l.skip_automation, false) != t.original_skip;
  IF v_skip_wrong > 0 THEN
    RAISE EXCEPTION '% leads have wrong skip_automation after restore', v_skip_wrong;
  END IF;

  RAISE NOTICE 'Post-validation passed: % updated to Reativação, skip_automation restored correctly', v_updated;
END;
$fn$;`;

const { error: funcErr } = await supabase.rpc('audit_exec_sql', { p_sql: funcSql });
if (funcErr) { console.error('Create function error:', funcErr.message); process.exit(1); }
console.log('  Function created.');

// Step 3: Record job/message counts before APPLY
console.log('Step 3: Recording pre-APPLY counts...');
const { count: preJobs } = await supabase.from('auto_contact_flow_jobs')
  .select('*', { count: 'exact', head: true })
  .in('lead_id', leadIds);
console.log(`  Pre-APPLY auto_contact_flow_jobs for these leads: ${preJobs}`);

const { count: preMsgs } = await supabase.from('comm_whatsapp_messages')
  .select('*', { count: 'exact', head: true })
  .in('chat_id',
    (await supabase.from('comm_whatsapp_chats').select('id').in('lead_id', leadIds)).data?.map(c => c.id) || []
  );
console.log(`  Pre-APPLY whatsapp messages for these leads: ${preMsgs}`);

// Step 4: Execute the APPLY
console.log('\nStep 4: EXECUTING APPLY...');
const startTime = Date.now();
const { error: applyErr } = await supabase.rpc('audit_apply_reativacao');
const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
if (applyErr) {
  console.error('APPLY FAILED:', applyErr.message);
  process.exit(1);
}
console.log(`  APPLY completed in ${elapsed}s`);

// Step 5: Post-APPLY validation
console.log('\nStep 5: Post-APPLY validation...');

// Count updated
const { count: postUpdated } = await supabase.from('leads')
  .select('*', { count: 'exact', head: true })
  .in('id', leadIds)
  .eq('status_id', reatId);
console.log(`  Leads now in Reativação: ${postUpdated}`);

// Count still Perdido
const { count: stillPerdido } = await supabase.from('leads')
  .select('*', { count: 'exact', head: true })
  .in('id', leadIds)
  .eq('status_id', perdidoId);
console.log(`  Leads still Perdido: ${stillPerdido}`);

// Check skip_automation restoration
let skipWrong = 0;
let skipOriginalTrue = 0;
let skipOriginalFalse = 0;
for (const r of results || []) {
  const { data: lead } = await supabase.from('leads').select('skip_automation').eq('id', r.lead_id).single();
  const originalSkip = leadMap[r.lead_id] || false;
  const currentSkip = lead?.skip_automation || false;
  if (currentSkip !== originalSkip) {
    skipWrong++;
    console.log(`  SKIP MISMATCH: ${r.lead_id} original=${originalSkip} current=${currentSkip}`);
  }
  if (originalSkip) skipOriginalTrue++;
  else skipOriginalFalse++;
}
console.log(`  skip_automation mismatches: ${skipWrong}`);
console.log(`  Leads originally skip=true (preserved): ${skipOriginalTrue}`);
console.log(`  Leads originally skip=false (restored): ${skipOriginalFalse}`);

// Check no new jobs created
const { count: postJobs } = await supabase.from('auto_contact_flow_jobs')
  .select('*', { count: 'exact', head: true })
  .in('lead_id', leadIds);
console.log(`  Post-APPLY auto_contact_flow_jobs: ${postJobs} (delta: ${(postJobs || 0) - (preJobs || 0)})`);

// Check no new messages
const chatIds = (await supabase.from('comm_whatsapp_chats').select('id').in('lead_id', leadIds)).data?.map(c => c.id) || [];
const { count: postMsgs } = await supabase.from('comm_whatsapp_messages')
  .select('*', { count: 'exact', head: true })
  .in('chat_id', chatIds);
console.log(`  Post-APPLY whatsapp messages: ${postMsgs} (delta: ${(postMsgs || 0) - (preMsgs || 0)})`);

// Breakdown by reason_code
console.log('\nBreakdown by reason_code (updated leads):');
const byReason = {};
for (const r of results || []) {
  byReason[r.reason_code] = (byReason[r.reason_code] || 0) + 1;
}
for (const [reason, count] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${reason}: ${count}`);
}

// Final status
console.log('\n=== APPLY RESULT ===');
const allOk = postUpdated === 358 && stillPerdido === 0 && skipWrong === 0;
console.log(`Status: ${allOk ? 'SUCCESS' : 'FAILED'}`);
console.log(`Expected: 358 | Updated: ${postUpdated} | Skipped: ${stillPerdido} | Skip mismatches: ${skipWrong}`);
console.log(`Jobs created: ${(postJobs || 0) - (preJobs || 0)} | Messages sent: ${(postMsgs || 0) - (preMsgs || 0)}`);
