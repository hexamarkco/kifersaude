import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8');

const runId = '611d0887-7788-45c4-b8fc-44403d1a7326';
const now = new Date();

// ============================================================
// 1. NUNCA_ENGAJOU
// ============================================================
console.log('='.repeat(70));
console.log('1. VALIDACAO: NUNCA_ENGAJOU');
console.log('='.repeat(70));

const { data: nuncaEngajou } = await supabase
  .from('audit_results')
  .select('lead_id, lead_nome, lead_telefone, has_conversation, message_count, last_inbound_at, last_outbound_at, last_message_direction, furthest_stage, chat_resolution_method, evidence_snippet')
  .eq('run_id', runId)
  .eq('reason_code', 'NUNCA_ENGAJOU');

const totalNE = nuncaEngajou?.length || 0;
const comChat = nuncaEngajou?.filter(r => r.has_conversation) || [];
const semChat = nuncaEngajou?.filter(r => !r.has_conversation) || [];

console.log(`\nTotal NUNCA_ENGAJOU: ${totalNE}`);
console.log(`  Com chat (has_conversation=true): ${comChat.length}`);
console.log(`  Sem chat (has_conversation=false): ${semChat.length}`);

// Check: dependem exclusivamente de ausencia de inbound no Inbox?
const semInbound = comChat.filter(r => r.message_count > 0 && !r.last_inbound_at);
const semChatInbox = semChat;

console.log(`\nEvidencias:`);
console.log(`  Leads com chat mas sem inbound (apenas outbound): ${semInbound.length}`);
console.log(`  Leads sem chat no inbox: ${semChatInbox.length}`);

// Verify: all NUNCA_ENGAJOU MUST have has_conversation=true and message_count>0
// If has_conversation=false, the classification is WRONG
if (semChat.length > 0) {
  console.log(`\n  *** ALERTA: ${semChat.length} leads NUNCA_ENGAJOU sem chat! ***`);
  console.log(`  Estes serao reclassificados para HISTORICO_INSUFICIENTE.`);
  for (const r of semChat.slice(0, 5)) {
    console.log(`    ${r.lead_nome} (${r.lead_telefone}) stage=${r.furthest_stage} method=${r.chat_resolution_method}`);
  }
  if (semChat.length > 5) console.log(`    ... e mais ${semChat.length - 5}`);
}

// Verify: all NUNCA_ENGAJOU with chat should have message_count > 0 and last_inbound_at IS NULL
const validNE = comChat.filter(r => r.message_count > 0);
const invalidNE = comChat.filter(r => r.message_count === 0);
console.log(`\n  Validacao:`);
console.log(`    Com chat e msgs > 0: ${validNE.length}`);
console.log(`    Com chat mas msgs = 0 (ERRO): ${invalidNE.length}`);

// Show evidence snippets
console.log(`\nAmostra de evidencias (NUNCA_ENGAJOU validos):`);
for (const r of comChat.slice(0, 5)) {
  console.log(`  ${r.lead_nome}: msgs=${r.message_count} stage=${r.furthest_stage} method=${r.chat_resolution_method}`);
  console.log(`    evidence: ${r.evidence_snippet?.substring(0, 100)}`);
}

// ============================================================
// 2. SUMIU_APOS_COTACAO
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('2. VALIDACAO: SUMIU_APOS_COTACAO');
console.log('='.repeat(70));

const { data: sumiuCotacao } = await supabase
  .from('audit_results')
  .select('lead_id, lead_nome, lead_telefone, furthest_stage, has_conversation, message_count, chat_resolution_method, evidence_snippet')
  .eq('run_id', runId)
  .eq('reason_code', 'SUMIU_APOS_COTACAO');

const totalSC = sumiuCotacao?.length || 0;
console.log(`\nTotal SUMIU_APOS_COTACAO: ${totalSC}`);

