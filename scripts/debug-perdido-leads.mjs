import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8');

// Check: how many Perdido leads have phone that would match a chat?
const perdidoId = 'e6dfc1b0-720d-446a-8ed1-d773f781bbba';

const { data: perdidoLeads } = await supabase.from('leads')
  .select('id, nome_completo, telefone')
  .eq('status_id', perdidoId)
  .limit(10);

console.log('Sample Perdido leads:');
for (const l of perdidoLeads || []) {
  const { data: fkChats } = await supabase.from('comm_whatsapp_chats')
    .select('id, phone_digits')
    .eq('lead_id', l.id)
    .is('deleted_at', null);
  
  const { data: lookup } = await supabase.rpc('comm_whatsapp_phone_lookup_keys', { p_phone: l.telefone });
  
  console.log(`  ${l.nome_completo} | tel: ${l.telefone} | FK chats: ${fkChats?.length || 0} | lookup: ${JSON.stringify(lookup)}`);
}

// Check total counts
const { count: totalPerdido } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status_id', perdidoId);
console.log('\nTotal Perdido leads:', totalPerdido);

const { count: withPhone } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status_id', perdidoId).not('telefone', 'is', null).neq('telefone', '');
console.log('With phone:', withPhone);

const { count: withChat } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status_id', perdidoId)
  .in('id', (await supabase.from('comm_whatsapp_chats').select('lead_id').is('deleted_at', null).not('lead_id', 'is', null)).data?.map(c => c.lead_id) || []);
console.log('With FK chat:', withChat);
