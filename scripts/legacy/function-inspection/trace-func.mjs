import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8');

const { data: lines } = await supabase.rpc('audit_get_source', { p_name: 'audit_classify_single_lead' });
const fullSource = lines?.map(l => l.line).join('\n') || '';

// Find the critical section: after the loop, before RETURN
const afterLoopIdx = fullSource.indexOf('v_furthest_stage := v_best_stage');
if (afterLoopIdx > 0) {
  console.log('=== AFTER LOOP (200 chars before + 500 after) ===');
  console.log(fullSource.substring(Math.max(0, afterLoopIdx - 200), afterLoopIdx + 500));
}

// Find the final RETURN NEXT section
const returnIdx = fullSource.lastIndexOf('RETURN NEXT');
if (returnIdx > 0) {
  console.log('\n=== FINAL RETURN NEXT ===');
  console.log(fullSource.substring(returnIdx - 200, returnIdx + 300));
}

// Find the CASE that sets classification based on v_furthest_stage
const caseStageIdx = fullSource.indexOf("WHEN v_furthest_stage IN ('Contratacao')");
if (caseStageIdx > 0) {
  console.log('\n=== CLASSIFICATION CASE (v_furthest_stage) ===');
  console.log(fullSource.substring(caseStageIdx, caseStageIdx + 800));
}

// Count RETURN NEXT occurrences
const returnCount = (fullSource.match(/RETURN NEXT/g) || []).length;
console.log('\nRETURN NEXT count:', returnCount);

// Find all RETURN NEXT positions
let pos = 0;
let i = 0;
while ((pos = fullSource.indexOf('RETURN NEXT', pos)) !== -1) {
  i++;
  const lineNum = fullSource.substring(0, pos).split('\n').length;
  console.log(`  RETURN NEXT #${i} at line ${lineNum}`);
  pos += 12;
}
