import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8');

const runId = '611d0887-7788-45c4-b8fc-44403d1a7326';

console.log('=== DRY RUN AUDIT REPORT ===');
console.log('Run ID:', runId);

const { data: runInfo } = await supabase.from('audit_runs').select('*').eq('id', runId).single();
console.log('Started:', runInfo?.started_at);
console.log('Completed:', runInfo?.completed_at);
console.log('Notes:', runInfo?.notes);

// Full summary
const { data: summary } = await supabase.rpc('audit_get_summary', { p_run_id: runId });
console.log('\n--- CLASSIFICATION DISTRIBUTION ---');
if (summary) {
  const byClass = {};
  for (const row of summary) {
    if (!byClass[row.classification]) byClass[row.classification] = { total: 0, reasons: [] };
    byClass[row.classification].total += Number(row.count);
    byClass[row.classification].reasons.push({ code: row.reason_code, count: Number(row.count), pct: row.pct });
  }
  for (const [cls, info] of Object.entries(byClass).sort((a, b) => b[1].total - a[1].total)) {
    const pct = (100 * info.total / 2403).toFixed(1);
    console.log(`\n${cls}: ${info.total} (${pct}%)`);
    for (const r of info.reasons) {
      console.log(`  ${r.code}: ${r.count} (${r.pct}%)`);
    }
  }
}

// Chat resolution methods
console.log('\n--- CHAT RESOLUTION METHODS ---');
const methods = ['fk_direct', 'phone_match', 'ambiguous', 'none'];
for (const m of methods) {
  const { count } = await supabase.from('audit_results')
    .select('*', { count: 'exact', head: true })
    .eq('run_id', runId)
    .eq('chat_resolution_method', m);
  console.log(`  ${m}: ${count}`);
}

// Sample per classification
console.log('\n--- SAMPLES PER CLASSIFICATION ---');
const classifications = [
  'MOVER_PARA_REATIVACAO',
  'MANTER_PERDIDO',
  'HISTORICO_INSUFICIENTE',
  'STATUS_POSSIVELMENTE_INCONSISTENTE'
];
for (const cls of classifications) {
  const { data: samples } = await supabase
    .from('audit_results')
    .select('lead_nome, lead_telefone, reason_code, reason_text, confidence, has_conversation, message_count, furthest_stage, chat_resolution_method, last_message_direction')
    .eq('run_id', runId)
    .eq('classification', cls)
    .order('confidence', { ascending: false })
    .limit(3);
  console.log(`\n--- ${cls} ---`);
  for (const s of samples || []) {
    console.log(`  ${s.lead_nome} (${s.lead_telefone})`);
    console.log(`    ${s.reason_code}: ${s.reason_text}`);
    console.log(`    conf=${s.confidence} chat=${s.has_conversation} msgs=${s.message_count} stage=${s.furthest_stage} method=${s.chat_resolution_method} dir=${s.last_message_direction}`);
  }
}

console.log('\n=== END REPORT ===');
