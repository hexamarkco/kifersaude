import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8');

const perdidoId = 'e6dfc1b0-720d-446a-8ed1-d773f781bbba';

// Get all Perdido lead IDs that have FK chats
const { data: chatLeads } = await supabase.from('comm_whatsapp_chats')
  .select('lead_id')
  .is('deleted_at', null)
  .not('lead_id', 'is', null);
const chatLeadIds = [...new Set(chatLeads?.map(c => c.lead_id) || [])];
console.log('Unique leads with FK chats:', chatLeadIds.length);

// Get all Perdido leads
const { data: allLeads } = await supabase.from('leads')
  .select('id')
  .eq('status_id', perdidoId);
const allLeadIds = allLeads?.map(l => l.id) || [];
console.log('Total Perdido leads:', allLeadIds.length);

// Count overlap
const withChat = allLeadIds.filter(id => chatLeadIds.includes(id));
console.log('Perdido leads with FK chat:', withChat.length);
console.log('Perdido leads WITHOUT FK chat:', allLeadIds.length - withChat.length);

// Check: for leads WITHOUT FK chat, do any have phone that matches a chat?
const withoutChat = allLeadIds.filter(id => !chatLeadIds.includes(id)).slice(0, 5);
console.log('\nSample Perdido leads without FK chat:');
for (const leadId of withoutChat) {
  const { data: lead } = await supabase.from('leads').select('nome_completo, telefone').eq('id', leadId).single();
  if (!lead) continue;
  
  const { data: leadKeys } = await supabase.rpc('comm_whatsapp_phone_lookup_keys', { p_phone: lead.telefone });
  
  // Check against first 20 chats
  let found = false;
  const { data: sampleChats } = await supabase.from('comm_whatsapp_chats')
    .select('phone_digits')
    .is('deleted_at', null)
    .limit(20);
  
  for (const c of sampleChats || []) {
    const { data: cKeys } = await supabase.rpc('comm_whatsapp_phone_lookup_keys', { p_phone: c.phone_digits });
    if (leadKeys?.some(lk => cKeys?.includes(lk))) {
      console.log(`  ${lead.nome_completo} (${lead.telefone}) MATCHED chat ${c.phone_digits}`);
      found = true;
      break;
    }
  }
  if (!found) {
    console.log(`  ${lead.nome_completo} (${lead.telefone}) - no match in sample chats`);
  }
}
