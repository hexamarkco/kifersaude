import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8');

console.log('=== FULL CLEANUP ===');

// Delete all results first (FK dependency)
console.log('Deleting audit_results...');
const { error: e1 } = await supabase.from('audit_results').delete().neq('id', '00000000-0000-0000-0000-000000000000');
console.log('  Error:', e1?.message || 'OK');

// Delete all targets
console.log('Deleting audit_run_targets...');
const { error: e2 } = await supabase.from('audit_run_targets').delete().neq('lead_id', '00000000-0000-0000-0000-000000000000');
console.log('  Error:', e2?.message || 'OK');

// Delete all runs
console.log('Deleting audit_runs...');
const { error: e3 } = await supabase.from('audit_runs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
console.log('  Error:', e3?.message || 'OK');

// Verify cleanup
const { count: rCount } = await supabase.from('audit_results').select('*', { count: 'exact', head: true });
const { count: tCount } = await supabase.from('audit_run_targets').select('*', { count: 'exact', head: true });
const { count: runCount } = await supabase.from('audit_runs').select('*', { count: 'exact', head: true });
console.log(`\nAfter cleanup: runs=${runCount} targets=${tCount} results=${rCount}`);

// Create fresh run
console.log('\nCreating fresh run...');
const { data: run, error: runErr } = await supabase
  .from('audit_runs')
  .insert({ notes: 'dry-run-v3 clean fresh' })
  .select()
  .single();
if (runErr) { console.error('Error:', runErr.message); process.exit(1); }
console.log('Run:', run.id);

// Execute in batches of 20
let done = false;
let batchNum = 0;
while (!done) {
  batchNum++;
  const { error } = await supabase.rpc('audit_run_dry_run', { p_run_id: run.id, p_batch_size: 20 }, { timeout: 60000 });
  if (error) { console.error(`Batch ${batchNum} error:`, error.message); break; }
  
  const { count: processed } = await supabase.from('audit_run_targets')
    .select('*', { count: 'exact', head: true })
    .eq('run_id', run.id)
    .not('processed_at', 'is', null);
  const { count: total } = await supabase.from('audit_run_targets')
    .select('*', { count: 'exact', head: true })
    .eq('run_id', run.id);
  
  if (batchNum % 10 === 0) console.log(`Batch ${batchNum}: ${processed}/${total}`);
  
  if (processed >= total) done = true;
  if (batchNum > 200) { console.log('Safety limit'); break; }
}

console.log(`\nCompleted in ${batchNum} batches`);

// Get final counts
const { count: finalProcessed } = await supabase.from('audit_run_targets')
  .select('*', { count: 'exact', head: true })
  .eq('run_id', run.id)
  .not('processed_at', 'is', null);
const { count: finalTotal } = await supabase.from('audit_run_targets')
  .select('*', { count: 'exact', head: true })
  .eq('run_id', run.id);
console.log(`Processed: ${finalProcessed}/${finalTotal}`);

// Summary
console.log('\n=== CLASSIFICATION SUMMARY ===');
const { data: summary } = await supabase.rpc('audit_get_summary', { p_run_id: run.id });
if (summary) {
  const byClass = {};
  for (const row of summary) {
    if (!byClass[row.classification]) byClass[row.classification] = { total: 0, reasons: [] };
    byClass[row.classification].total += Number(row.count);
    byClass[row.classification].reasons.push({ code: row.reason_code, count: Number(row.count), pct: row.pct });
  }
  for (const [cls, info] of Object.entries(byClass).sort((a, b) => b[1].total - a[1].total)) {
    console.log(`\n${cls}: ${info.total} leads`);
    for (const r of info.reasons) {
      console.log(`  ${r.code}: ${r.count} (${r.pct}%)`);
    }
  }
}

// Check for errors
const { count: errCount } = await supabase.from('audit_results')
  .select('*', { count: 'exact', head: true })
  .eq('run_id', run.id)
  .eq('reason_code', 'ERRO_CLASSIFICACAO');
console.log('\nERRO_CLASSIFICACAO:', errCount);

// Check method distribution
const { count: fkDirect } = await supabase.from('audit_results')
  .select('*', { count: 'exact', head: true })
  .eq('run_id', run.id)
  .eq('chat_resolution_method', 'fk_direct');
const { count: phoneMatch } = await supabase.from('audit_results')
  .select('*', { count: 'exact', head: true })
  .eq('run_id', run.id)
  .eq('chat_resolution_method', 'phone_match');
console.log(`Chat methods: fk_direct=${fkDirect} phone_match=${phoneMatch}`);

console.log('\nDone!');
