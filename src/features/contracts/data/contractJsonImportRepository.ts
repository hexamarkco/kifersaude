import { databaseClient } from '../../../infrastructure/supabase';
import type { ContractJsonBulkImportPayload } from '../domain/contractJsonImport';
import type { ContractPersistenceInput } from './contractFormRepository';
import { isAdesaoContract } from '../../../lib/contractSignupFee';

const asText = (
  contract: ContractJsonBulkImportPayload['contracts'][number],
  key: keyof ContractJsonBulkImportPayload['contracts'][number],
) => {
  const value = contract[key];
  return value === undefined ? null : String(value).trim() || null;
};

const asNumber = (
  contract: ContractJsonBulkImportPayload['contracts'][number],
  key: keyof ContractJsonBulkImportPayload['contracts'][number],
) => {
  const value = contract[key];
  return typeof value === 'number' ? value : null;
};

function buildContractInsert(
  contract: ContractJsonBulkImportPayload['contracts'][number],
): ContractPersistenceInput {
  const mensalidade = asNumber(contract, 'mensalidade_total');
  const commissionMultiplier = asNumber(contract, 'comissao_multiplicador') ?? 2.8;
  const signupFeeType = isAdesaoContract(asText(contract, 'modalidade'))
    ? asText(contract, 'taxa_adesao_tipo') ?? 'nao_cobrar'
    : 'nao_cobrar';

  return {
    codigo_contrato: asText(contract, 'codigo_contrato') ?? '',
    lead_id: null,
    status: asText(contract, 'status') ?? 'Rascunho',
    modalidade: asText(contract, 'modalidade') ?? '',
    operadora: asText(contract, 'operadora') ?? '',
    produto_plano: asText(contract, 'produto_plano') ?? '',
    abrangencia: asText(contract, 'abrangencia'),
    acomodacao: asText(contract, 'acomodacao'),
    data_inicio: asText(contract, 'data_inicio'),
    data_renovacao: contract.data_renovacao === undefined
      ? null
      : `${contract.data_renovacao}-01`,
    mes_reajuste: asNumber(contract, 'mes_reajuste'),
    carencia: asText(contract, 'carencia'),
    mensalidade_total: mensalidade,
    comissao_prevista: asNumber(contract, 'comissao_prevista') ?? (
      mensalidade && mensalidade > 0
        ? Math.round(mensalidade * commissionMultiplier * 100) / 100
        : null
    ),
    comissao_multiplicador: commissionMultiplier,
    taxa_adesao_tipo: signupFeeType,
    taxa_adesao_percentual: signupFeeType === 'percentual_mensalidade'
      ? asNumber(contract, 'taxa_adesao_percentual') ?? 100
      : null,
    taxa_adesao_valor: signupFeeType === 'valor_fixo'
      ? asNumber(contract, 'taxa_adesao_valor')
      : null,
    comissao_recebimento_adiantado: true,
    comissao_parcelas: [],
    previsao_recebimento_comissao: asText(contract, 'previsao_recebimento_comissao'),
    previsao_pagamento_bonificacao: asText(contract, 'previsao_pagamento_bonificacao'),
    vidas: asNumber(contract, 'vidas') ?? 1,
    vidas_elegiveis_bonus: null,
    bonus_por_vida_configuracoes: [],
    bonus_por_vida_valor: null,
    bonus_por_vida_aplicado: false,
    responsavel: asText(contract, 'responsavel') ?? '',
    observacoes_internas: asText(contract, 'observacoes_internas'),
    cnpj: asText(contract, 'cnpj'),
    razao_social: asText(contract, 'razao_social'),
    nome_fantasia: asText(contract, 'nome_fantasia'),
    endereco_empresa: asText(contract, 'endereco_empresa'),
  };
}

export async function createContractRecordsBulk(
  contracts: ContractJsonBulkImportPayload['contracts'],
): Promise<void> {
  if (contracts.length === 0) throw new Error('Não há contratos para importar.');

  const { error } = await databaseClient
    .from('contracts')
    .insert(contracts.map(buildContractInsert));
  if (error?.code === '23505') {
    throw new Error('Um dos códigos de contrato já está cadastrado. Nenhum contrato do lote foi incluído.');
  }
  if (error) throw error;
}
