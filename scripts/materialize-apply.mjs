import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8');

const runId = 'be2026df-c146-4a78-aa85-cf167580f500';
const perdidoId = 'e6dfc1b0-720d-446a-8ed1-d773f781bbba';
const reatId = 'c6131bfc-9d6a-430e-af7c-44f5d6731186';

// Extract all 358 lead_ids with their reason_codes
const { data: results, error } = await supabase
  .from('audit_results')
  .select('lead_id, reason_code')
  .eq('run_id', runId)
  .eq('classification', 'MOVER_PARA_REATIVACAO');

if (error) { console.error('Error:', error.message); process.exit(1); }
console.log(`Total MOVER_PARA_REATIVACAO: ${results?.length}`);

// Verify all are currently Perdido
const leadIds = results?.map(r => r.lead_id) || [];
const { data: leads } = await supabase.from('leads').select('id, status_id, skip_automation, nome_completo').in('id', leadIds);

const nonPerdido = leads?.filter(l => l.status_id !== perdidoId) || [];
console.log(`Non-Perdido leads: ${nonPerdido.length}`);
if (nonPerdido.length > 0) {
  for (const l of nonPerdido) {
    console.log(`  ${l.nome_completo}: status_id=${l.status_id}`);
  }
}

// Verify destination exists
const { data: destStatus } = await supabase.from('lead_status_config').select('id, nome').eq('id', reatId).single();
console.log(`Destination status: ${destStatus?.nome} (${destStatus?.id})`);

// Count by reason_code
const byReason = {};
for (const r of results || []) {
  byReason[r.reason_code] = (byReason[r.reason_code] || 0) + 1;
}
console.log('\nBreakdown by reason_code:');
for (const [reason, count] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${reason}: ${count}`);
}

// Save lead_ids to a file for the migration
const leadData = results?.map(r => {
  const lead = leads?.find(l => l.id === r.lead_id);
  return {
    id: r.lead_id,
    reason_code: r.reason_code,
    original_skip: lead?.skip_automation || false
  };
}) || [];

// Write as SQL array
const sqlValues = leadData.map(d => `('${d.id}'::uuid, '${d.reason_code}', ${d.original_skip})`).join(',\n    ');
const skipTrueIds = leadData.filter(d => !d.original_skip).map(d => `'${d.id}'::uuid`);
const skipAlreadyTrueIds = leadData.filter(d => d.original_skip).map(d => `'${d.id}'::uuid`);

console.log(`\nLeads with skip_automation=false (need temp set): ${skipTrueIds.length}`);
console.log(`Leads with skip_automation=true (already protected): ${skipAlreadyTrueIds.length}`);

// Write the SQL migration
const migrationSql = `-- APPLY: Move 358 Perdido leads to Reativação
-- Dry run: ${runId}
-- Strategy: transactional skip_automation protection

BEGIN;

-- 1. Materialize the 358 approved leads
CREATE TEMPORARY TABLE _apply_targets (
  lead_id uuid PRIMARY KEY,
  reason_code text NOT NULL,
  original_skip boolean NOT NULL
) ON COMMIT DROP;

INSERT INTO _apply_targets (lead_id, reason_code, original_skip) VALUES
    ${sqlValues};

-- 2. Pre-APPLY validation
DO $$
DECLARE
  v_count integer;
  v_non_perdido integer;
  v_dest_exists boolean;
  v_reat_id uuid := '${reatId}';
  v_perdido_id uuid := '${perdidoId}';
BEGIN
  -- Exactly 358 found
  SELECT count(*) INTO v_count FROM _apply_targets;
  IF v_count != 358 THEN
    RAISE EXCEPTION 'Expected 358 targets, found %', v_count;
  END IF;

  -- All currently Perdido
  SELECT count(*) INTO v_non_perdido
  FROM _apply_targets t
  JOIN leads l ON l.id = t.lead_id
  WHERE l.status_id != v_perdido_id;

  IF v_non_perdido > 0 THEN
    RAISE EXCEPTION '% leads are not in Perdido status', v_non_perdido;
  END IF;

  -- Destination exists
  SELECT EXISTS(SELECT 1 FROM lead_status_config WHERE id = v_reat_id) INTO v_dest_exists;
  IF NOT v_dest_exists THEN
    RAISE EXCEPTION 'Reativação status not found';
  END IF;

  -- None belong to excluded classifications
  IF EXISTS (
    SELECT 1 FROM audit_results r
    WHERE r.run_id = '${runId}'
      AND r.lead_id IN (SELECT lead_id FROM _apply_targets)
      AND r.classification != 'MOVER_PARA_REATIVACAO'
  ) THEN
    RAISE EXCEPTION 'Some targets belong to excluded classifications';
  END IF;

  RAISE NOTICE 'Pre-APPLY validation passed: % targets, all Perdido, destination valid', v_count;
END $$;

-- 3. Phase 1: Set skip_automation = true for leads that don't have it
UPDATE leads
SET skip_automation = true
WHERE id IN (
  SELECT lead_id FROM _apply_targets WHERE original_skip = false
);

-- 4. Phase 2: Update status from Perdido to Reativação
UPDATE leads
SET status_id = '${reatId}'::uuid
WHERE id IN (SELECT lead_id FROM _apply_targets);

-- 5. Phase 3: Restore skip_automation to original values
UPDATE leads
SET skip_automation = t.original_skip
FROM _apply_targets t
WHERE leads.id = t.lead_id;

-- 6. Post-APPLY validation
DO $$
DECLARE
  v_updated integer;
  v_wrong_status integer;
  v_skip_wrong integer;
  v_reat_id uuid := '${reatId}';
  v_perdido_id uuid := '${perdidoId}';
BEGIN
  -- Count updated to Reativação
  SELECT count(*) INTO v_updated
  FROM leads l
  JOIN _apply_targets t ON l.id = t.lead_id
  WHERE l.status_id = v_reat_id;

  IF v_updated != 358 THEN
    RAISE EXCEPTION 'Expected 358 updated to Reativação, found %', v_updated;
  END IF;

  -- None should still be Perdido
  SELECT count(*) INTO v_wrong_status
  FROM leads l
  JOIN _apply_targets t ON l.id = t.lead_id
  WHERE l.status_id = v_perdido_id;

  IF v_wrong_status > 0 THEN
    RAISE EXCEPTION '% leads still Perdido after update', v_wrong_status;
  END IF;

  -- Check skip_automation restored correctly
  SELECT count(*) INTO v_skip_wrong
  FROM leads l
  JOIN _apply_targets t ON l.id = t.lead_id
  WHERE COALESCE(l.skip_automation, false) != t.original_skip;

  IF v_skip_wrong > 0 THEN
    RAISE EXCEPTION '% leads have wrong skip_automation after restore', v_skip_wrong;
  END IF;

  RAISE NOTICE 'Post-APPLY validation passed: % updated to Reativação, skip_automation restored', v_updated;
END $$;

COMMIT;
`;

// Write migration file
import { writeFileSync } from 'fs';
const filename = `C:\\Users\\Nick Martins\\Documents\\GitHub\\kifersaude\\supabase\\migrations\\20260904100000_apply_perdido_to_reativacao.sql`;
writeFileSync(filename, migrationSql);
console.log(`\nMigration written to: ${filename}`);
console.log(`SQL size: ${migrationSql.length} bytes`);
