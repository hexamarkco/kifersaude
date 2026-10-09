import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import type { McpToolDescriptor } from './mcp-discovery.ts';
import { resolveCommWhatsAppCampaignMessage } from '../_shared/comm-whatsapp-campaign-template.ts';

type JsonRecord = Record<string, unknown>;
type CampaignWriteResult = JsonRecord;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_ID = /^[A-Za-z0-9:_-]{1,128}$/;
const CAMPAIGN_SELECT = [
  'id', 'name', 'objective', 'status', 'audience_source', 'audience_config',
  'message_text', 'scheduled_at', 'pacing_per_minute', 'daily_send_limit',
  'send_window_start', 'send_window_end', 'active_weekdays', 'stop_on_reply',
  'create_leads_from_csv', 'validate_whatsapp_numbers', 'total_targets',
  'valid_targets', 'invalid_targets', 'pending_targets', 'sent_targets',
  'failed_targets', 'responded_targets', 'stopped_targets', 'last_error',
  'ab_test_enabled', 'ab_split_percent', 'recurrence_rule',
  'recurrence_interval', 'recurrence_end_at', 'recurrence_next_run_at',
  'recurrence_runs_completed', 'created_at', 'updated_at',
].join(',');
const CAMPAIGN_STEP_SELECT = [
  'id', 'campaign_id', 'step_index', 'stage_index', 'step_kind',
  'status_to_set', 'message_text', 'delay_amount', 'delay_unit', 'media_url',
  'media_type', 'media_filename', 'variant_label', 'created_at', 'updated_at',
].join(',');
const CAMPAIGN_CONTACT_SELECT = [
  'id', 'campaign_id', 'phone_number', 'phone_digits', 'display_name',
  'source_kind', 'source_payload', 'status', 'current_step_index',
  'next_send_at', 'attempts', 'retry_count', 'last_attempt_at', 'sent_at',
  'responded_at', 'stopped_at', 'stopped_reason', 'error_message',
  'external_message_id', 'whatsapp_check_status', 'whatsapp_checked_at',
  'created_at', 'updated_at',
].join(',');

export const MCP_WHATSAPP_CAMPAIGN_READ_TOOL_NAMES = [
  'kifer_list_whatsapp_campaigns',
  'kifer_get_whatsapp_campaign',
  'kifer_preview_whatsapp_campaign',
  'kifer_list_whatsapp_campaign_contacts',
  'kifer_get_whatsapp_campaign_contact',
  'kifer_get_whatsapp_campaign_metrics',
] as const;

export const MCP_WHATSAPP_CAMPAIGN_WRITE_TOOL_NAMES = [
  'kifer_create_whatsapp_campaign',
  'kifer_update_whatsapp_campaign',
  'kifer_import_whatsapp_campaign_contacts',
  'kifer_remove_whatsapp_campaign_contact',
  'kifer_activate_whatsapp_campaign',
  'kifer_pause_whatsapp_campaign',
  'kifer_resume_whatsapp_campaign',
  'kifer_schedule_whatsapp_campaign',
  'kifer_delete_whatsapp_campaign',
] as const;

const CAMPAIGN_STEP_SCHEMA = {
  type: 'object',
  required: ['message'],
  additionalProperties: false,
  properties: {
    message: { type: 'string', minLength: 1, maxLength: 4096, description: 'Texto literal; variáveis oficiais são renderizadas pelo worker.' },
    delay_amount: { type: 'integer', minimum: 0, maximum: 31622400, default: 0 },
    delay_unit: { type: 'string', enum: ['seconds', 'minutes', 'hours', 'days'], default: 'minutes' },
  },
};

