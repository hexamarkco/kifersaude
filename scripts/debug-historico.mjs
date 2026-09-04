import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8');

const perdidoId = 'e6dfc1b0-720d-446a-8ed1-d773f781bbba';
const reatId = 'c6131bfc-9d6a-430e-af7c-44f5d6731186';

// Sample 5 leads classified as HISTORICO_INSUFICIENTE
const { data: samples } = await supabase
  .from('audit_results')
  .select('lead_id, lead_nome, lead_telefone, reason_code, reason_text, has_conversation, message_count, chat_resolution_method, furthest_stage')
  .eq('run_id', '7f01b1d3-dffa-46d2-a1f2-42e21aee7fee')
  .eq('classification', 'HISTORICO_INSUFICIENTE')
  .limit(5);

console.log('Sample HISTORICO_INSUFICIENTE leads:');
for (const s of samples || []) {
  console.log(`\n--- ${s.lead_nome} (tel: ${s.lead_telefone}) ---`);
  console.log(`  reason: ${s.reason_code} | chat: ${s.has_conversation} | msgs: ${s.message_count} | method: ${s.chat_resolution_method} | stage: ${s.furthest_stage}`);
  console.log(`  text: ${s.reason_text}`);
  
  // Check if lead has chats via FK
  const { data: fkChats } = await supabase.from('comm_whatsapp_chats').select('id, phone_digits, last_message_at').eq('lead_id', s.lead_id).is('deleted_at', null);
  console.log(`  FK chats: ${fkChats?.length || 0}`, fkChats?.map(c => `phone:${c.phone_digits} lastMsg:${c.last_message_at}`));
  
  // Check phone match
  if (s.lead_telefone) {
    const { data: phoneChats } = await supabase.rpc('audit_exec_sql', {
      p_sql: `SELECT count(*) as cnt FROM comm_whatsapp_chats c WHERE c.deleted_at IS NULL AND public.comm_whatsapp_phone_lookup_keys(c.phone_digits) && public.comm_whatsapp_phone_lookup_keys('${s.lead_telefone}')`
    });
    // Can't get result from void function. Try direct query.
    const { data: pc } = await supabase.from('comm_whatsapp_chats').select('id, phone_digits').is('deleted_at', null);
    // Filter by phone match in JS
    const matchCount = pc?.filter(c => {
      // Simple phone suffix match
      const digits = s.lead_telefone.replace(/\D/g, '');
      const chatDigits = c.phone_digits?.replace(/\D/g, '') || '';
      return chatDigits.endsWith(digits.slice(-8)) || digits.endsWith(chatDigits.slice(-8));
    }).length || 0;
    console.log(`  Phone match (JS): ${matchCount}`);
  }
  
  // Check status history
  const { data: hist } = await supabase.from('lead_status_history').select('status_novo').eq('lead_id', s.lead_id);
  console.log(`  Status history: ${hist?.map(h => h.status_novo).join(' -> ') || 'none'}`);
  
  // Check interactions
  const { count: intCount } = await supabase.from('interactions').select('*', { count: 'exact', head: true }).eq('lead_id', s.lead_id);
  console.log(`  Interactions: ${intCount}`);
}
