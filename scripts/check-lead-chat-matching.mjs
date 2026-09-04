import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8');

const perdidoId = 'e6dfc1b0-720d-446a-8ed1-d773f781bbba';

// Check: how many leads have chat via FK?
const { count: leadsWithChat } = await supabase.from('leads')
  .select('*', { count: 'exact', head: true })
  .eq('status_id', perdidoId)
  .in('id', (await supabase.from('comm_whatsapp_chats').select('lead_id').is('deleted_at', null).not('lead_id', 'is', null)).data?.map(c => c.lead_id) || []);
console.log('Perdido leads with FK chat:', leadsWithChat);

// How many leads have NO FK chat?
const { count: leadsWithoutChat } = await supabase.from('leads')
  .select('*', { count: 'exact', head: true })
  .eq('status_id', perdidoId)
  .not('id', 'in', `(${(await supabase.from('comm_whatsapp_chats').select('lead_id').is('deleted_at', null).not('lead_id', 'is', null)).data?.map(c => `'${c.lead_id}'`).join(',') || "''"})`);
console.log('Perdido leads WITHOUT FK chat:', leadsWithoutChat);

// Get 5 leads without FK chat and check their phones against chat phones
const { data: noChatLeads } = await supabase.from('leads')
  .select('id, nome_completo, telefone')
  .eq('status_id', perdidoId)
  .not('id', 'in', `(${(await supabase.from('comm_whatsapp_chats').select('lead_id').is('deleted_at', null).not('lead_id', 'is', null)).data?.map(c => `'${c.lead_id}'`).join(',') || "''"})`)
  .limit(5);

console.log('\nSample leads without FK chat:');
for (const l of noChatLeads || []) {
  const { data: keys } = await supabase.rpc('comm_whatsapp_phone_lookup_keys', { p_phone: l.telefone });
  console.log(`  ${l.nome_completo} (${l.telefone}) -> keys: ${JSON.stringify(keys)}`);
  
  // Search for any chat with matching phone
  const { data: allChats } = await supabase.from('comm_whatsapp_chats')
    .select('phone_digits')
    .is('deleted_at', null)
    .limit(100);
  
  for (const c of allChats || []) {
    const { data: cKeys } = await supabase.rpc('comm_whatsapp_phone_lookup_keys', { p_phone: c.phone_digits });
    const overlap = keys?.filter(k => cKeys?.includes(k)) || [];
    if (overlap.length > 0) {
      console.log(`    MATCH: chat phone ${c.phone_digits} (overlap: ${overlap.join(', ')})`);
    }
  }
}