const CAMPAIGN_COMMON_PROPERTIES = {
  objective: { type: 'string', maxLength: 500 },
  scheduled_at: { type: 'string', format: 'date-time' },
  pacing_per_minute: { type: 'integer', minimum: 1, maximum: 120, default: 12 },
  daily_send_limit: { type: ['integer', 'null'], minimum: 1 },
  start_hour: { type: 'string', pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' },
  end_hour: { type: 'string', pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' },
  allowed_weekdays: { type: 'array', minItems: 1, maxItems: 7, items: { type: 'integer', minimum: 0, maximum: 6 } },
  stop_on_reply: { type: 'boolean', default: true },
  validate_whatsapp_numbers: { type: 'boolean', default: false },
  steps: { type: 'array', minItems: 1, maxItems: 30, items: CAMPAIGN_STEP_SCHEMA },
  audience_config: { type: 'object', additionalProperties: true },
};

export const MCP_WHATSAPP_CAMPAIGN_TOOLS: McpToolDescriptor[] = [
  {
    name: 'kifer_list_whatsapp_campaigns',
    description: 'Lista campanhas reais do módulo Disparos WhatsApp (/painel/disparos), com filtros, paginação e métricas persistidas. Não lista nem altera fluxos de follow-up.',
    inputSchema: { type: 'object', additionalProperties: false, properties: { status: { type: 'string', enum: ['draft', 'scheduled', 'queued', 'running', 'paused', 'completed', 'cancelled'] }, name: { type: 'string', maxLength: 160 }, date_from: { type: 'string', format: 'date-time' }, date_to: { type: 'string', format: 'date-time' }, data_inicial: { type: 'string', format: 'date-time', description: 'Alias compatível com as consultas administrativas do CRM.' }, data_final: { type: 'string', format: 'date-time', description: 'Alias compatível com as consultas administrativas do CRM.' }, page: { type: 'integer', minimum: 1, default: 1 }, page_size: { type: 'integer', minimum: 1, maximum: 50, default: 20 }, order_by: { type: 'string', enum: ['created_at', 'updated_at', 'scheduled_at', 'name', 'status'], default: 'created_at' }, ascending: { type: 'boolean', default: false } } },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'kifer_get_whatsapp_campaign',
    description: 'Consulta uma campanha real do Disparos WhatsApp, sua configuração segura, etapas e resumo. Segredos não são retornados.',
    inputSchema: { type: 'object', required: ['campaign_id'], additionalProperties: false, properties: { campaign_id: { type: 'string', format: 'uuid' } } },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'kifer_preview_whatsapp_campaign',
    description: 'Renderiza exemplos de uma campanha sem enviar mensagens. Usa a mesma interpolação determinística do worker; sem nome, não inventa um nome nem produz saudações como "Oi, !".',
    inputSchema: { type: 'object', required: ['campaign_id'], additionalProperties: false, properties: { campaign_id: { type: 'string', format: 'uuid' }, samples: { type: 'array', maxItems: 5, items: { type: 'object', additionalProperties: false, properties: { name: { type: 'string', maxLength: 160 }, phone: { type: 'string', maxLength: 160 }, status: { type: 'string', maxLength: 160 }, responsavel: { type: 'string', maxLength: 160 } } } } } },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'kifer_list_whatsapp_campaign_contacts',
    description: 'Lista os contatos materializados de uma campanha real, com status, progresso, bloqueio de WhatsApp e paginação. Telefones são mascarados por padrão.',
    inputSchema: { type: 'object', required: ['campaign_id'], additionalProperties: false, properties: { campaign_id: { type: 'string', format: 'uuid' }, status: { type: 'string', enum: ['pending', 'scheduled', 'sending', 'sent', 'responded', 'stopped', 'failed', 'invalid', 'cancelled'] }, search: { type: 'string', maxLength: 160 }, page: { type: 'integer', minimum: 1, default: 1 }, page_size: { type: 'integer', minimum: 1, maximum: 50, default: 20 }, order_by: { type: 'string', enum: ['created_at', 'updated_at', 'next_send_at', 'status'], default: 'created_at' }, ascending: { type: 'boolean', default: false } } },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'kifer_get_whatsapp_campaign_contact',
    description: 'Consulta um contato materializado de campanha sem expor o telefone completo.',
    inputSchema: { type: 'object', required: ['campaign_id', 'target_id'], additionalProperties: false, properties: { campaign_id: { type: 'string', format: 'uuid' }, target_id: { type: 'string', format: 'uuid' } } },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'kifer_get_whatsapp_campaign_metrics',
    description: 'Retorna métricas da campanha usando os mesmos contadores e estados do Disparos WhatsApp, incluindo distribuição de alvos e motivos de falha.',
    inputSchema: { type: 'object', required: ['campaign_id'], additionalProperties: false, properties: { campaign_id: { type: 'string', format: 'uuid' } } },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'kifer_create_whatsapp_campaign',
    description: 'Cria uma campanha real no Disparos WhatsApp. Começa em draft (ou paused explicitamente), nunca envia e não cria leads; use a ferramenta de importação e depois ativação explícita.',
    inputSchema: { type: 'object', required: ['name', 'message', 'client_request_id'], additionalProperties: false, properties: { name: { type: 'string', minLength: 1, maxLength: 160 }, message: { type: 'string', minLength: 1, maxLength: 4096, description: 'Texto da primeira mensagem. Variáveis oficiais: {{nome}}, {{primeiro_nome}}, {{telefone}}, {{status}}, {{responsavel}}, {{saudacao}}, {{saudacao_titulo}}, {{saudacao_capitalizada}}.' }, status: { type: 'string', enum: ['draft', 'paused'], default: 'draft' }, client_request_id: { type: 'string', minLength: 1, maxLength: 128 }, ...CAMPAIGN_COMMON_PROPERTIES } },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'kifer_update_whatsapp_campaign',
    description: 'Atualiza somente uma campanha ainda editável, usando expected_updated_at para evitar sobrescrever alterações da UI. A validação e as etapas seguem o contrato do Disparos WhatsApp.',
    inputSchema: { type: 'object', required: ['campaign_id', 'expected_updated_at', 'client_request_id'], additionalProperties: false, properties: { campaign_id: { type: 'string', format: 'uuid' }, expected_updated_at: { type: 'string', format: 'date-time' }, client_request_id: { type: 'string', minLength: 1, maxLength: 128 }, name: { type: 'string', minLength: 1, maxLength: 160 }, message: { type: 'string', minLength: 1, maxLength: 4096 }, ...CAMPAIGN_COMMON_PROPERTIES } },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  },
  {
    name: 'kifer_import_whatsapp_campaign_contacts',
    description: 'Importa contatos externos em lote para uma campanha real. Aceita contacts[] para chamadas MCP; não exige que contatos virem leads, normaliza telefones, deduplica por campanha, informa inserted/duplicate/invalid_phone/blocked/failed e nunca envia.',
    inputSchema: { type: 'object', required: ['campaign_id', 'contacts', 'client_request_id'], additionalProperties: false, properties: { campaign_id: { type: 'string', format: 'uuid' }, client_request_id: { type: 'string', minLength: 1, maxLength: 128 }, contacts: { type: 'array', minItems: 1, maxItems: 500, items: { type: 'object', required: ['phone'], additionalProperties: false, properties: { phone: { type: 'string', minLength: 1, maxLength: 160 }, name: { type: 'string', maxLength: 160 }, custom_fields: { type: 'object', additionalProperties: true } } } } } },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'kifer_remove_whatsapp_campaign_contact',
    description: 'Remove logicamente um contato de campanha que ainda não foi processado. Preserva o histórico e não exclui dados.',
    inputSchema: { type: 'object', required: ['campaign_id', 'target_id', 'expected_updated_at', 'client_request_id'], additionalProperties: false, properties: { campaign_id: { type: 'string', format: 'uuid' }, target_id: { type: 'string', format: 'uuid' }, expected_updated_at: { type: 'string', format: 'date-time' }, client_request_id: { type: 'string', minLength: 1, maxLength: 128 } } },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  },
  {
    name: 'kifer_activate_whatsapp_campaign',
    description: 'Ativa explicitamente uma campanha real. Valida mensagem, contatos e configuração; a execução é delegada ao comm-whatsapp-campaign-worker existente, com opt-out revalidado imediatamente antes de cada envio.',
    inputSchema: { type: 'object', required: ['campaign_id', 'expected_updated_at', 'client_request_id'], additionalProperties: false, properties: { campaign_id: { type: 'string', format: 'uuid' }, expected_updated_at: { type: 'string', format: 'date-time' }, client_request_id: { type: 'string', minLength: 1, maxLength: 128 } } },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  },
  {
    name: 'kifer_pause_whatsapp_campaign',
    description: 'Pausa uma campanha real nos mesmos estados aceitos pela UI e rearma alvos em envio para scheduled.',
    inputSchema: { type: 'object', required: ['campaign_id', 'expected_updated_at', 'client_request_id'], additionalProperties: false, properties: { campaign_id: { type: 'string', format: 'uuid' }, expected_updated_at: { type: 'string', format: 'date-time' }, client_request_id: { type: 'string', minLength: 1, maxLength: 128 } } },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  },
  {
    name: 'kifer_resume_whatsapp_campaign',
    description: 'Retoma uma campanha pausada sem reenviar contatos já processados; devolve queued ou scheduled conforme o horário.',
    inputSchema: { type: 'object', required: ['campaign_id', 'expected_updated_at', 'client_request_id'], additionalProperties: false, properties: { campaign_id: { type: 'string', format: 'uuid' }, expected_updated_at: { type: 'string', format: 'date-time' }, client_request_id: { type: 'string', minLength: 1, maxLength: 128 } } },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  },
  {
    name: 'kifer_schedule_whatsapp_campaign',
    description: 'Agenda uma campanha real para uma data futura, sem ativá-la imediatamente e sem criar uma fila paralela.',
    inputSchema: { type: 'object', required: ['campaign_id', 'scheduled_at', 'expected_updated_at', 'client_request_id'], additionalProperties: false, properties: { campaign_id: { type: 'string', format: 'uuid' }, scheduled_at: { type: 'string', format: 'date-time' }, expected_updated_at: { type: 'string', format: 'date-time' }, client_request_id: { type: 'string', minLength: 1, maxLength: 128 } } },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  },
  {
    name: 'kifer_delete_whatsapp_campaign',
    description: 'Exclui uma campanha real somente nos estados seguros aceitos pela operação. Campanhas com processamento iniciado são bloqueadas; isto não é follow-up.',
    inputSchema: { type: 'object', required: ['campaign_id', 'expected_updated_at', 'client_request_id'], additionalProperties: false, properties: { campaign_id: { type: 'string', format: 'uuid' }, expected_updated_at: { type: 'string', format: 'date-time' }, client_request_id: { type: 'string', minLength: 1, maxLength: 128 } } },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  },
];

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const isRecord = (value: unknown): value is JsonRecord => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const safeUuid = (value: unknown): value is string => UUID.test(text(value));
export const campaignReadAuditSummary = (args: JsonRecord) => ({
  campaign_id: safeUuid(args.campaign_id) ? text(args.campaign_id) : null,
  target_id: safeUuid(args.target_id) ? text(args.target_id) : null,
  argument_keys: Object.keys(args).sort(),
  page: args.page,
  page_size: args.page_size,
});

const pageParams = (args: JsonRecord) => {
  const page = Number.isInteger(args.page) ? Math.max(Number(args.page), 1) : 1;
  const pageSize = Number.isInteger(args.page_size) ? Math.min(Math.max(Number(args.page_size), 1), 50) : 20;
  return { page, pageSize, from: (page - 1) * pageSize };
};
const parseDate = (value: unknown): string | null => {
  const raw = text(value);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
};
const maskPhone = (value: unknown): string => {
  const digits = text(value).replace(/\D/g, '');
  return digits.length >= 4 ? `••••${digits.slice(-4)}` : '••••';
};
const UNSAFE_CONFIG_KEY = /(?:token|secret|password|credential|authorization|api[_-]?key|content_base64|signed[_-]?url|private[_-]?key)/i;
const UNSAFE_CONTACT_KEY = /(?:^|_)(?:phone|phone_number|phone_digits|mobile|whatsapp|email|cpf|cnpj|rg|cns|address|endereco|logradouro|cep|data_nascimento|birth_date|token|secret|password|credential|authorization|api[_-]?key|content_base64|signed[_-]?url|private[_-]?key)(?:$|_)/i;
const KNOWN_CAMPAIGN_VARIABLES = new Set(['nome', 'primeiro_nome', 'telefone', 'status', 'responsavel', 'saudacao', 'saudacao_titulo', 'saudacao_capitalizada']);
const safeAudienceConfig = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(safeAudienceConfig);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== 'parsed_rows' && key !== 'raw_csv' && !UNSAFE_CONFIG_KEY.test(key))
    .map(([key, child]) => [key, safeAudienceConfig(child)]));
};
const safeContactPayload = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(safeContactPayload);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !UNSAFE_CONTACT_KEY.test(key))
    .map(([key, child]) => [key, safeContactPayload(child)]));
};
const safeCampaignStep = (value: unknown): JsonRecord => {
  const step = isRecord(value) ? { ...value } : {};
  if ('media_url' in step) {
    step.media_attached = Boolean(text(step.media_url));
    delete step.media_url;
  }
  return step;
};
const withMetrics = (campaign: JsonRecord): JsonRecord => ({
  total: Number(campaign.total_targets ?? 0),
  valid: Number(campaign.valid_targets ?? 0),
  invalid: Number(campaign.invalid_targets ?? 0),
  pending: Number(campaign.pending_targets ?? 0),
  sent: Number(campaign.sent_targets ?? 0),
  failed: Number(campaign.failed_targets ?? 0),
  responded: Number(campaign.responded_targets ?? 0),
  stopped: Number(campaign.stopped_targets ?? 0),
});
const publicCampaign = (value: unknown): JsonRecord => {
  const campaign = isRecord(value) ? { ...value } : {};
  if ('audience_config' in campaign) campaign.audience_config = safeAudienceConfig(campaign.audience_config);
  delete campaign.created_by;
  return { ...campaign, campaign_id: safeUuid(campaign.id) ? campaign.id : null, metrics: withMetrics(campaign) };
};

