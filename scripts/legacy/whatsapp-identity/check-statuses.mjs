import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'process.env.SUPABASE_SERVICE_ROLE_KEY');

const { data, error } = await supabase.from('lead_status_config').select('id, nome, ordem').order('ordem');
if (error) console.error('Error:', error.message);
else {
  console.log('Statuses:');
  for (const s of data) {
    console.log(`  ${s.ordem}: "${s.nome}" (id: ${s.id})`);
  }
}

// Also test normalize function
console.log('\nTesting normalize:');
for (const s of data) {
  const { data: norm } = await supabase.rpc('audit_normalize_text', { p_text: s.nome });
  console.log(`  "${s.nome}" -> "${norm}"`);
}
