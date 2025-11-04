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
  vidas?: number;
  bonus_por_vida_valor?: number;
  bonus_por_vida_aplicado?: boolean;
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

export type UserProfile = {
  id: string;
  email: string;
  role: 'admin' | 'observer';
  created_at: string;
  created_by?: string;
};

export type FollowUpCustomRule = {
  id: string;
  lead_id: string;
  status: string;
  days_after: number;
  title: string;
  description: string;
  priority: 'baixa' | 'media' | 'alta';
  active: boolean;
  created_at: string;
  updated_at: string;
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
  created_at: string;
};

export type ConfigOption = {
  id: string;
  category: string;
  label: string;
  value: string;
  description?: string;
  ordem: number;
  ativo: boolean;
  active?: boolean;
  metadata?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
};

export type RoleAccessRule = {
  id: string;
  role: string;
  module: string;
  can_view: boolean;
  can_edit: boolean;
  created_at: string;
  updated_at: string;
};

export type ApiIntegration = {
  id: string;
  zapi_instance_id?: string;
  zapi_token?: string;
  openai_api_key?: string;
  openai_model: string;
  openai_temperature: number;
  openai_max_tokens: number;
  zapi_enabled: boolean;
  openai_enabled: boolean;
  monthly_cost_limit: number;
  created_at: string;
  updated_at: string;
};

export type WhatsAppConversation = {
  id: string;
  lead_id: string;
  contract_id?: string;
  phone_number: string;
  message_id?: string;
  message_text: string;
  message_type: 'sent' | 'received';
  timestamp: string;
  read_status: boolean;
  media_url?: string;
  created_at: string;
};

export type AIGeneratedMessage = {
  id: string;
  reminder_id: string;
  lead_id: string;
  contract_id?: string;
  prompt_used: string;
  message_generated: string;
  message_edited?: string;
  status: 'draft' | 'approved' | 'sent' | 'failed';
  tone: 'professional' | 'friendly' | 'urgent' | 'casual';
  tokens_used: number;
  cost_estimate: number;
  conversation_context?: any;
  generated_by: string;
  approved_by?: string;
  sent_at?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
};