const errorResult = (errorCode: string, message: string): CampaignWriteResult => ({ success: false, error_code: errorCode, message });

const mapRpcError = (message: string): CampaignWriteResult => {
  const code = message.includes('MCP_IDEMPOTENCY_KEY_REUSED') ? 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD'
    : message.includes('MCP_ACTION_REQUEST_INCOMPLETE') ? 'ACTION_REQUEST_INCOMPLETE'
      : message.includes('MCP_CLIENT_REQUEST_ID_REQUIRED') ? 'CLIENT_REQUEST_ID_REQUIRED'
        : message.includes('MCP_SERVICE_ROLE_REQUIRED') || message.includes('MCP_ADMIN_REQUIRED') ? 'ADMIN_REQUIRED'
        : message.includes('MCP_CAMPAIGN_NOT_FOUND') ? 'CAMPAIGN_NOT_FOUND'
          : message.includes('MCP_CAMPAIGN_CONTACT_NOT_FOUND') ? 'CAMPAIGN_CONTACT_NOT_FOUND'
            : message.includes('MCP_CAMPAIGN_CONTACT_ALREADY_PROCESSED') ? 'CONTACT_ALREADY_PROCESSED'
              : message.includes('MCP_CAMPAIGN_CONTACTS_REQUIRED') ? 'CONTACTS_REQUIRED'
                : message.includes('MCP_CAMPAIGN_MESSAGE_REQUIRED') ? 'MESSAGE_REQUIRED'
                  : message.includes('MCP_CAMPAIGN_HAS_PROCESSED_CONTACTS') ? 'CAMPAIGN_HAS_PROCESSED_CONTACTS'
                      : message.includes('MCP_CAMPAIGN_') ? 'INVALID_INPUT' : 'INTERNAL_ERROR';
  return errorResult(code, code === 'INTERNAL_ERROR' ? 'Não foi possível alterar a campanha.' : message);
};

