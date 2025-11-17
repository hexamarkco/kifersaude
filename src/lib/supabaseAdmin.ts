import { createClient } from '@supabase/supabase-js';

type DenoEnv = { get?: (key: string) => string | undefined };

const getEnvValue = (key: string): string | undefined => {
  const denoEnv = (globalThis as { Deno?: { env?: DenoEnv } }).Deno?.env;
  if (typeof denoEnv?.get === 'function') {
    return denoEnv.get(key);
  }

  const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return processEnv?.[key];
};

const supabaseUrl = getEnvValue('SUPABASE_URL');
const supabaseServiceRoleKey = getEnvValue('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL environment variable is not set in Supabase secrets');
}

if (!supabaseServiceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is not set in Supabase secrets');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
