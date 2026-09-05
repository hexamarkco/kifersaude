import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8');

const runId = '611d0887-7788-45c4-b8fc-44403d1a7326';
const perdidoId = 'e6dfc1b0-720d-446a-8ed1-d773f781bbba';
const reatId = 'c6131bfc-9d6a-430e-af7c-44f5d6731186';

// ============================================================
// INVESTIGATE: SUMIU_APOS_COTACAO furthest_stage=null
// ============================================================
console.log('='.repeat(70));
console.log('INVESTIGACAO: SUMIU_APOS_COTACAO com furthest_stage=null');
console.log('='.repeat(70));

const { data: sumiuLeads } = await supabase
  .from('audit_results')
  .select('lead_id, lead_nome')
  .eq('run_id', runId)
  .eq('reason_code', 'SUMIU_APOS_COTACAO')
  .limit(5);

for (const r of sumiuLeads || []) {
  console.log(`\n--- ${r.lead_nome} (${r.lead_id}) ---`);
  
  // Check status history
  const { data: hist } = await supabase.from('lead_status_history')
    .select('status_novo, created_at')
    .eq('lead_id', r.lead_id)
    .order('created_at');
  
  console.log('  Status history:');
  for (const h of hist || []) {
    console.log(`    ${h.status_novo} (${h.created_at})`);
    // Test normalize
    const { data: norm } = await supabase.rpc('audit_normalize_text', { p_text: h.status_novo });
    console.log(`      normalize("${h.status_novo}") = "${norm}"`);
  }
  
  // Manually test classify
  const { data: result } = await supabase.rpc('audit_classify_single_lead', {
    p_lead_id: r.lead_id,
    p_perdido_id: perdidoId,
    p_reativacao_id: reatId
  });
  if (result?.length) {
    console.log(`  Reclassify: ${result[0].classification} / ${result[0].reason_code} / stage=${result[0].furthest_stage}`);
  }
}

// Check: what status_novo values exist in lead_status_history?
console.log('\n' + '='.repeat(70));
console.log('STATUS_NOVO VALUES IN LEAD_STATUS_HISTORY');
console.log('='.repeat(70));

const { data: distinctStatuses } = await supabase.rpc('audit_exec_sql', {
  p_sql: "SELECT DISTINCT status_novo, count(*) as cnt FROM lead_status_history GROUP BY status_novo ORDER BY cnt DESC"
});
// Can't get results from void. Let me try another way.
// Get distinct status_novo from leads that are Perdido
const { data: sampleLeads } = await supabase.from('leads')
  .select('id')
  .eq('status_id', perdidoId)
  .limit(20);

const statusSet = new Set();
for (const l of sampleLeads || []) {
  const { data: hist } = await supabase.from('lead_status_history')
    .select('status_novo')
    .eq('lead_id', l.id);
  for (const h of hist || []) {
    statusSet.add(h.status_novo);
  }
}
console.log('Distinct status_novo values found:', [...statusSet].sort());

// ============================================================
// INVESTIGATE: NUNCA_ENGAJOU semantics
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('INVESTIGACAO: NUNCA_ENGAJOU - leads com chat sem inbound');
console.log('='.repeat(70));

const { data: nuncaLeads } = await supabase
  .from('audit_results')
  .select('lead_id, lead_nome, message_count, last_inbound_at, furthest_stage, evidence_snippet')
  .eq('run_id', runId)
  .eq('reason_code', 'NUNCA_ENGAJOU')
  .limit(10);

for (const r of nuncaLeads || []) {
  console.log(`\n  ${r.lead_nome}:`);
  console.log(`    msgs=${r.message_count} inbound=${r.last_inbound_at} stage=${r.furthest_stage}`);
  console.log(`    evidence: ${r.evidence_snippet?.substring(0, 120)}`);
  
  // Check interactions
  const { count: intCount } = await supabase.from('interactions')
    .select('*', { count: 'exact', head: true })
    .eq('lead_id', r.lead_id);
  console.log(`    interactions: ${intCount}`);
}

// Check: how many NUNCA_ENGAJOU have interactions?
console.log('\n--- NUNCA_ENGAJOU com interacoes no CRM ---');
const { data: allNE } = await supabase
  .from('audit_results')
  .select('lead_id')
  .eq('run_id', runId)
  .eq('reason_code', 'NUNCA_ENGAJOU');

let neComInteracoes = 0;
for (const r of allNE || []) {
  const { count } = await supabase.from('interactions')
    .select('*', { count: 'exact', head: true })
    .eq('lead_id', r.lead_id);
  if (count > 0) neComInteracoes++;
}
console.log(`NUNCA_ENGAJOU com interacoes: ${neComInteracoes}/${allNE?.length}`);