const rpcMutation = async (params: { supabase: SupabaseClient; actorId: string; operation: string; campaignId?: string; targetId?: string; expectedUpdatedAt?: string; clientRequestId: string; payload?: JsonRecord }): Promise<CampaignWriteResult> => {
  const { supabase } = params;
  if (!REQUEST_ID.test(params.clientRequestId)) return errorResult('CLIENT_REQUEST_ID_INVALID', 'client_request_id deve usar apenas letras, números, :, _ ou - e ter até 128 caracteres.');
  const { data, error } = await supabase.rpc('mcp_comm_whatsapp_campaign_mutation', {
    p_actor_user_id: params.actorId,
    p_operation: params.operation,
    p_campaign_id: params.campaignId ?? null,
    p_target_id: params.targetId ?? null,
    p_expected_updated_at: params.expectedUpdatedAt ?? null,
    p_client_request_id: params.clientRequestId,
    p_payload: params.payload ?? {},
  });
  if (error) return mapRpcError(error.message);
  return isRecord(data) ? data : errorResult('INTERNAL_ERROR', 'A mutação da campanha não retornou um resultado válido.');
};

const invokeCampaignWorker = async (supabase: SupabaseClient, campaignId: string): Promise<CampaignWriteResult> => {
  const { data, error } = await supabase.functions.invoke('comm-whatsapp-campaign-worker', { body: { action: 'activate', campaignId, source: 'api' } });
  if (error) return errorResult('WORKER_ACTIVATION_FAILED', 'A campanha foi preparada, mas o worker não confirmou a ativação.');
  if (!isRecord(data) || data.error) return errorResult('WORKER_ACTIVATION_FAILED', 'O worker não confirmou a ativação da campanha.');
  return data;
};

