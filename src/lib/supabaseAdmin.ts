import { createClient } from '@supabase/supabase-js';

const globalProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
const supabaseUrl = globalProcess?.env?.SUPABASE_URL;
const supabaseServiceRoleKey = globalProcess?.env?.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL environment variable is not set');
}

if (!supabaseServiceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
