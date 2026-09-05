import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8');

// Test: does exec_sql work at all?
const { error: e1 } = await supabase.rpc('audit_exec_sql', { p_sql: 'SELECT 1' });
console.log('exec_sql test:', e1?.message || 'OK');

// Check: what does pg_get_functiondef return for our function?
const { data, error } = await supabase.rpc('audit_exec_sql', {
  p_sql: `DO $$ BEGIN RAISE NOTICE '%', (SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'audit_classify_single_lead' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')); END $$;`
});
console.log('NOTICE test:', error?.message || 'OK (check server logs)');

// Alternative: use information_schema
const { data: funcData, error: e2 } = await supabase.from('information_schema.routines')
  .select('routine_name, routine_definition')
  .eq('routine_name', 'audit_classify_single_lead')
  .eq('routine_schema', 'public')
  .single();
if (e2) console.error('info_schema error:', e2.message);
else {
  console.log('\nFunction definition (information_schema):');
  console.log(funcData?.routine_definition?.substring(0, 2000));
}

// Check: does the CASE block have the right values?
const def = funcData?.routine_definition || '';
console.log('\n--- Checking CASE values ---');
const caseValues = [
  'novo', 'contato inicial', 'atendimento', 'em atendimento', 'em analise',
  'aguardando cotacao', 'aguardando cotação', 'proposta enviada', 'negociacao',
  'decisao', 'decisão', 'contratacao', 'contratação', 'convertido'
];
for (const v of caseValues) {
  const found = def.includes(`'${v}'`);
  if (found) console.log(`  '${v}': FOUND`);
}

// Check the final CASE block
console.log('\n--- Final CASE (v_furthest_stage) ---');
const finalIdx = def.lastIndexOf('CASE');
if (finalIdx > 0) {
  console.log(def.substring(finalIdx, finalIdx + 1200));
}