const formatCampaignContact = (value: unknown): JsonRecord => {
  const contact = isRecord(value) ? { ...value } : {};
  const rawPhone = contact.phone_digits ?? contact.phone_number;
  contact.phone_masked = maskPhone(rawPhone);
  contact.contact_id = safeUuid(contact.id) ? contact.id : null;
  if ('source_payload' in contact) contact.source_payload = safeContactPayload(contact.source_payload);
  delete contact.phone_digits;
  delete contact.phone_number;
  return contact;
};

const listCampaigns = async (supabase: SupabaseClient, args: JsonRecord): Promise<JsonRecord> => {
  const { page, pageSize, from } = pageParams(args);
  let query = supabase.from('comm_whatsapp_campaigns').select(CAMPAIGN_SELECT, { count: 'exact' });
  const status = text(args.status);
  const name = text(args.name);
  const dateFrom = parseDate(args.date_from ?? args.data_inicial);
  const dateTo = parseDate(args.date_to ?? args.data_final);
  if (status) query = query.eq('status', status);
  if (name) query = query.ilike('name', `%${name.replace(/[%_]/g, '')}%`);
  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo) query = query.lte('created_at', dateTo);
  const orderBy = ['created_at', 'updated_at', 'scheduled_at', 'name', 'status'].includes(text(args.order_by)) ? text(args.order_by) : 'created_at';
  const { data, error, count } = await query.order(orderBy, { ascending: args.ascending === true, nullsFirst: false }).range(from, from + pageSize - 1);
  if (error) return { success: false, error_code: 'INTERNAL_ERROR', message: 'Não foi possível listar as campanhas WhatsApp.' };
  return { success: true, page, page_size: pageSize, total: count ?? 0, campaigns: (data ?? []).map(publicCampaign) };
};

const getCampaignRecord = async (supabase: SupabaseClient, campaignId: string): Promise<{ campaign: JsonRecord | null; error?: JsonRecord }> => {
  const { data, error } = await supabase.from('comm_whatsapp_campaigns').select(CAMPAIGN_SELECT).eq('id', campaignId).maybeSingle();
  if (error) return { campaign: null, error: { success: false, error_code: 'INTERNAL_ERROR', message: 'Não foi possível consultar a campanha.' } };
  if (!data) return { campaign: null, error: { success: false, error_code: 'CAMPAIGN_NOT_FOUND', message: 'Campanha WhatsApp não encontrada.' } };
  return { campaign: data as JsonRecord };
};

const getCampaign = async (supabase: SupabaseClient, args: JsonRecord): Promise<JsonRecord> => {
  const campaignId = text(args.campaign_id);
  if (!safeUuid(campaignId)) return { success: false, error_code: 'INVALID_INPUT', message: 'campaign_id inválido.' };
  const loaded = await getCampaignRecord(supabase, campaignId);
  if (!loaded.campaign) return loaded.error ?? errorResult('CAMPAIGN_NOT_FOUND', 'Campanha não encontrada.');
  const { data: steps, error } = await supabase.from('comm_whatsapp_campaign_steps').select(CAMPAIGN_STEP_SELECT).eq('campaign_id', campaignId).order('step_index', { ascending: true });
  if (error) return errorResult('INTERNAL_ERROR', 'Não foi possível consultar as etapas da campanha.');
  const campaign = publicCampaign(loaded.campaign);
  return { success: true, campaign, steps: (steps ?? []).map(safeCampaignStep), metrics: withMetrics(loaded.campaign) };
};

