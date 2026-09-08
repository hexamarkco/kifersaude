import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://eaxvvhamkmovkoqssahj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8');

const { data: lines } = await supabase.rpc('audit_get_source', { p_name: 'audit_classify_single_lead' });
const fullSource = lines?.map(l => l.line).join('\n') || '';

// Print lines 350-461 (the final section)
const sourceLines = fullSource.split('\n');
console.log('=== LINES 340-461 ===');
for (let i = 339; i < Math.min(sourceLines.length, 461); i++) {
  console.log(`${i+1}: ${sourceLines[i]}`);
}
