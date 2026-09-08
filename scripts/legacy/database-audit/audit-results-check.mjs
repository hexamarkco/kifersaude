import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8');

const runId = '7f01b1d3-dffa-46d2-a1f2-42e21aee7fee'; // The full run that had 96% HISTORICO_INSUFICIENTE

// Check: how many results have fk_direct method?
const { count: fkCount } = await supabase.from('audit_results')
  .select('*', { count: 'exact', head: true })
  .eq('run_id', runId)
  .eq('chat_resolution_method', 'fk_direct');
console.log('Results with fk_direct:', fkCount);

// How many have phone_match?
const { count: phoneCount } = await supabase.from('audit_results')
  .select('*', { count: 'exact', head: true })
  .eq('run_id', runId)
  .eq('chat_resolution_method', 'phone_match');
console.log('Results with phone_match:', phoneCount);

// How many have none?
const { count: noneCount } = await supabase.from('audit_results')
  .select('*', { count: 'exact', head: true })
  .eq('run_id', runId)
  .eq('chat_resolution_method', 'none');
console.log('Results with none:', noneCount);

// How many HISTORICO_INSUFICIENTE have has_conversation = true?
const { count: histWithChat } = await supabase.from('audit_results')
  .select('*', { count: 'exact', head: true })
  .eq('run_id', runId)
  .eq('classification', 'HISTORICO_INSUFICIENTE')
  .eq('has_conversation', true);
console.log('HISTORICO_INSUFICIENTE with has_conversation=true:', histWithChat);

// Check: for the leads that got HISTORICO_INSUFICIENTE with method=none, do they have FK chats?
const { data: histNone } = await supabase.from('audit_results')
  .select('lead_id, lead_nome')
  .eq('run_id', runId)
  .eq('classification', 'HISTORICO_INSUFICIENTE')
  .eq('chat_resolution_method', 'none')
  .limit(10);

console.log('\nSample HISTORICO_INSUFICIENTE with method=none:');
for (const r of histNone || []) {
  const { data: chats } = await supabase.from('comm_whatsapp_chats')
    .select('id, phone_digits')
    .eq('lead_id', r.lead_id)
    .is('deleted_at', null);
  console.log(`  ${r.lead_nome}: FK chats = ${chats?.length || 0}`);
}