const countBlockedCampaignTargets = async (supabase: SupabaseClient, campaignId: string): Promise<number | null> => {
  const { data, error } = await supabase
    .from('comm_whatsapp_campaign_targets')
    .select('phone_digits')
    .eq('campaign_id', campaignId);
  if (error) return null;

  const digits = [...new Set((data ?? [])
    .map((row) => isRecord(row) ? text(row.phone_digits) : '')
    .filter(Boolean))];
  const blocked = new Set<string>();
  for (let index = 0; index < digits.length; index += 500) {
    const batch = digits.slice(index, index + 500);
    const { data: policies, error: policyError } = await supabase
      .from('contact_permission_policies')
      .select('endpoint_normalized')
      .eq('channel', 'whatsapp')
      .eq('state', 'blocked')
      .in('purpose_scope', ['global', 'commercial'])
      .in('endpoint_normalized', batch);
    if (policyError) return null;
    for (const policy of policies ?? []) {
      if (isRecord(policy) && text(policy.endpoint_normalized)) blocked.add(text(policy.endpoint_normalized));
    }
  }
  return blocked.size;
};

const isValidCampaignWindow = (start: unknown, end: unknown): boolean => {
  const startValue = text(start);
  const endValue = text(end);
  const valid = (value: string) => !value || /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);
  return valid(startValue) && valid(endValue) && (!startValue || !endValue || startValue <= endValue);
};

const isValidCampaignWeekdays = (value: unknown): boolean => {
  if (!Array.isArray(value) || value.length === 0) return false;
  const days = value.filter((item): item is number => Number.isInteger(item));
  return days.length === value.length && days.every((day) => day >= 0 && day <= 6) && new Set(days).size === days.length;
};

const previewCampaign = async (supabase: SupabaseClient, args: JsonRecord): Promise<JsonRecord> => {
  const campaignId = text(args.campaign_id);
  if (!safeUuid(campaignId)) return { success: false, error_code: 'INVALID_INPUT', message: 'campaign_id inválido.' };
  const loaded = await getCampaignRecord(supabase, campaignId);
  if (!loaded.campaign) return loaded.error ?? errorResult('CAMPAIGN_NOT_FOUND', 'Campanha não encontrada.');
  const { data: steps, error: stepError } = await supabase.from('comm_whatsapp_campaign_steps').select('step_index,message_text').eq('campaign_id', campaignId).order('step_index', { ascending: true });
  if (stepError) return errorResult('INTERNAL_ERROR', 'Não foi possível carregar as mensagens da campanha.');
  let samples: JsonRecord[] = Array.isArray(args.samples) ? args.samples.filter(isRecord).slice(0, 5) : [];
  if (samples.length === 0) {
    const { data: targetSamples, error: targetError } = await supabase
      .from('comm_whatsapp_campaign_targets')
      .select('display_name,phone_number,source_payload')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true })
      .limit(5);
    if (targetError) return errorResult('INTERNAL_ERROR', 'Não foi possível carregar amostras da campanha.');
    samples = (targetSamples ?? []).map((target) => {
      const record = isRecord(target) ? target : {};
      const payload = isRecord(record.source_payload) ? record.source_payload : {};
      return {
        name: text(record.display_name) || undefined,
        phone: maskPhone(record.phone_number),
        status: text(payload.status) || undefined,
        responsavel: text(payload.responsavel) || undefined,
      };
    });
  }
  const persistedMessageSteps = (steps ?? []).filter(isRecord).filter((step) => text(step.message_text));
  const messageSteps = persistedMessageSteps.length > 0
    ? persistedMessageSteps
    : text(loaded.campaign.message_text) ? [{ message_text: loaded.campaign.message_text }] : [];
  const variables = [...new Set(messageSteps.flatMap((step) => {
    const matches = text(step.message_text).matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g);
    return Array.from(matches, (match) => match[1]);
  }))].sort();
  const unknownVariables = variables.filter((variable) => !KNOWN_CAMPAIGN_VARIABLES.has(variable));
  const [unnamedResult, blockedCount] = await Promise.all([
    supabase.from('comm_whatsapp_campaign_targets').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).or('display_name.is.null,display_name.eq.'),
    countBlockedCampaignTargets(supabase, campaignId),
  ]);
  const campaignConfig = isRecord(loaded.campaign.audience_config) ? loaded.campaign.audience_config : {};
  const metrics = withMetrics(loaded.campaign);
  const checks = {
    has_contacts: metrics.total > 0,
    has_message: messageSteps.length > 0,
    no_unknown_variables: unknownVariables.length === 0,
    opt_out_exclusion_enabled: campaignConfig.exclude_opt_out !== false,
    schedule_valid: !loaded.campaign.scheduled_at || Boolean(parseDate(loaded.campaign.scheduled_at)),
    window_valid: isValidCampaignWindow(loaded.campaign.send_window_start, loaded.campaign.send_window_end),
    weekdays_valid: isValidCampaignWeekdays(loaded.campaign.active_weekdays),
  };
  const render = (sample: JsonRecord) => messageSteps.map((step) => resolveCommWhatsAppCampaignMessage(text(step.message_text), {
    name: text(sample.name),
    phone: text(sample.phone),
    status: text(sample.status),
    responsible: text(sample.responsavel),
  }));
  return {
    success: true,
    campaign_id: campaignId,
    variables,
    unknown_variables: unknownVariables,
    metrics,
    validation: {
      ...checks,
      duplicate_targets: 0,
      invalid_phone_targets: metrics.invalid,
      blocked_targets: blockedCount,
      contacts_without_name: unnamedResult.count ?? null,
      ready_to_activate: ['draft', 'scheduled', 'paused'].includes(text(loaded.campaign.status))
        && Object.values(checks).every(Boolean),
    },
    fallback_without_name: render({ name: '', phone: '', status: '', responsavel: '' }),
    examples: samples.map((sample) => ({
      name: text(sample.name) || null,
      rendered_messages: render(sample),
    })),
  };
};

