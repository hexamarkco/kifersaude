import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8');

// Get the actual function source from the database
const { data, error } = await supabase.rpc('audit_exec_sql', {
  p_sql: `SELECT pg_get_functiondef(oid) as def FROM pg_proc WHERE proname = 'audit_classify_single_lead' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')`
});
// exec_sql is void, can't return. Let me try a different approach.

// Create a helper that returns text
const { error: e2 } = await supabase.rpc('audit_exec_sql', {
  p_sql: `CREATE OR REPLACE FUNCTION public.audit_get_func_def(p_name text) RETURNS text LANGUAGE sql AS $$ SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = p_name AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') $$`
});
if (e2) console.error('Create helper error:', e2.message);

const { data: funcDef, error: e3 } = await supabase.rpc('audit_get_func_def', { p_name: 'audit_classify_single_lead' });
if (e3) console.error('Get func def error:', e3.message);
else {
  console.log('Function source (first 3000 chars):');
  console.log(funcDef?.substring(0, 3000));
  console.log('\n... (truncated) ...\n');
  
  // Check: does it have 'proposta enviada' in the CASE?
  const hasProposta = funcDef?.includes("'proposta enviada'");
  const hasEmAtendimento = funcDef?.includes("'em atendimento'");
  const hasEmAnalise = funcDef?.includes("'em analise'");
  console.log(`Contains 'proposta enviada': ${hasProposta}`);
  console.log(`Contains 'em atendimento': ${hasEmAtendimento}`);
  console.log(`Contains 'em analise': ${hasEmAnalise}`);
  
  // Check the CASE block specifically
  const caseMatch = funcDef?.match(/FOR v_hist IN[\s\S]*?END LOOP;[\s\S]*?v_furthest_stage := v_best_stage/);
  if (caseMatch) {
    console.log('\nCASE block in loop:');
    console.log(caseMatch[0].substring(0, 1500));
  }
}

// Also test: manually classify a known SUMIU_APOS_COTACAO lead and check the intermediate values
console.log('\n' + '='.repeat(70));
console.log('MANUAL TEST: Aline (977278ec)');
console.log('='.repeat(70));

// Check: does the CASE match 'proposta enviada'?
const { data: normTest } = await supabase.rpc('audit_normalize_text', { p_text: 'Proposta Enviada' });
console.log('normalize("Proposta Enviada"):', JSON.stringify(normTest));

// Test: what does the loop produce?
const { data: histEntries } = await supabase.from('lead_status_history')
  .select('status_novo')
  .eq('lead_id', '977278ec-82a0-42e1-8a62-e59fb98f582b');

console.log('Status history entries:');
for (const h of histEntries || []) {
  const { data: n } = await supabase.rpc('audit_normalize_text', { p_text: h.status_novo });
  console.log(`  "${h.status_novo}" -> "${n}"`);
  // Check if this matches any CASE branch
  const matches = ['novo', 'contato inicial', 'atendimento', 'em atendimento', 'em analise', 
    'aguardando cotacao', 'aguardando cotação', 'proposta enviada', 'negociacao', 
    'decisao', 'decisão', 'contratacao', 'contratação', 'convertido'];
  const found = matches.includes(n);
  console.log(`    matches CASE: ${found}`);
}
