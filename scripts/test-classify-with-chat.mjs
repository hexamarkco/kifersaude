import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8');

const perdidoId = 'e6dfc1b0-720d-446a-8ed1-d773f781bbba';
const reatId = 'c6131bfc-9d6a-430e-af7c-44f5d6731186';

// Find a Perdido lead that HAS an FK chat
const { data: chatLead } = await supabase.from('comm_whatsapp_chats')
  .select('lead_id')
  .is('deleted_at', null)
  .not('lead_id', 'is', null)
  .limit(1)
  .single();

console.log('Testing lead with FK chat:', chatLead?.lead_id);

const { data: lead } = await supabase.from('leads')
  .select('nome_completo, telefone, status_id')
  .eq('id', chatLead?.lead_id)
  .single();
console.log('Lead:', JSON.stringify(lead));

// Check if this lead is Perdido
console.log('Is Perdido:', lead?.status_id === perdidoId);

// Check FK chats
const { data: chats } = await supabase.from('comm_whatsapp_chats')
  .select('id, phone_digits, last_message_at')
  .eq('lead_id', chatLead?.lead_id)
  .is('deleted_at', null);
console.log('FK chats:', JSON.stringify(chats));

// Check messages in first chat
if (chats?.length) {
  const { data: msgs } = await supabase.from('comm_whatsapp_messages')
    .select('direction, message_at, text_content')
    .eq('chat_id', chats[0].id)
    .order('message_at', { ascending: false })
    .limit(5);
  console.log('Last 5 messages:', JSON.stringify(msgs));
}

// Now classify this lead
const { data: result, error } = await supabase.rpc('audit_classify_single_lead', {
  p_lead_id: chatLead?.lead_id,
  p_perdido_id: perdidoId,
  p_reativacao_id: reatId
});
if (error) console.error('Error:', error.message);
else console.log('Classification:', JSON.stringify(result?.[0], null, 2));
