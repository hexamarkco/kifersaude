export type Contract = {
  id: string;
  codigo_contrato: string;
  lead_id?: string;
  status: string;
  modalidade: string;
  operadora: string;
  produto_plano: string;
  abrangencia?: string;
  acomodacao?: string;
  data_inicio?: string;
  data_renovacao?: string;
  mes_reajuste?: number | null;
  carencia?: string;
  mensalidade_total?: number;
  comissao_prevista?: number;
  comissao_multiplicador?: number;
  taxa_adesao_tipo?: 'nao_cobrar' | 'percentual_mensalidade' | 'valor_fixo' | null;
  taxa_adesao_percentual?: number | null;
  taxa_adesao_valor?: number | null;
  comissao_recebimento_adiantado?: boolean;
  comissao_parcelas?: ContractCommissionInstallment[] | null;
  previsao_recebimento_comissao?: string;
  previsao_pagamento_bonificacao?: string;
  vidas?: number;
  vidas_elegiveis_bonus?: number | null;
  bonus_por_vida_configuracoes?: ContractBonusConfiguration[] | null;
  bonus_por_vida_valor?: number;
  bonus_por_vida_aplicado?: boolean;
  responsavel: string;
  observacoes_internas?: string;
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  endereco_empresa?: string;
  created_at: string;
  updated_at: string;
};

export type ContractHolder = {
  id: string;
  contract_id: string;
  nome_completo: string;
  cpf: string;
  rg?: string;
  data_nascimento: string;
  sexo?: string;
  estado_civil?: string;
  telefone: string;
  email?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cns?: string;
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  percentual_societario?: number;
  data_abertura_cnpj?: string;
  bonus_por_vida_aplicado?: boolean | null;
  created_at: string;
  updated_at: string;
};

export type Dependent = {
  id: string;
  contract_id: string;
  holder_id: string;
  nome_completo: string;
  cpf?: string;
  data_nascimento: string;
  relacao: string;
  elegibilidade?: string;
  valor_individual?: number;
  carencia_individual?: string;
  bonus_por_vida_aplicado?: boolean | null;
  created_at: string;
  updated_at: string;
};

export type ContractValueAdjustment = {
  id: string;
  contract_id: string;
  tipo: 'desconto' | 'acrescimo';
  valor: number;
  motivo: string;
  created_by: string;
  created_at: string;
};

export type ContractBonusConfiguration = {
  id: string;
  quantidade: number;
  valor: number;
};

export type ContractCommissionInstallment = {
  percentual?: number;
  valor?: number;
  data_pagamento: string | null;
};

export type Operadora = {
  id: string;
  nome: string;
  comissao_padrao: number;
  prazo_recebimento_dias: number;
  bonus_por_vida: boolean;
  bonus_padrao: number;
  ativo: boolean;
  observacoes?: string;
  created_at: string;
  updated_at: string;
};

export type ProdutoPlano = {
  id: string;
  operadora_id: string;
  nome: string;
  modalidade?: string;
  abrangencia?: string;
  acomodacao?: string;
  comissao_sugerida?: number;
  bonus_por_vida_valor?: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

