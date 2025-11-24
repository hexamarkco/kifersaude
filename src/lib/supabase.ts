import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function getUserManagementId(user: Pick<User, 'id' | 'user_metadata' | 'app_metadata'> | null | undefined): string | null {
  if (!user) {
    return null;
  }

  const candidates = [
    user.user_metadata?.user_management_id,
    user.user_metadata?.user_management_user_id,
    user.user_metadata?.user_id,
    user.app_metadata?.user_management_id,
    user.app_metadata?.user_id,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  }

  return user.id ?? null;
}

export type Lead = {
  id: string;
  nome_completo: string;
  telefone: string;
  email?: string;
  cidade?: string;
  regiao?: string;
  estado?: string;
  origem: string;
  tipo_contratacao: string;
  operadora_atual?: string;
  status: string;
  responsavel: string;
  data_criacao: string;
  ultimo_contato?: string;
  proximo_retorno?: string;
  tags?: string[];
  canal?: string | null;
  observacoes?: string;
  arquivado: boolean;
  created_at: string;
  updated_at: string;
  push_notified_at?: string | null;
};

export type QuickReply = {
  id: string;
  title: string | null;
  text: string;
  created_at: string | null;
  updated_at: string | null;
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
  mes_reajuste?: number | null;
  carencia?: string;
  mensalidade_total?: number;
  comissao_prevista?: number;
  comissao_multiplicador?: number;
  comissao_recebimento_adiantado?: boolean;
  comissao_parcelas?: { percentual: number; data_pagamento: string | null }[] | null;
  previsao_recebimento_comissao?: string;
  previsao_pagamento_bonificacao?: string;
  vidas?: number;
  bonus_por_vida_valor?: number;
  bonus_por_vida_aplicado?: boolean;
  bonus_limite_mensal?: number | null;
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
  responsavel?: string;
  tags?: string[];
  recorrencia?: string;
  recorrencia_config?: any;
  tempo_estimado_minutos?: number;
  anexos?: any[];
  concluido_em?: string;
  snooze_count?: number;
  ultima_modificacao?: string;
  whatsapp_schedule_id?: string;
  created_at: string;
  push_notified_at?: string | null;
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

export type UserProfile = {
  id: string;
  email: string;
  username: string;
  role: 'admin' | 'observer';
  created_at: string;
  created_by?: string;
};

export type SystemSettings = {
  id: string;
  company_name: string;
  notification_sound_enabled: boolean;
  notification_volume: number;
  notification_interval_seconds: number;
  session_timeout_minutes: number;
  date_format: string;
  created_at: string;
  updated_at: string;
};

export type IntegrationSetting = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  settings: Record<string, any> | null;
  created_at: string;
  updated_at: string;
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

export type LeadStatusConfig = {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
  ativo: boolean;
  padrao: boolean;
  created_at: string;
  updated_at: string;
};

export type LeadOrigem = {
  id: string;
  nome: string;
  ativo: boolean;
  visivel_para_observadores: boolean;
  created_at: string;
};

export type ConfigOption = {
  id: string;
  category: string;
  label: string;
  value: string;
  description?: string | null;
  ordem: number;
  ativo: boolean;
  active?: boolean;
  metadata?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
};

export type ProfilePermission = {
  id: string;
  role: string;
  module: string;
  can_view: boolean;
  can_edit: boolean;
  created_at: string;
  updated_at: string;
};
