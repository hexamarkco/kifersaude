import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8');

const runId = 'be2026df-c146-4a78-aa85-cf167580f500';
const now = new Date();

console.log('='.repeat(70));
console.log('VALIDACAO FINAL - DRY RUN CORRIGIDO');
console.log('Run ID:', runId);
console.log('='.repeat(70));

// ============================================================
// 1. NUNCA_ENGAJOU
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('1. NUNCA_ENGAJOU');
console.log('='.repeat(70));

const { data: nunca } = await supabase
  .from('audit_results')
  .select('lead_id, lead_nome, has_conversation, message_count, last_inbound_at, furthest_stage')
  .eq('run_id', runId)
  .eq('reason_code', 'NUNCA_ENGAJOU');

const totalNE = nunca?.length || 0;
const comChat = nunca?.filter(r => r.has_conversation) || [];
const semChat = nunca?.filter(r => !r.has_conversation) || [];

console.log(`Total: ${totalNE}`);
console.log(`  Com chat: ${comChat.length}`);
console.log(`  Sem chat: ${semChat.length}`);

// Check interactions for all NUNCA_ENGAJOU
let neComInteracoes = 0;
for (const r of nunca || []) {
  const { count } = await supabase.from('interactions')
    .select('*', { count: 'exact', head: true })
    .eq('lead_id', r.lead_id);
  if (count > 0) neComInteracoes++;
}
console.log(`  Com interacoes no CRM: ${neComInteracoes}`);
console.log(`  Dependen exclusivamente de ausencia de inbound: ${comChat.filter(r => !r.last_inbound_at).length}`);

// ============================================================
// 2. SUMIU_APOS_COTACAO
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('2. SUMIU_APOS_COTACAO');
console.log('='.repeat(70));

const { data: sumiu } = await supabase
  .from('audit_results')
  .select('lead_id, lead_nome, furthest_stage, has_conversation, message_count')
  .eq('run_id', runId)
  .eq('reason_code', 'SUMIU_APOS_COTACAO');

const totalSC = sumiu?.length || 0;
console.log(`Total: ${totalSC}`);

