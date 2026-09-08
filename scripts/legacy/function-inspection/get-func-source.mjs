import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8');

// Get function source via a temp table approach
const setupSql = `
CREATE OR REPLACE FUNCTION public.audit_get_func_source(p_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_source text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_source
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE p.proname = p_name AND n.nspname = 'public';
  RETURN v_source;
END;
$$;`;

const { error: e1 } = await supabase.rpc('audit_exec_sql', { p_sql: setupSql });
if (e1) console.error('Setup error:', e1.message);

const { data: source, error: e2 } = await supabase.rpc('audit_get_func_source', { p_name: 'audit_classify_single_lead' });
if (e2) console.error('Get source error:', e2.message);
else {
  // Find the CASE block in the loop
  const lines = source?.split('\n') || [];
  let inCase = false;
  let caseLines = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('FOR v_hist IN')) inCase = true;
    if (inCase) {
      caseLines.push(lines[i]);
      if (lines[i].includes('END LOOP')) break;
    }
  }
  console.log('CASE block in loop:');
  console.log(caseLines.join('\n'));
  
  // Check: is 'aguardando cotacao' without cedilla?
  const hasCotacaoSemCedilla = source?.includes("'aguardando cotacao'");
  const hasCotacaoComCedilla = source?.includes("'aguardando cotação'");
  console.log(`\nContains 'aguardando cotacao' (sem cedilla): ${hasCotacaoSemCedilla}`);
  console.log(`Contains 'aguardando cotação' (com cedilla): ${hasCotacaoComCedilla}`);
  
  // Check the final CASE block (v_furthest_stage)
  const finalCaseIdx = source?.lastIndexOf('CASE');
  if (finalCaseIdx > 0) {
    const finalCase = source?.substring(finalCaseIdx, finalCaseIdx + 1500);
    console.log('\nFinal CASE block:');
    console.log(finalCase);
  }
}
