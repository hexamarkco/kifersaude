import type { Contract } from './supabase';

export const isAdesaoContract = (modalidade?: string | null) => {
  const normalized = (modalidade || '').toLowerCase();
  return normalized.includes('adesao') || normalized.includes('adesão');
};

export const getContractSignupFeeValue = (
  contract: Pick<Contract, 'mensalidade_total' | 'taxa_adesao_tipo' | 'taxa_adesao_percentual' | 'taxa_adesao_valor'>
) => {
  const tipo = contract.taxa_adesao_tipo || 'nao_cobrar';

  if (tipo === 'valor_fixo') {
    return contract.taxa_adesao_valor || 0;
  }

  if (tipo === 'percentual_mensalidade') {
    const percentual = contract.taxa_adesao_percentual || 0;
    const mensalidade = contract.mensalidade_total || 0;
    return (mensalidade * percentual) / 100;
  }

  return 0;
};
