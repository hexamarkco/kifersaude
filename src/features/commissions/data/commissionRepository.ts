import { databaseClient } from '../../../infrastructure/supabase';
import type { Contract } from '../../contracts';

export async function listActiveCommissionContracts(): Promise<Contract[]> {
  const { data, error } = await databaseClient
    .from('contracts')
    .select('*')
    .order('previsao_recebimento_comissao', { ascending: true })
    .overrideTypes<Contract[], { merge: false }>();
  if (error) throw error;
  return (data ?? []).filter((contract) => contract.status === 'Ativo');
}
