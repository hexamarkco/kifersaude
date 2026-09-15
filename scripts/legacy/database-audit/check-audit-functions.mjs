import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'process.env.SUPABASE_SERVICE_ROLE_KEY');

const { data, error } = await supabase.rpc('audit_exec_sql', { p_sql: 'SELECT 1 as ok' });
if (error) console.error('exec_sql error:', error.message);
else console.log('exec_sql works:', data);

const { data: runs } = await supabase.from('audit_runs').select('*').limit(5);
console.log('Existing runs:', JSON.stringify(runs, null, 2));

// Check function exists
const { data: fn, error: fnErr } = await supabase.rpc('audit_exec_sql', {
  p_sql: "SELECT count(*) as cnt FROM pg_proc WHERE proname = 'audit_run_dry_run'"
});
console.log('audit_run_dry_run exists check:', fn, fnErr?.message);
