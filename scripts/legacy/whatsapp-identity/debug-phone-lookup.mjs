import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8');

// Check what phone_lookup_keys returns
const testPhones = ['22981807634', '21983216308', '21971360689'];
for (const phone of testPhones) {
  const { data, error } = await supabase.rpc('comm_whatsapp_phone_lookup_keys', { p_phone: phone });
  console.log(`Phone ${phone} -> lookup_keys:`, error ? `ERROR: ${error.message}` : JSON.stringify(data));
}

// Check what's in chats phone_digits
const { data: chatPhones } = await supabase.from('comm_whatsapp_chats').select('phone_digits').is('deleted_at', null).limit(10);
console.log('\nSample chat phone_digits:', chatPhones?.map(c => c.phone_digits));

// Check total chats count
const { count: chatCount } = await supabase.from('comm_whatsapp_chats').select('*', { count: 'exact', head: true }).is('deleted_at', null);
console.log('Total active chats:', chatCount);

// Check how many chats have lead_id set
const { count: fkCount } = await supabase.from('comm_whatsapp_chats').select('*', { count: 'exact', head: true }).is('deleted_at', null).not('lead_id', 'is', null);
console.log('Chats with lead_id:', fkCount);

// Check how many chats have phone_digits
const { count: phoneCount } = await supabase.from('comm_whatsapp_chats').select('*', { count: 'exact', head: true }).is('deleted_at', null).not('phone_digits', 'is', null);
console.log('Chats with phone_digits:', phoneCount);
