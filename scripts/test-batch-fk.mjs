import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8');

const perdidoId = 'e6dfc1b0-720d-446a-8ed1-d773f781bbba';
const reatId = 'c6131bfc-9d6a-430e-af7c-44f5d6731186';

// Find a Perdido lead that HAS an FK chat
const { data: chatLeads } = await supabase.from('comm_whatsapp_chats')
  .select('lead_id')
  .is('deleted_at', null)
  .not('lead_id', 'is', null);

const chatLeadIds = [...new Set(chatLeads?.map(c => c.lead_id) || [])];

// Get first 5 Perdido leads with FK chat
const { data: perdidoChats } = await supabase.from('leads')
  .select('id, nome_completo, telefone')
  .eq('status_id', perdidoId)
  .in('id', chatLeadIds.slice(0, 20));

console.log(`Found ${perdidoChats?.length} Perdido leads with FK chats`);

for (const l of perdidoChats?.slice(0, 3) || []) {
  console.log(`\n--- ${l.nome_completo} (${l.telefone}) ---`);
  
  const { data: result, error } = await supabase.rpc('audit_classify_single_lead', {
    p_lead_id: l.id,
    p_perdido_id: perdidoId,
    p_reativacao_id: reatId
  });
  if (error) console.error('Error:', error.message);
  else {
    const r = result?.[0];
    console.log(`  Classification: ${r?.classification}`);
    console.log(`  Reason: ${r?.reason_code} - ${r?.reason_text}`);
    console.log(`  Chat: ${r?.has_conversation} | msgs: ${r?.message_count} | method: ${r?.chat_resolution_method}`);
    console.log(`  Stage: ${r?.furthest_stage} | dir: ${r?.last_message_direction}`);
  }
}

// Now test batch on these leads
console.log('\n\nTesting batch on first 10 Perdido leads with FK chat...');
const { data: run } = await supabase.from('audit_runs').insert({ notes: 'test-batch-fk-chats' }).select().single();
console.log('Run:', run.id);

// Insert these leads as targets
const targets = chatLeadIds.slice(0, 10).map((lead_id, i) => ({
  run_id: run.id,
  lead_id,
  ordinal: i + 1
}));
const { error: insErr } = await supabase.from('audit_run_targets').insert(targets);
if (insErr) console.error('Insert targets error:', insErr.message);

// Run batch
const { error: batchErr } = await supabase.rpc('audit_run_dry_run', {
  p_run_id: run.id,
  p_batch_size: 10
});
if (batchErr) console.error('Batch error:', batchErr.message);

// Get results
const { data: results } = await supabase.from('audit_results')
  .select('lead_nome, classification, reason_code, has_conversation, message_count, chat_resolution_method')
  .eq('run_id', run.id);
console.log('\nBatch results:');
for (const r of results || []) {
  console.log(`  ${r.lead_nome}: ${r.classification} | ${r.reason_code} | chat:${r.has_conversation} msgs:${r.message_count} method:${r.chat_resolution_method}`);
}
