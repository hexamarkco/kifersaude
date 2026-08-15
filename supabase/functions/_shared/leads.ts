import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

/**
 * Verifica duplicidade de lead por telefone e/ou e-mail.
 *
 * Cada condição roda como uma query parametrizada própria (.eq/.ilike) em vez de
 * ser interpolada numa única string de filtro .or(), que é vulnerável a injeção de
 * sintaxe de filtro PostgREST (ex.: "," ou ")" dentro do e-mail alterando a query).
 */
export async function isDuplicateLead(
  supabase: SupabaseClient,
  telefone: string,
  email?: string | null,
): Promise<boolean> {
  const checks: Promise<{ data: { id: string }[] | null; error: unknown }>[] = [];

  if (telefone) {
    checks.push(supabase.from('leads').select('id').eq('telefone', telefone).limit(1));
  }
  if (email) {
    checks.push(supabase.from('leads').select('id').ilike('email', email.toLowerCase()).limit(1));
  }

  if (checks.length === 0) return false;

  const results = await Promise.all(checks);

  for (const { data, error } of results) {
    if (error) {
      console.error('Erro ao verificar duplicidade de lead', error);
      continue;
    }
    if ((data?.length ?? 0) > 0) return true;
  }

  return false;
}
