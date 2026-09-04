import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8');

// Test: get lookup keys for a chat's phone_digits
const { data: chatPhone } = await supabase.from('comm_whatsapp_chats').select('phone_digits').is('deleted_at', null).limit(1).single();
console.log('Chat phone_digits:', chatPhone?.phone_digits);

const { data: chatKeys } = await supabase.rpc('comm_whatsapp_phone_lookup_keys', { p_phone: chatPhone?.phone_digits });
console.log('Chat lookup_keys:', chatKeys);

// Test: get lookup keys for a lead phone
const leadPhone = '22981807634';
const { data: leadKeys } = await supabase.rpc('comm_whatsapp_phone_lookup_keys', { p_phone: leadPhone });
console.log('Lead lookup_keys:', leadKeys);

// Test overlap
const overlap = chatKeys?.filter(k => leadKeys?.includes(k)) || [];
console.log('Overlap:', overlap);

// Direct SQL test via exec_sql (void function, can't return data)
// Let me check the actual SQL by looking at what the function does
console.log('\nChecking if phone_lookup_keys is IMMUTABLE (cache issue?):');
const { data: fnInfo } = await supabase.from('pg_proc').select('provolatile, proconfig').eq('proname', 'comm_whatsapp_phone_lookup_keys');
console.log('Function info:', fnInfo);

// Try a direct overlap test
console.log('\nDirect overlap test:');
console.log('chatKeys:', chatKeys);
console.log('leadKeys:', leadKeys);
const hasOverlap = chatKeys?.some(ck => leadKeys?.includes(ck));
console.log('Has overlap:', hasOverlap);