const byStageSC = {};
for (const r of sumiu || []) {
  const s = r.furthest_stage || 'null';
  if (!byStageSC[s]) byStageSC[s] = 0;
  byStageSC[s]++;
}
console.log('Por furthest_stage:');
for (const [s, c] of Object.entries(byStageSC).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${s}: ${c}`);
}

const validSC = (byStageSC['Proposta Enviada'] || 0) + (byStageSC['Negociacao'] || 0);
const invalidSC = byStageSC['null'] || 0;
console.log(`\nValidacao:`);
console.log(`  Proposta Enviada / Negociacao (VALIDO): ${validSC}`);
console.log(`  null (bug anterior, agora corrigido): ${invalidSC}`);

// ============================================================
// 3. CLIENTE_AGUARDANDO_RETORNO
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('3. CLIENTE_AGUARDANDO_RETORNO');
console.log('='.repeat(70));

const { data: car } = await supabase
  .from('audit_results')
  .select('lead_id, lead_nome, last_inbound_at, furthest_stage')
  .eq('run_id', runId)
  .eq('reason_code', 'CLIENTE_AGUARDANDO_RETORNO');

const totalCAR = car?.length || 0;
console.log(`Total: ${totalCAR}`);

// Age buckets
const ageBuckets = { 'ate_7d': 0, '8_30d': 0, '31_90d': 0, '91_180d': 0, 'mais_180d': 0 };
for (const r of car || []) {
  if (!r.last_inbound_at) { ageBuckets.mais_180d++; continue; }
  const d = Math.floor((now - new Date(r.last_inbound_at)) / (1000 * 60 * 60 * 24));
  if (d <= 7) ageBuckets.ate_7d++;
  else if (d <= 30) ageBuckets['8_30d']++;
  else if (d <= 90) ageBuckets['31_90d']++;
  else if (d <= 180) ageBuckets['91_180d']++;
  else ageBuckets.mais_180d++;
}

console.log('\nPor idade da ultima inbound:');
console.log(`  ate 7 dias: ${ageBuckets.ate_7d}`);
console.log(`  8-30 dias: ${ageBuckets['8_30d']}`);
console.log(`  31-90 dias: ${ageBuckets['31_90d']}`);
console.log(`  91-180 dias: ${ageBuckets['91_180d']}`);
console.log(`  >180 dias: ${ageBuckets.mais_180d}`);

// Cross-tab: stage x age
console.log('\nPor furthest_stage (com idade):');
const stageOrder = ['Novo', 'Contato Inicial', 'Atendimento', 'Aguardando cotacao', 'Proposta Enviada', 'Decisao', 'Contratacao'];
const allStagesCAR = [...new Set((car || []).map(r => r.furthest_stage || 'outros'))];

for (const stage of [...stageOrder, ...allStagesCAR.filter(s => !stageOrder.includes(s))]) {
  const stageLeads = (car || []).filter(r => (r.furthest_stage || 'outros') === stage);
  if (stageLeads.length === 0) continue;
  
  const byAge = { ate7: 0, d8a30: 0, d31a90: 0, d91a180: 0, m180: 0 };
  for (const r of stageLeads) {
    if (!r.last_inbound_at) { byAge.m180++; continue; }
    const d = Math.floor((now - new Date(r.last_inbound_at)) / (1000 * 60 * 60 * 24));
    if (d <= 7) byAge.ate7++;
    else if (d <= 30) byAge.d8a30++;
    else if (d <= 90) byAge.d31a90++;
    else if (d <= 180) byAge.d91a180++;
    else byAge.m180++;
  }
  console.log(`  ${stage}: ${stageLeads.length} (<=7d:${byAge.ate7} 8-30d:${byAge.d8a30} 31-90d:${byAge.d31a90} 91-180d:${byAge.d91a180} >180d:${byAge.m180})`);
}

// ============================================================
// 4. STATUS_CONVERTIDO_HISTORICO
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('4. STATUS_CONVERTIDO_HISTORICO');
console.log('='.repeat(70));

const { data: convertidos } = await supabase
  .from('audit_results')
  .select('lead_id, lead_nome, lead_telefone')
  .eq('run_id', runId)
  .eq('reason_code', 'STATUS_CONVERTIDO_HISTORICO');

const totalConv = convertidos?.length || 0;
console.log(`Total: ${totalConv}`);

let convComContrato = 0;
let convSemContrato = 0;
for (const r of convertidos || []) {
  const { data: contracts } = await supabase.from('contracts')
    .select('status')
    .eq('lead_id', r.lead_id);
  const active = contracts?.filter(c => ['Emitido', 'Ativo', 'Em analise', 'Proposta enviada', 'Documentos pendentes', 'Aguardando assinatura'].includes(c.status)) || [];
  if (active.length > 0) convComContrato++;
  else convSemContrato++;
}
console.log(`  Com contrato ativo/emitido: ${convComContrato}`);
console.log(`  Sem contrato (inconsistencia pura): ${convSemContrato}`);

// CONTRATO_ATIVO
const { data: contratos } = await supabase
  .from('audit_results')
  .select('lead_id, lead_nome')
  .eq('run_id', runId)
  .eq('reason_code', 'CONTRATO_ATIVO');
console.log(`\nCONTRATO_ATIVO: ${contratos?.length || 0}`);

// COTACAO_PENDENTE
const { data: cotPend } = await supabase
  .from('audit_results')
  .select('lead_id, lead_nome, furthest_stage')
  .eq('run_id', runId)
  .eq('reason_code', 'COTACAO_PENDENTE_OU_STATUS_DESATUALIZADO');
console.log(`COTACAO_PENDENTE_OU_STATUS_DESATUALIZADO: ${cotPend?.length || 0}`);
if (cotPend?.length) {
  const byStage = {};
  for (const r of cotPend) {
    const s = r.furthest_stage || 'null';
    byStage[s] = (byStage[s] || 0) + 1;
  }
  console.log(`  Por stage: ${JSON.stringify(byStage)}`);
}

console.log('\nDone!');
