import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8');

// Clean previous runs
console.log('Cleaning previous audit data...');
await supabase.from('audit_results').delete().neq('id', '00000000-0000-0000-0000-000000000000');
await supabase.from('audit_run_targets').delete().neq('lead_id', '00000000-0000-0000-0000-000000000000');
await supabase.from('audit_runs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
console.log('Cleaned.');

// Create new run
console.log('Creating audit run...');
const { data: run, error: runErr } = await supabase
  .from('audit_runs')
  .insert({ notes: 'dry-run-v2 fixed min(uuid) bug' })
  .select()
  .single();
if (runErr) { console.error('Error:', runErr.message); process.exit(1); }
console.log('Run:', run.id);

// Execute in batches
let done = false;
let batchNum = 0;
while (!done) {
  batchNum++;
  console.log(`Batch ${batchNum}...`);
  const { error } = await supabase.rpc('audit_run_dry_run', { p_run_id: run.id, p_batch_size: 20 }, { timeout: 60000 });
  if (error) { console.error('Batch error:', error.message); break; }
  
  const { data: targets } = await supabase.from('audit_run_targets').select('processed_at').eq('run_id', run.id);
  const processed = targets?.filter(t => t.processed_at !== null).length || 0;
  const total = targets?.length || 0;
  console.log(`  ${processed}/${total}`);
  if (processed >= total) done = true;
  if (batchNum > 100) { console.log('Safety limit reached'); break; }
}

// Get summary
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

// Run info
const { data: runInfo } = await supabase.from('audit_runs').select('*').eq('id', run.id).single();
console.log('\n=== RUN INFO ===');
console.log('total_processed:', runInfo?.summary?.total_processed);
console.log('completed_at:', runInfo?.completed_at);

// Check for remaining errors
const { count: errorCount } = await supabase.from('audit_results').select('*', { count: 'exact', head: true }).eq('run_id', run.id).eq('reason_code', 'ERRO_CLASSIFICACAO');
console.log('ERRO_CLASSIFICACAO count:', errorCount);

// Sample errors if any
if (errorCount > 0) {
  const { data: errs } = await supabase.from('audit_results').select('reason_text').eq('run_id', run.id).eq('reason_code', 'ERRO_CLASSIFICACAO').limit(5);
  console.log('Sample errors:', errs?.map(e => e.reason_text));
}

console.log('\nDone!');
