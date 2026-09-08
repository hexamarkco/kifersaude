import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8');

const runId = '649ebd94-2d48-452a-815f-d10ad32ba16d';

// Get unique error messages
const { data: errors } = await supabase
  .from('audit_results')
  .select('reason_text, lead_id')
  .eq('run_id', runId)
  .eq('reason_code', 'ERRO_CLASSIFICACAO')
  .limit(20);

console.log('Unique error messages:');
const msgs = {};
for (const e of errors || []) {
  const msg = e.reason_text?.replace('Erro na classificacao: ', '') || 'unknown';
  if (!msgs[msg]) msgs[msg] = { count: 0, sampleLead: e.lead_id };
  msgs[msg].count++;
}
for (const [msg, info] of Object.entries(msgs).sort((a,b) => b[1].count - a[1].count)) {
  console.log(`  [${info.count}x] ${msg} (sample: ${info.sampleLead})`);
}

// Try classifying one of the failing leads manually
if (errors?.length) {
  const sampleLeadId = errors[0].lead_id;
  console.log(`\nTesting classify on lead ${sampleLeadId}...`);
  const { data: perdidoId } = await supabase.rpc('audit_exec_sql', {
    p_sql: "SELECT id::text FROM public.lead_status_config WHERE nome = 'Perdido' LIMIT 1"
  });
  // Use direct query instead
  const { data: statusRow } = await supabase.from('lead_status_config').select('id').eq('nome', 'Perdido').single();
  const { data: reatId } = await supabase.from('lead_status_config').select('id').eq('nome', 'Reativação').single();

  if (statusRow && reatId) {
    const { data: result, error } = await supabase.rpc('audit_classify_single_lead', {
      p_lead_id: sampleLeadId,
      p_perdido_id: statusRow.id,
      p_reativacao_id: reatId.id
    });
    if (error) console.error('Classify error:', error.message, error.details, error.hint);
    else console.log('Result:', JSON.stringify(result, null, 2));
  }
}