const listCampaignContacts = async (supabase: SupabaseClient, args: JsonRecord): Promise<JsonRecord> => {
  const campaignId = text(args.campaign_id);
  if (!safeUuid(campaignId)) return { success: false, error_code: 'INVALID_INPUT', message: 'campaign_id inválido.' };
  const { page, pageSize, from } = pageParams(args);
  let query = supabase.from('comm_whatsapp_campaign_targets').select(CAMPAIGN_CONTACT_SELECT, { count: 'exact' }).eq('campaign_id', campaignId);
  if (text(args.status)) query = query.eq('status', text(args.status));
  const search = text(args.search).replace(/[%,.()]/g, '');
  if (search) query = query.or(`display_name.ilike.%${search}%,phone_number.ilike.%${search}%`);
  const orderBy = ['created_at', 'updated_at', 'next_send_at', 'status'].includes(text(args.order_by)) ? text(args.order_by) : 'created_at';
  const { data, error, count } = await query.order(orderBy, { ascending: args.ascending === true, nullsFirst: false }).range(from, from + pageSize - 1);
  if (error) return errorResult('INTERNAL_ERROR', 'Não foi possível listar os contatos da campanha.');
  return { success: true, campaign_id: campaignId, page, page_size: pageSize, total: count ?? 0, contacts: (data ?? []).map(formatCampaignContact) };
};

const getCampaignContact = async (supabase: SupabaseClient, args: JsonRecord): Promise<JsonRecord> => {
  const campaignId = text(args.campaign_id);
  const targetId = text(args.target_id);
  if (!safeUuid(campaignId) || !safeUuid(targetId)) return { success: false, error_code: 'INVALID_INPUT', message: 'campaign_id ou target_id inválido.' };
  const { data, error } = await supabase.from('comm_whatsapp_campaign_targets').select(CAMPAIGN_CONTACT_SELECT).eq('campaign_id', campaignId).eq('id', targetId).maybeSingle();
  if (error) return errorResult('INTERNAL_ERROR', 'Não foi possível consultar o contato da campanha.');
  if (!data) return errorResult('CONTACT_NOT_FOUND', 'Contato da campanha não encontrado.');
  return { success: true, contact: formatCampaignContact(data) };
};

const getCampaignMetrics = async (supabase: SupabaseClient, args: JsonRecord): Promise<JsonRecord> => {
  const campaignId = text(args.campaign_id);
  if (!safeUuid(campaignId)) return { success: false, error_code: 'INVALID_INPUT', message: 'campaign_id inválido.' };
  const loaded = await getCampaignRecord(supabase, campaignId);
  if (!loaded.campaign) return loaded.error ?? errorResult('CAMPAIGN_NOT_FOUND', 'Campanha não encontrada.');
  const [{ data: statusCounts, error: statusError }, { data: failureReasons, error: failureError }, { count: optOutCount, error: optOutError }] = await Promise.all([
    supabase.rpc('get_comm_whatsapp_campaign_target_status_counts', { p_campaign_id: campaignId }),
    supabase.rpc('get_comm_whatsapp_campaign_failure_reasons', { p_campaign_id: campaignId }),
    supabase.from('comm_whatsapp_campaign_targets').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).eq('stopped_reason', 'contact_permission_blocked'),
  ]);
  if (statusError || failureError || optOutError) return errorResult('INTERNAL_ERROR', 'Não foi possível calcular as métricas da campanha.');
  return { success: true, campaign_id: campaignId, metrics: { ...withMetrics(loaded.campaign), opt_outs: optOutCount ?? 0 }, status_counts: statusCounts ?? [], failure_reasons: failureReasons ?? [] };
};

