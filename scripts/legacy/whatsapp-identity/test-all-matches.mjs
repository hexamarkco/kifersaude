import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8');

const perdidoId = 'e6dfc1b0-720d-446a-8ed1-d773f781bbba';

// Get 10 Perdido leads
const { data: leads } = await supabase.from('leads')
  .select('id, nome_completo, telefone')
  .eq('status_id', perdidoId)
  .limit(10);

// Get all chat phone_digits
const { data: chats } = await supabase.from('comm_whatsapp_chats')
  .select('id, phone_digits, lead_id')
  .is('deleted_at', null);

console.log(`Total chats: ${chats?.length}`);
console.log(`\nTesting each lead against all chats via SQL overlap:`);

for (const l of leads || []) {
  // Check FK
  const fkChats = chats?.filter(c => c.lead_id === l.id) || [];
  
  // Check phone overlap via lookup_keys
  const leadKeys = await getKeys(l.telefone);
  let matchCount = 0;
  let matchChats = [];
  
  for (const c of chats || []) {
    const chatKeys = await getKeys(c.phone_digits);
    const overlap = leadKeys.filter(k => chatKeys.includes(k));
    if (overlap.length > 0) {
      matchCount++;
      matchChats.push({ id: c.id, phone: c.phone_digits, overlap });
    }
  }
  
  console.log(`\n${l.nome_completo} (${l.telefone}):`);
  console.log(`  FK chats: ${fkChats.length}`);
  console.log(`  Phone matches: ${matchCount}`);
  if (matchChats.length > 0) {
    for (const mc of matchChats.slice(0, 3)) {
      console.log(`    chat ${mc.id}: ${mc.phone} (overlap: ${mc.overlap.join(', ')})`);
    }
  }
}

async function getKeys(phone) {
  if (!phone) return [];
  const { data } = await supabase.rpc('comm_whatsapp_phone_lookup_keys', { p_phone: phone });
  return data || [];
}
