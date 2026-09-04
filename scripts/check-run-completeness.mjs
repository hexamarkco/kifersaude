import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8');

const runId = '7f01b1d3-dffa-46d2-a1f2-42e21aee7fee';

// Total results
const { count: totalResults } = await supabase.from('audit_results')
  .select('*', { count: 'exact', head: true })
  .eq('run_id', runId);
console.log('Total results:', totalResults);

// Total targets
const { count: totalTargets } = await supabase.from('audit_run_targets')
  .select('*', { count: 'exact', head: true })
  .eq('run_id', runId);
console.log('Total targets:', totalTargets);

// Processed targets
const { count: processedTargets } = await supabase.from('audit_run_targets')
  .select('*', { count: 'exact', head: true })
  .eq('run_id', runId)
  .not('processed_at', 'is', null);
console.log('Processed targets:', processedTargets);

// Unprocessed targets
const { count: unprocessedTargets } = await supabase.from('audit_run_targets')
  .select('*', { count: 'exact', head: true })
  .eq('run_id', runId)
  .is('processed_at', null);
console.log('Unprocessed targets:', unprocessedTargets);

// Check: how many of the 497 Perdido leads with FK chat are in the targets?
const { data: chatLeads } = await supabase.from('comm_whatsapp_chats')
  .select('lead_id')
  .is('deleted_at', null)
  .not('lead_id', 'is', null);
const chatLeadIds = [...new Set(chatLeads?.map(c => c.lead_id) || [])];

const { data: targets } = await supabase.from('audit_run_targets')
  .select('lead_id')
  .eq('run_id', runId);
const targetIds = targets?.map(t => t.lead_id) || [];

const withChatInTargets = targetIds.filter(id => chatLeadIds.includes(id));
console.log('\nPerdido leads with FK chat IN targets:', withChatInTargets.length);

// Check: how many of those were classified as HISTORICO_INSUFICIENTE?
const { count: histCount } = await supabase.from('audit_results')
  .select('*', { count: 'exact', head: true })
  .eq('run_id', runId)
  .eq('classification', 'HISTORICO_INSUFICIENTE');
console.log('HISTORICO_INSUFICIENTE results:', histCount);

// Check: for the 29 fk_direct results, what are their lead_ids?
const { data: fkResults } = await supabase.from('audit_results')
  .select('lead_id, lead_nome')
  .eq('run_id', runId)
  .eq('chat_resolution_method', 'fk_direct');
console.log('\nFK direct results:');
for (const r of fkResults || []) {
  console.log(`  ${r.lead_nome} (${r.lead_id})`);
}
