import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Lead = {
  id: string;
  nome_completo: string;
  telefone: string;
  email?: string;
  cidade?: string;
  regiao?: string;
  origem: string;
  tipo_contratacao: string;
  operadora_atual?: string;
  status: string;
  responsavel: string;
  data_criacao: string;
  ultimo_contato?: string;
  proximo_retorno?: string;
  observacoes?: string;
  arquivado: boolean;
  created_at: string;
  updated_at: string;
};

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
  carencia?: string;
  mensalidade_total?: number;
  comissao_prevista?: number;
  comissao_multiplicador?: number;
  previsao_recebimento_comissao?: string;
  responsavel: string;
  observacoes_internas?: string;
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
  created_at: string;
  updated_at: string;
};

export type Dependent = {
  id: string;
  contract_id: string;
  nome_completo: string;
  cpf?: string;
  data_nascimento: string;
  relacao: string;
  elegibilidade?: string;
  valor_individual?: number;
  carencia_individual?: string;
  created_at: string;
  updated_at: string;
};

export type Interaction = {
  id: string;
  lead_id?: string;
  contract_id?: string;
  tipo: string;
  descricao: string;
  responsavel: string;
  data_interacao: string;
  created_at: string;
};

export type Reminder = {
  id: string;
  contract_id?: string;
  lead_id?: string;
  tipo: string;
  titulo: string;
  descricao?: string;
  data_lembrete: string;
  lido: boolean;
  prioridade: string;
  tags?: string[];
  recorrencia?: string;
  recorrencia_config?: any;
  tempo_estimado_minutos?: number;
  anexos?: any[];
  concluido_em?: string;
  snooze_count?: number;
  ultima_modificacao?: string;
  created_at: string;
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

export type LeadStatusHistory = {
  id: string;
  lead_id: string;
  status_anterior: string;
  status_novo: string;
  responsavel: string;
  observacao?: string;
  created_at: string;
};
