import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

type EnvironmentReader = (key: string) => string | undefined;

const readDenoEnvironment: EnvironmentReader = (key) => {
  const denoGlobal = (globalThis as {
    Deno?: { env?: { get?: EnvironmentReader } };
  }).Deno;
  return denoGlobal?.env?.get?.(key);
};

export const createSupabaseAdminClient = (
  readEnvironment: EnvironmentReader = readDenoEnvironment,
) => {
  const supabaseUrl = readEnvironment('SUPABASE_URL');
  const serviceRoleKey = readEnvironment('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Credenciais do Supabase nao configuradas.');
  }

  return createClient(supabaseUrl, serviceRoleKey);
};