export async function executeMcpWhatsAppCampaignReadAction(params: { supabase: SupabaseClient; toolName: string; arguments: JsonRecord }): Promise<JsonRecord | null> {
  const { supabase, toolName, arguments: args } = params;
  if (toolName === 'kifer_list_whatsapp_campaigns') return listCampaigns(supabase, args);
  if (toolName === 'kifer_get_whatsapp_campaign') return getCampaign(supabase, args);
  if (toolName === 'kifer_preview_whatsapp_campaign') return previewCampaign(supabase, args);
  if (toolName === 'kifer_list_whatsapp_campaign_contacts') return listCampaignContacts(supabase, args);
  if (toolName === 'kifer_get_whatsapp_campaign_contact') return getCampaignContact(supabase, args);
  if (toolName === 'kifer_get_whatsapp_campaign_metrics') return getCampaignMetrics(supabase, args);
  return null;
}

const campaignPatch = (args: JsonRecord): JsonRecord => {
  const patch: JsonRecord = {};
  for (const key of ['name', 'message', 'status', 'objective', 'scheduled_at', 'pacing_per_minute', 'daily_send_limit', 'start_hour', 'end_hour', 'allowed_weekdays', 'stop_on_reply', 'validate_whatsapp_numbers', 'steps', 'audience_config']) {
    if (Object.prototype.hasOwnProperty.call(args, key)) patch[key] = args[key];
  }
  return patch;
};

export async function executeMcpWhatsAppCampaignWriteAction(params: { supabase: SupabaseClient; toolName: string; arguments: JsonRecord; actorId: string }): Promise<CampaignWriteResult | null> {
  const { supabase, toolName, arguments: args, actorId } = params;
  if (!(MCP_WHATSAPP_CAMPAIGN_WRITE_TOOL_NAMES as readonly string[]).includes(toolName)) return null;
  const campaignId = text(args.campaign_id);
  const requestId = text(args.client_request_id);
  if (toolName !== 'kifer_create_whatsapp_campaign' && !safeUuid(campaignId)) return errorResult('INVALID_INPUT', 'campaign_id inválido.');
  if (!requestId) return errorResult('CLIENT_REQUEST_ID_REQUIRED', 'client_request_id é obrigatório para ações de campanha.');
  const expectedUpdatedAt = text(args.expected_updated_at) || undefined;
  if (toolName !== 'kifer_create_whatsapp_campaign' && toolName !== 'kifer_import_whatsapp_campaign_contacts' && !expectedUpdatedAt) {
    return errorResult('EXPECTED_UPDATED_AT_REQUIRED', 'expected_updated_at é obrigatório para evitar sobrescrever alterações recentes.');
  }
  let result: CampaignWriteResult;

  if (toolName === 'kifer_create_whatsapp_campaign') {
    result = await rpcMutation({ supabase, actorId, operation: 'create', clientRequestId: requestId, payload: campaignPatch(args) });
    if (isRecord(result.campaign)) result.campaign = publicCampaign(result.campaign);
    return result;
  }
  if (toolName === 'kifer_update_whatsapp_campaign') {
    result = await rpcMutation({ supabase, actorId, operation: 'update', campaignId, expectedUpdatedAt, clientRequestId: requestId, payload: campaignPatch(args) });
    if (isRecord(result.campaign)) result.campaign = publicCampaign(result.campaign);
    return result;
  }
  if (toolName === 'kifer_import_whatsapp_campaign_contacts') {
    if (!Array.isArray(args.contacts) || args.contacts.length === 0 || args.contacts.length > 500) return errorResult('INVALID_INPUT', 'contacts deve conter entre 1 e 500 registros.');
    const contacts = args.contacts.map((contact) => {
      if (!isRecord(contact)) return null;
      return { phone: text(contact.phone), name: text(contact.name) || undefined, custom_fields: isRecord(contact.custom_fields) ? contact.custom_fields : {} };
    });
    result = await rpcMutation({ supabase, actorId, operation: 'import_contacts', campaignId, clientRequestId: requestId, payload: { contacts } });
    return result;
  }
  const operationByTool: Record<string, string> = {
    kifer_remove_whatsapp_campaign_contact: 'remove_contact',
    kifer_activate_whatsapp_campaign: 'activate',
    kifer_pause_whatsapp_campaign: 'pause',
    kifer_resume_whatsapp_campaign: 'resume',
    kifer_schedule_whatsapp_campaign: 'schedule',
    kifer_delete_whatsapp_campaign: 'delete',
  };
  const payload: JsonRecord = {};
  if (toolName === 'kifer_schedule_whatsapp_campaign') payload.scheduled_at = text(args.scheduled_at);
  result = await rpcMutation({ supabase, actorId, operation: operationByTool[toolName], campaignId, targetId: text(args.target_id) || undefined, expectedUpdatedAt, clientRequestId: requestId, payload });
  if (toolName === 'kifer_activate_whatsapp_campaign' && result.success === true && result.replayed !== true) {
    const workerResult = await invokeCampaignWorker(supabase, campaignId);
    return workerResult.success === true
      ? { ...result, activation: workerResult, status: workerResult.status ?? result.status }
      : { ...result, success: false, ...workerResult };
  }
  return result;
}
