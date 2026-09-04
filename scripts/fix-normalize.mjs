import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8');

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
