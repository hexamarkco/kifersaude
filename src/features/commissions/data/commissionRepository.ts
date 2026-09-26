import { databaseClient } from '../../../infrastructure/supabase';
import type { CommissionContract } from '../domain/types';

const COMMISSION_CONTRACT_SELECT = [
  'id',
  'codigo_contrato',
  'operadora',
  'previsao_recebimento_comissao',
  'comissao_prevista',
  'comissao_recebimento_adiantado',
  'comissao_parcelas',
  'mensalidade_total',
  'previsao_pagamento_bonificacao',
  'bonus_por_vida_aplicado',
  'bonus_por_vida_configuracoes',
  'bonus_por_vida_valor',
  'vidas',
  'vidas_elegiveis_bonus',
].join(', ');

export async function listActiveCommissionContracts(): Promise<CommissionContract[]> {
  const { data, error } = await databaseClient
    .from('contracts')
    .select(COMMISSION_CONTRACT_SELECT)
    .eq('status', 'Ativo')
    .order('previsao_recebimento_comissao', { ascending: true })
    .overrideTypes<CommissionContract[], { merge: false }>();
  if (error) throw error;
  return data ?? [];
}
