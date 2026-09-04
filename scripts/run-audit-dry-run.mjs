import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8');

console.log('Creating audit run...');
const { data: run, error: runErr } = await supabase
  .from('audit_runs')
  .insert({ notes: 'dry-run-v1 classification audit' })
  .select()
  .single();

if (runErr) {
  console.error('Error creating run:', runErr.message);
  process.exit(1);
}
console.log('Run created:', run.id);

console.log('Executing dry run batch 1...');
const { error: err1 } = await supabase.rpc('audit_run_dry_run', {
  p_run_id: run.id,
  p_batch_size: 500
});
if (err1) {
  console.error('Batch 1 error:', err1.message);
  process.exit(1);
}
console.log('Batch 1 done');

// Check progress
const { data: targets } = await supabase
  .from('audit_run_targets')
  .select('processed_at')
  .eq('run_id', run.id);
const processed = targets?.filter(t => t.processed_at !== null).length || 0;
const total = targets?.length || 0;
console.log(`Progress: ${processed}/${total}`);

// Continue batching until done
while (processed < total) {
  console.log(`Executing next batch (remaining: ${total - processed})...`);
  const { error } = await supabase.rpc('audit_run_dry_run', {
    p_run_id: run.id,
    p_batch_size: 500
  });
  if (error) {
    console.error('Batch error:', error.message);
    break;
  }
  const { data: t2 } = await supabase
    .from('audit_run_targets')
    .select('processed_at')
    .eq('run_id', run.id);
  const p2 = t2?.filter(t => t.processed_at !== null).length || 0;
  console.log(`Progress: ${p2}/${t2?.length || 0}`);
  if (p2 >= (t2?.length || 0)) break;
}

// Get summary
console.log('\nGetting summary...');
const { data: summary } = await supabase.rpc('audit_get_summary', { p_run_id: run.id });
console.log('\n=== CLASSIFICATION SUMMARY ===');
if (summary) {
  const byClass = {};
  for (const row of summary) {
    if (!byClass[row.classification]) byClass[row.classification] = { total: 0, pct: row.pct, reasons: [] };
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

// Get run info
const { data: runInfo } = await supabase.from('audit_runs').select('*').eq('id', run.id).single();
console.log('\n=== RUN INFO ===');
console.log(JSON.stringify(runInfo?.summary, null, 2));
console.log('Status: completed_at =', runInfo?.completed_at);

// Sample results per classification
console.log('\n=== SAMPLES (2 per classification) ===');
const classifications = ['MOVER_PARA_REATIVACAO', 'MANTER_PERDIDO', 'HISTORICO_INSUFICIENTE', 'STATUS_POSSIVELMENTE_INCONSISTENTE'];
for (const cls of classifications) {
  const { data: samples } = await supabase
    .from('audit_results')
    .select('lead_nome, lead_telefone, reason_code, reason_text, confidence, has_conversation, message_count, furthest_stage')
    .eq('run_id', run.id)
    .eq('classification', cls)
    .order('confidence', { ascending: false })
    .limit(2);
  console.log(`\n--- ${cls} ---`);
  if (samples?.length) {
    for (const s of samples) {
      console.log(`  ${s.lead_nome} | tel: ${s.lead_telefone} | ${s.reason_code} | conf: ${s.confidence} | chat: ${s.has_conversation} | msgs: ${s.message_count} | stage: ${s.furthest_stage}`);
      console.log(`    ${s.reason_text}`);
    }
  } else {
    console.log('  (nenhum resultado)');
  }
}

console.log('\nDone!');