// Breakdown by furthest_stage
const byStage = {};
for (const r of sumiuCotacao || []) {
  const stage = r.furthest_stage || 'null';
  if (!byStage[stage]) byStage[stage] = [];
  byStage[stage].push(r);
}
console.log(`Por furthest_stage:`);
for (const [stage, leads] of Object.entries(byStage).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${stage}: ${leads.length}`);
}

// Check: leads with furthest_stage='Aguardando cotacao' should be reclassified
const aguardandoCotacao = byStage['Aguardando cotacao'] || [];
if (aguardandoCotacao.length > 0) {
  console.log(`\n  *** ALERTA: ${aguardandoCotacao.length} leads com stage "Aguardando cotacao" ***`);
  console.log(`  Estes NAO tem evidencia de proposta enviada e devem ser reclassificados para`);
  console.log(`  STATUS_POSSIVELMENTE_INCONSISTENTE / COTACAO_PENDENTE_OU_STATUS_DESATUALIZADO`);
  for (const r of aguardandoCotacao.slice(0, 3)) {
    console.log(`    ${r.lead_nome} (${r.lead_telefone}) msgs=${r.message_count} method=${r.chat_resolution_method}`);
  }
}

// Check: leads with stage in ('Proposta Enviada', 'Negociacao') are VALID
const validSC = (byStage['Proposta Enviada'] || []).concat(byStage['Negociacao'] || []);
console.log(`\n  Validacao:`);
console.log(`    Stage = Proposta Enviada ou Negociacao (VALIDO): ${validSC.length}`);
console.log(`    Stage = Aguardando cotacao (INVALIDO, reclassificar): ${aguardandoCotacao.length}`);
const otherStages = Object.entries(byStage).filter(([s]) => !['Proposta Enviada', 'Negociacao', 'Aguardando cotacao'].includes(s));
for (const [stage, leads] of otherStages) {
  console.log(`    Stage = ${stage} (${leads.length})`);
}

// ============================================================
// 3. CLIENTE_AGUARDANDO_RETORNO
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('3. VALIDACAO: CLIENTE_AGUARDANDO_RETORNO');
console.log('='.repeat(70));

const { data: clienteAguardando } = await supabase
  .from('audit_results')
  .select('lead_id, lead_nome, lead_telefone, last_inbound_at, last_outbound_at, furthest_stage, has_conversation, message_count')
  .eq('run_id', runId)
  .eq('reason_code', 'CLIENTE_AGUARDANDO_RETORNO');

const totalCAR = clienteAguardando?.length || 0;
console.log(`\nTotal CLIENTE_AGUARDANDO_RETORNO: ${totalCAR}`);

// Age buckets
const ageBuckets = { 'ate_7d': 0, '8_30d': 0, '31_90d': 0, '91_180d': 0, 'mais_180d': 0, 'sem_data': 0 };
const ageDetails = { 'ate_7d': [], '8_30d': [], '31_90d': [], '91_180d': [], 'mais_180d': [], 'sem_data': [] };

for (const r of clienteAguardando || []) {
  if (!r.last_inbound_at) {
    ageBuckets.sem_data++;
    ageDetails.sem_data.push(r);
    continue;
  }
  const daysSince = Math.floor((now - new Date(r.last_inbound_at)) / (1000 * 60 * 60 * 24));
  if (daysSince <= 7) { ageBuckets.ate_7d++; ageDetails.ate_7d.push(r); }
  else if (daysSince <= 30) { ageBuckets['8_30d']++; ageDetails['8_30d'].push(r); }
  else if (daysSince <= 90) { ageBuckets['31_90d']++; ageDetails['31_90d'].push(r); }
  else if (daysSince <= 180) { ageBuckets['91_180d']++; ageDetails['91_180d'].push(r); }
  else { ageBuckets.mais_180d++; ageDetails.mais_180d.push(r); }
}

console.log(`\nPor idade da ultima inbound:`);
console.log(`  ate 7 dias: ${ageBuckets.ate_7d}`);
console.log(`  8-30 dias: ${ageBuckets['8_30d']}`);
console.log(`  31-90 dias: ${ageBuckets['31_90d']}`);
console.log(`  91-180 dias: ${ageBuckets['91_180d']}`);
console.log(`  >180 dias: ${ageBuckets.mais_180d}`);
console.log(`  sem data: ${ageBuckets.sem_data}`);

// Furthest stage breakdown
const carByStage = {};
for (const r of clienteAguardando || []) {
  const stage = r.furthest_stage || 'outros';
  if (!carByStage[stage]) carByStage[stage] = { total: 0, byAge: {} };
  carByStage[stage].total++;
}

// Cross-tab: stage x age
console.log(`\nPor furthest_stage:`);
const stageOrder = ['Contato Inicial', 'Atendimento', 'Aguardando cotacao', 'Proposta Enviada', 'Decisao', 'Contratacao'];
const allStages = [...new Set((clienteAguardando || []).map(r => r.furthest_stage || 'outros'))];
for (const stage of [...stageOrder, ...allStages.filter(s => !stageOrder.includes(s))]) {
  const stageLeads = (clienteAguardando || []).filter(r => (r.furthest_stage || 'outros') === stage);
  if (stageLeads.length === 0) continue;
  
  const byAgeStage = { ate7: 0, d8a30: 0, d31a90: 0, d91a180: 0, m180: 0, sem: 0 };
  for (const r of stageLeads) {
    if (!r.last_inbound_at) { byAgeStage.sem++; continue; }
    const d = Math.floor((now - new Date(r.last_inbound_at)) / (1000 * 60 * 60 * 24));
    if (d <= 7) byAgeStage.ate7++;
    else if (d <= 30) byAgeStage.d8a30++;
    else if (d <= 90) byAgeStage.d31a90++;
    else if (d <= 180) byAgeStage.d91a180++;
    else byAgeStage.m180++;
  }
  console.log(`  ${stage}: ${stageLeads.length} (<=7d:${byAgeStage.ate7} 8-30d:${byAgeStage.d8a30} 31-90d:${byAgeStage.d31a90} 91-180d:${byAgeStage.d91a180} >180d:${byAgeStage.m180} sem:${byAgeStage.sem})`);
}

// ============================================================
// 4. STATUS_CONVERTIDO_HISTORICO
// ============================================================
console.log('\n' + '='.repeat(70));
console.log('4. VALIDACAO: STATUS_CONVERTIDO_HISTORICO / STATUS_POSSIVELMENTE_INCONSISTENTE');
console.log('='.repeat(70));

const { data: inconsistentes } = await supabase
  .from('audit_results')
  .select('lead_id, lead_nome, lead_telefone, reason_code, has_conversation, message_count')
  .eq('run_id', runId)
  .eq('classification', 'STATUS_POSSIVELMENTE_INCONSISTENTE');

const totalIncomp = inconsistentes?.length || 0;
console.log(`\nTotal STATUS_POSSIVELMENTE_INCONSISTENTE: ${totalIncomp}`);

// Segment by reason
const byReason = {};
for (const r of inconsistentes || []) {
  if (!byReason[r.reason_code]) byReason[r.reason_code] = [];
  byReason[r.reason_code].push(r);
}
for (const [reason, leads] of Object.entries(byReason)) {
  console.log(`\n  ${reason}: ${leads.length}`);
}

// For STATUS_CONVERTIDO_HISTORICO: check contracts
const convertidos = byReason['STATUS_CONVERTIDO_HISTORICO'] || [];
console.log(`\n  STATUS_CONVERTIDO_HISTORICO (${convertidos.length}):`);

// Check contracts for each
let comContrato = 0;
let semContrato = 0;
const convertidoDetails = [];

for (const r of convertidos) {
  const { data: contracts } = await supabase.from('contracts')
    .select('id, status')
    .eq('lead_id', r.lead_id);
  
  const activeContracts = contracts?.filter(c => 
    ['Emitido', 'Ativo', 'Em analise', 'Proposta enviada', 'Documentos pendentes', 'Aguardando assinatura'].includes(c.status)
  ) || [];
  
  if (activeContracts.length > 0) {
    comContrato++;
    convertidoDetails.push({ ...r, hasContract: true, contractStatus: activeContracts[0].status });
  } else {
    semContrato++;
    convertidoDetails.push({ ...r, hasContract: false });
  }
}

console.log(`    Com contrato ativo/emitido: ${comContrato}`);
console.log(`    Sem contrato (inconsistencia pura): ${semContrato}`);

// Show samples
console.log(`\n  Amostra - com contrato:`);
for (const r of convertidoDetails.filter(d => d.hasContract).slice(0, 3)) {
  console.log(`    ${r.lead_nome} (${r.lead_telefone}) - contrato: ${r.contractStatus}`);
}
console.log(`  Amostra - sem contrato:`);
for (const r of convertidoDetails.filter(d => !d.hasContract).slice(0, 3)) {
  console.log(`    ${r.lead_nome} (${r.lead_telefone})`);
}

// CONTRATO_ATIVO
const contratos = byReason['CONTRATO_ATIVO'] || [];
console.log(`\n  CONTRATO_ATIVO: ${contratos.length}`);

// CLIENTE_AGUARDANDO_RETORNO (already counted above)
const car = byReason['CLIENTE_AGUARDANDO_RETORNO'] || [];
console.log(`  CLIENTE_AGUARDANDO_RETORNO: ${car.length} (ver secao 3)`);

// COTACAO_PENDENTE (from the future reclassification)
const cotPend = byReason['COTACAO_PENDENTE_OU_STATUS_DESATUALIZADO'] || [];
console.log(`  COTACAO_PENDENTE_OU_STATUS_DESATUALIZADO: ${cotPend.length}`);

console.log('\nDone!');
