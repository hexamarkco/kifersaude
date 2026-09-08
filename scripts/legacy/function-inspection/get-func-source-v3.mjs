import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8');

// Create a function that returns the source via a temp table
const sql = `
CREATE OR REPLACE FUNCTION public.audit_get_source(p_name text)
RETURNS TABLE(line text)
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_def text;
  v_arr text[];
  v_i integer;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE p.proname = p_name AND n.nspname = 'public';
  
  IF v_def IS NULL THEN
    line := 'FUNCTION NOT FOUND';
    RETURN NEXT;
    RETURN;
  END IF;
  
  v_arr := string_to_array(v_def, E'\\n');
  FOR v_i IN 1 .. array_length(v_arr, 1) LOOP
    line := v_arr[v_i];
    RETURN NEXT;
  END LOOP;
END;
$fn$;`;

await supabase.rpc('audit_exec_sql', { p_sql: sql });

const { data: lines, error } = await supabase.rpc('audit_get_source', { p_name: 'audit_classify_single_lead' });
if (error) {
  console.error('Error:', error.message);
} else {
  const fullSource = lines?.map(l => l.line).join('\n') || '';
  
  // Find the CASE block in the LOOP
  const caseStart = fullSource.indexOf('CASE v_hist.sn');
  const caseEnd = fullSource.indexOf('END CASE', caseStart);
  if (caseStart > 0 && caseEnd > 0) {
    console.log('=== CASE BLOCK IN LOOP ===');
    console.log(fullSource.substring(caseStart, caseEnd + 10));
  }
  
  // Find the final CASE block
  const finalCaseStart = fullSource.lastIndexOf('CASE');
  const finalCaseEnd = fullSource.indexOf('END CASE', finalCaseStart);
  if (finalCaseStart > 0 && finalCaseEnd > 0) {
    console.log('\n=== FINAL CASE BLOCK ===');
    console.log(fullSource.substring(finalCaseStart, finalCaseEnd + 10));
  }
  
  // Check: does it have 'em atendimento'?
  console.log('\n=== KEY CHECKS ===');
  console.log("Contains 'em atendimento':", fullSource.includes("'em atendimento'"));
  console.log("Contains 'em analise':", fullSource.includes("'em analise'"));
  console.log("Contains 'aguardando cotacao':", fullSource.includes("'aguardando cotacao'"));
  console.log("Contains 'aguardando cotação':", fullSource.includes("'aguardando cotação'"));
  console.log("Contains 'proposta enviada':", fullSource.includes("'proposta enviada'"));
  console.log("Contains 'negociacao':", fullSource.includes("'negociacao'"));
  console.log("Contains 'decisao':", fullSource.includes("'decisao'"));
  console.log("Contains 'decisão':", fullSource.includes("'decisão'"));
  console.log("Contains 'contratacao':", fullSource.includes("'contratacao'"));
  console.log("Contains 'contratação':", fullSource.includes("'contratação'"));
  
  // Total lines
  console.log('\nTotal source lines:', lines?.length);
}
