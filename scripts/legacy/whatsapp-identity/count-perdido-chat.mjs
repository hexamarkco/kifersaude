import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'process.env.SUPABASE_SERVICE_ROLE_KEY');

const perdidoId = 'e6dfc1b0-720d-446a-8ed1-d773f781bbba';

// Get ALL Perdido lead IDs
const { data: allPerdido } = await supabase.from('leads')
  .select('id')
  .eq('status_id', perdidoId);
const allIds = allPerdido?.map(l => l.id) || [];
console.log('Total Perdido leads:', allIds.length);

// Get all chats with lead_id
const { data: chatLeads } = await supabase.from('comm_whatsapp_chats')
  .select('lead_id')
  .is('deleted_at', null)
  .not('lead_id', 'is', null);
const chatLeadSet = new Set(chatLeads?.map(c => c.lead_id) || []);
console.log('Total unique leads with FK chats:', chatLeadSet.size);

// Count Perdido leads with FK chat
let withChat = 0;
for (const id of allIds) {
  if (chatLeadSet.has(id)) withChat++;
}
console.log('Perdido leads WITH FK chat:', withChat);
console.log('Perdido leads WITHOUT FK chat:', allIds.length - withChat);

// Sample 3 Perdido leads that DO have FK chats
const withChatIds = allIds.filter(id => chatLeadSet.has(id)).slice(0, 3);
console.log('\nSample Perdido leads WITH FK chat:');
for (const id of withChatIds) {
  const { data: lead } = await supabase.from('leads').select('nome_completo, telefone').eq('id', id).single();
  const { data: chats } = await supabase.from('comm_whatsapp_chats').select('id, phone_digits').eq('lead_id', id).is('deleted_at', null);
  console.log(`  ${lead?.nome_completo} (${lead?.telefone}): ${chats?.length} chats`);
}

// Sample 3 Perdido leads WITHOUT FK chats
const withoutChatIds = allIds.filter(id => !chatLeadSet.has(id)).slice(0, 3);
console.log('\nSample Perdido leads WITHOUT FK chat:');
for (const id of withoutChatIds) {
  const { data: lead } = await supabase.from('leads').select('nome_completo, telefone').eq('id', id).single();
  console.log(`  ${lead?.nome_completo} (${lead?.telefone})`);
}
