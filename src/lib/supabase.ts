import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabaseFunctionsUrl =
  import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || `${supabaseUrl}/functions/v1`;

const SUPABASE_NETWORK_HELP =
  'Falha de rede ao conectar com o Supabase. Se o navegador mostrar erros de CORS ao mesmo tempo em auth, rest e rpc, o problema tende a ser bloqueio local de navegador/extensao/proxy ou indisponibilidade temporaria da rede, nao ausencia de CORS no codigo do app.';

const DEFAULT_SUPABASE_REQUEST_TIMEOUT_MS = 15000;
const AUTH_SUPABASE_REQUEST_TIMEOUT_MS = 30000;

const isSupabaseRequestUrl = (value: string): boolean =>
  value.startsWith(supabaseUrl) || value.startsWith(supabaseFunctionsUrl);

const getSupabaseRequestTimeoutMs = (requestUrl: string): number => {
  if (requestUrl.includes('/auth/v1/')) {
    return AUTH_SUPABASE_REQUEST_TIMEOUT_MS;
  }

  return DEFAULT_SUPABASE_REQUEST_TIMEOUT_MS;
};

const resolveRequestUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
};

const supabaseFetch: typeof fetch = async (input, init) => {
  const requestUrl = resolveRequestUrl(input);
  const timeoutMs = isSupabaseRequestUrl(requestUrl)
    ? getSupabaseRequestTimeoutMs(requestUrl)
    : DEFAULT_SUPABASE_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort(new DOMException(`Tempo limite de ${timeoutMs}ms excedido`, 'AbortError'));
  }, timeoutMs);
  const externalSignal = init?.signal;
  const abortFromExternalSignal = () => {
    controller.abort(externalSignal?.reason);
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      abortFromExternalSignal();
    } else {
      externalSignal.addEventListener('abort', abortFromExternalSignal, { once: true });
    }
  }

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted && !externalSignal?.aborted && isSupabaseRequestUrl(requestUrl)) {
      throw new Error(`${SUPABASE_NETWORK_HELP} Endpoint: ${requestUrl}. Tempo limite atingido apos ${timeoutMs / 1000}s.`);
    }

    if (isSupabaseRequestUrl(requestUrl)) {
      const message = error instanceof Error && error.message.trim()
        ? error.message.trim()
        : 'Erro de rede desconhecido';
      throw new Error(`${SUPABASE_NETWORK_HELP} Endpoint: ${requestUrl}. Erro original: ${message}`);
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', abortFromExternalSignal);
  }
};

const supabaseClientOptions = {
  global: {
    fetch: supabaseFetch,
  },
  functions: {
    url: supabaseFunctionsUrl,
  },
} as unknown as Parameters<typeof createClient>[2];

export const supabase = createClient(supabaseUrl, supabaseAnonKey, supabaseClientOptions);

export const isSupabaseConnectivityError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes('falha de rede ao conectar com o supabase');
};

export const getSupabaseErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (isSupabaseConnectivityError(error)) {
    return (error as Error).message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '').trim();

    if (message) {
      return message;
    }
  }

  return fallbackMessage;
};

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

export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
  pageSize: number = 1000,
): Promise<T[]> {
  const allData: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    const page = data ?? [];
    allData.push(...page);

    if (page.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return allData;
}

export type Lead = {
  id: string;
  nome_completo: string;
  telefone: string;
  email?: string;
  cep?: string;
  endereco?: string;
  cidade?: string;
  regiao?: string;
  estado?: string;
  origem?: string | null;
  origem_id?: string | null;
  tipo_contratacao?: string | null;
  tipo_contratacao_id?: string | null;
  operadora_atual?: string;
  status?: string | null;
  status_id?: string | null;
  responsavel?: string | null;
  responsavel_id?: string | null;
  data_criacao: string;
  ultimo_contato?: string | null;
  proximo_retorno?: string | null;
  tags?: string[];
  canal?: string | null;
  observacoes?: string;
  blackout_dates?: string[] | null;
  daily_send_limit?: number | null;
  skip_automation?: boolean | null;
  arquivado: boolean;
  created_at: string;
  updated_at: string;
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
  recorrencia_config?: unknown;
  tempo_estimado_minutos?: number;
  anexos?: unknown[];
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
  username: string;
  role: string;
  created_at: string;
  created_by?: string;
};

export type AccessProfile = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  is_system: boolean;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
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

export type SystemSettings = {
  id: string;
  company_name: string;
  notification_sound_enabled: boolean;
  notification_volume: number;
  notification_interval_seconds: number;
  session_timeout_minutes: number;
  date_format: string;
  timezone: string;
  created_at: string;
  updated_at: string;
};

export type IntegrationSetting = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  settings: Record<string, unknown> | null;
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
  metadata?: Record<string, unknown> | null;
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

export type CommWhatsAppChannel = {
  id: string;
  slug: string;
  name: string;
  enabled: boolean;
  whapi_channel_id?: string | null;
  connection_status: string;
  health_status: string;
  phone_number?: string | null;
  connected_user_name?: string | null;
  last_health_check_at?: string | null;
  last_webhook_received_at?: string | null;
  last_error?: string | null;
  health_snapshot?: Record<string, unknown> | null;
  limits_snapshot?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type CommWhatsAppChat = {
  id: string;
  channel_id: string;
  external_chat_id: string;
  phone_number: string;
  phone_digits: string;
  display_name: string;
  saved_contact_name?: string | null;
  push_name?: string | null;
  lead_id?: string | null;
  lead_status?: string | null;
  is_archived: boolean;
  archived_at?: string | null;
  is_muted: boolean;
  muted_at?: string | null;
  last_message_text?: string | null;
  last_message_direction: 'inbound' | 'outbound' | 'system';
  last_message_at?: string | null;
  unread_count: number;
  status: 'open' | 'pending' | 'closed';
  last_read_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type CommWhatsAppPhoneContact = {
  id: string;
  channel_id: string;
  contact_id: string;
  phone_number: string;
  phone_digits: string;
  display_name: string;
  short_name?: string | null;
  saved: boolean;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
};

export type CommWhatsAppMessage = {
  id: string;
  chat_id: string;
  channel_id: string;
  external_message_id?: string | null;
  direction: 'inbound' | 'outbound' | 'system';
  message_type: string;
  delivery_status: string;
  text_content?: string | null;
  message_at: string;
  created_by?: string | null;
  source?: string | null;
  sender_name?: string | null;
  sender_phone?: string | null;
  status_updated_at?: string | null;
  error_message?: string | null;
  media_id?: string | null;
  media_url?: string | null;
  media_mime_type?: string | null;
  media_file_name?: string | null;
  media_size_bytes?: number | null;
  media_duration_seconds?: number | null;
  media_caption?: string | null;
  transcription_text?: string | null;
  transcription_status?: 'idle' | 'pending' | 'processing' | 'completed' | 'failed' | null;
  transcription_provider?: string | null;
  transcription_model?: string | null;
  transcription_error?: string | null;
  transcription_updated_at?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type WhatsAppChat = {
  id: string;
  name: string | null;
  is_group: boolean;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WhatsAppMessage = {
  id: string;
  chat_id: string;
  from_number: string | null;
  to_number: string | null;
  type: string | null;
  body: string | null;
  has_media: boolean;
  timestamp: string | null;
  direction: 'inbound' | 'outbound' | null;
  payload: Record<string, unknown>;
  transcription_text?: string | null;
  created_at: string;
};

export type WhatsAppWebhookEvent = {
  id: string;
  event: string | null;
  payload: Record<string, unknown>;
  headers: Record<string, unknown> | null;
  created_at: string;
};
