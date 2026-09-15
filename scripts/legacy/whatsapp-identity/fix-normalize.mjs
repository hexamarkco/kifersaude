import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'process.env.SUPABASE_SERVICE_ROLE_KEY');

const sql = `CREATE OR REPLACE FUNCTION public.audit_normalize_text(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(lower(COALESCE(p_text, '')))
$$;`;

const { error } = await supabase.rpc('audit_exec_sql', { p_sql: sql });
if (error) { console.error('Error:', error.message); process.exit(1); }
console.log('Fixed normalize function');

// Test
const { data: norm } = await supabase.rpc('audit_normalize_text', { p_text: 'Perdido' });
console.log('normalize("Perdido"):', norm);

const { data: norm2 } = await supabase.rpc('audit_normalize_text', { p_text: 'Reativação' });
console.log('normalize("Reativação"):', norm2);
