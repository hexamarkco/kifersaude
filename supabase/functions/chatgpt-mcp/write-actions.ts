import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import {
  buildWhapiDirectChatId,
  formatPhoneLabel,
  getCommWhatsAppPhoneLookupKeys,
  normalizeCommWhatsAppPhone,
} from '../_shared/comm-whatsapp/identity.ts';
import { executeMcpLeadAdminAction, MCP_LEAD_ADMIN_TOOL_NAMES } from './lead-admin-actions.ts';
import { executeMcpOpportunityWriteAction, MCP_OPPORTUNITY_WRITE_TOOL_NAMES } from './opportunity-actions.ts';
import { executeMcpOpportunityReadAction } from './opportunity-actions.ts';
import { executeMcpContractWriteAction, MCP_CONTRACT_WRITE_TOOL_NAMES } from './contract-actions.ts';
import {
  executeMcpContractHolderImportAction,
  MCP_CONTRACT_HOLDER_IMPORT_WRITE_TOOL_NAMES,
} from './contract-holder-import-actions.ts';
import { executeMcpContractDocumentAction } from './contract-document-actions.ts';
import {
  executeMcpContactPermissionReadAction,
  executeMcpContactPermissionWriteAction,
  MCP_CONTACT_PERMISSION_WRITE_TOOL_NAMES,
} from './contact-permission-actions.ts';
import { executeMcpInboxAction, MCP_INBOX_WRITE_TOOL_NAMES } from './inbox-actions.ts';
import { executeMcpIdentityConflictResolution, MCP_IDENTITY_CONFLICT_WRITE_TOOL_NAMES } from './identity-conflict-actions.ts';
import { executeMcpWhatsAppMediaReadAction } from './media-read-action.ts';
import { auditOpportunityFollowUps, normalizeOpportunityRecords } from './opportunity-followup-audit.ts';

const MAX_MESSAGE_LENGTH = 4_096;
const MAX_SHORT_TEXT_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 4_000;
const FOLLOW_UP_AUDIT_READ_LIMIT = 1_000;
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const PRIORITIES = new Set(['baixa', 'normal', 'alta']);
const SECRET_KEY = /(?:token|secret|password|credential|authorization|api[_-]?key|content_base64|signed[_-]?url|temporary[_-]?url)/i;
const PRIVATE_CUSTOMER_DATA_KEY = /(?:^|_)(?:cpf|cnpj|rg|cns|email|telefone|phone(?:_number|_digits)?|endpoint(?:_normalized)?|address|endereco|logradouro|cep|data_nascimento|birth_date|nome_completo|nome_fantasia|razao_social|bairro|complemento|observacoes|descricao|message|caption|text_content|display_name|notes|reason|motivo|evidence)(?:$|_)/i;

export type McpWriteActor = { actor: string; actorId: string };
export type McpWriteResult = { success: boolean; [key: string]: unknown };

type ActionErrorCode =
  | 'UNAUTHORIZED' | 'LEAD_NOT_FOUND' | 'CHAT_NOT_FOUND' | 'CONTRACT_NOT_FOUND'
  | 'INVALID_STATUS' | 'MESSAGE_EMPTY' | 'MESSAGE_TOO_LONG' | 'RATE_LIMITED'
  | 'DUPLICATE_REQUEST' | 'PROVIDER_ERROR' | 'INVALID_INPUT' | 'INTERNAL_ERROR'
  | 'NOT_FOUND' | 'CONFLICT' | 'NOT_ALLOWED' | 'JOB_ALREADY_EXECUTED'
  | 'INVALID_ASSIGNEE' | 'LIMIT_EXCEEDED' | 'SCHEDULE_NOT_FOUND'
  | 'SCHEDULE_NOT_EDITABLE' | 'MESSAGE_ALREADY_SENT' | 'INVALID_SCHEDULE_TIME'
  | 'PHONE_LEAD_MISMATCH' | 'INVALID_MEDIA' | 'MEDIA_TOO_LARGE' | 'MEDIA_NOT_FOUND';

const FLOW_TRIGGER_TYPES = new Set(['lead_created', 'status_changed', 'status_duration', 'inactivity_duration']);
const STEP_ACTION_TYPES = new Set(['send_message', 'update_status', 'create_task', 'activate_autonomous_service']);
const DELAY_UNITS = new Set(['seconds', 'minutes', 'hours', 'days']);
const MAX_BULK_CANCEL_JOBS = 100;
const MAX_BULK_SCHEDULED_MESSAGES = 50;
const SCHEDULED_MESSAGE_STATUSES = new Set(['scheduled', 'sending', 'sent', 'failed', 'cancelled', 'expired']);
const SCHEDULED_MESSAGE_ORDER_FIELDS = new Set(['scheduled_at', 'created_at', 'updated_at', 'sent_at', 'status']);
const SCHEDULED_MESSAGE_SELECT = 'id,chat_id,lead_id,text_content,message_type,media_url,media_mime_type,media_file_name,media_size_bytes,scheduled_at,status,cancel_on_inbound_message,mcp_client_request_id,created_at,updated_at,sent_at,cancelled_at,error_message,cancelled_reason,delivery_status';
const COMMERCIAL_FOLLOW_UP_TYPES = new Set(['Follow-up']);
const FOLLOW_UP_TYPE_ALIASES = new Set(['retorno', 'follow up', 'follow-up', 'followup']);
const MAX_BULK_LEAD_MUTATIONS = 25;
const MCP_WHATSAPP_CHAT_SELECT = 'id,channel_id,external_chat_id,phone_number,phone_digits,display_name,lead_id,lead_link_source,deleted_at,merged_into_chat_id,created_at,updated_at';
const SCHEDULED_MEDIA_BUCKET = 'comm-whatsapp-scheduled-media';
const SCHEDULED_MEDIA_URL_PREFIX = `storage://${SCHEDULED_MEDIA_BUCKET}/`;
const MAX_SCHEDULED_MEDIA_BYTES = 20 * 1024 * 1024;
const SCHEDULED_MEDIA_TYPES = new Set(['image', 'video', 'document', 'audio']);
const ALLOWED_SCHEDULED_MEDIA_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
]);

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const rawString = (value: unknown) => typeof value === 'string' ? value : '';
const safeUuid = (value: unknown) => UUID.test(text(value));
const safeRequestId = (value: unknown) => /^[A-Za-z0-9:_-]{1,128}$/.test(text(value));
const sanitize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, SECRET_KEY.test(key) || PRIVATE_CUSTOMER_DATA_KEY.test(key) ? '[REDACTED]' : sanitize(child)]));
};

async function requestIdFingerprint(actorId: string, operation: string, requestId: unknown): Promise<string | null> {
  const normalized = text(requestId);
  if (!safeRequestId(normalized)) return null;
  try {
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`${actorId.toLowerCase()}:${operation}:${normalized}`),
    );
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

const errorResult = (errorCode: ActionErrorCode, message: string): McpWriteResult => ({ success: false, error_code: errorCode, message });

const parseDate = (value: unknown): string | null => {
  const raw = text(value);
  const timestamp = Date.parse(raw);
  return raw && Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
};

const messagePartsCount = (message: string) => {
  const normalized = message.replace(/\r\n/g, '\n').trim();
  return normalized ? normalized.split(/\n\s*---\s*\n/g).filter(Boolean).length : 0;
};

const isBeforeCommercialFollowUpHour = (value: unknown) => {
  const scheduledAt = parseDate(value);
  if (!scheduledAt) return false;
  const hour = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(scheduledAt))
    .find((part) => part.type === 'hour')?.value;
  return Number(hour) < 10;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

type ScheduledMedia = {
  storagePath: string;
  messageType: 'image' | 'video' | 'document' | 'audio';
  mimeType: string;
  fileName: string;
};

const mediaTypeForMime = (mimeType: string): ScheduledMedia['messageType'] | null => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return ALLOWED_SCHEDULED_MEDIA_MIME_TYPES.has(mimeType) ? 'document' : null;
};

const scheduledMediaFromParams = (value: unknown, actor: McpWriteActor): { media: ScheduledMedia | null; error: McpWriteResult | null } => {
  if (value === undefined) return { media: null, error: null };
  if (!isRecord(value)) return { media: null, error: errorResult('INVALID_MEDIA', 'media deve ser um anexo previamente enviado pela ferramenta de upload do MCP.') };
  const storagePath = text(value.storage_path);
  const mimeType = text(value.mime_type).toLowerCase();
  const fileName = rawString(value.file_name).trim();
  const messageType = text(value.message_type);
  const expectedType = mediaTypeForMime(mimeType);
  if (!storagePath.startsWith(`mcp/${actor.actorId}/`) || !mimeType || !fileName || fileName.length > 255 || !expectedType || !SCHEDULED_MEDIA_TYPES.has(messageType) || messageType !== expectedType) {
    return { media: null, error: errorResult('INVALID_MEDIA', 'O anexo é inválido, não pertence ao usuário autenticado ou possui tipo não permitido.') };
  }
  return { media: { storagePath, mimeType, fileName, messageType: expectedType }, error: null };
};

const boundedInteger = (value: unknown, minimum: number, maximum: number): number | null => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
};

const validHour = (value: unknown): string | null => {
  const raw = text(value);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(raw) ? raw : null;
};

const validWeekdays = (value: unknown): number[] | null => {
  if (!Array.isArray(value) || value.length === 0 || value.length > 7) return null;
  const days = value.map((item) => boundedInteger(item, 0, 6));
  return days.every((item): item is number => item !== null) && new Set(days).size === days.length
    ? [...days].sort((a, b) => a - b)
    : null;
};

type AutomationSettings = Record<string, unknown> & {
  enabled?: boolean;
  autoSend?: boolean;
  flows?: unknown[];
  scheduling?: Record<string, unknown>;
};

const automationSettings = (value: unknown): AutomationSettings | null => {
  if (!isRecord(value)) return null;
  return value as AutomationSettings;
};

const flowRecord = (value: unknown): Record<string, unknown> | null => isRecord(value) ? value : null;

const flowView = (flow: Record<string, unknown>) => {
  const steps = Array.isArray(flow.steps) ? flow.steps.filter(isRecord) : [];
  const scheduling = isRecord(flow.scheduling) ? flow.scheduling : {};
  return {
    id: text(flow.id),
    nome: text(flow.name),
    ativo: flow.ativo !== false,
    trigger_type: text(flow.triggerType),
    trigger_statuses: Array.isArray(flow.triggerStatuses) ? flow.triggerStatuses.map(text).filter(Boolean) : [],
    trigger_duration_hours: typeof flow.triggerDurationHours === 'number' ? flow.triggerDurationHours : null,
    steps: steps.map((step, index) => ({
      id: text(step.id) || `step-${index + 1}`,
      ordem: index,
      action_type: text(step.actionType),
      delay_value: typeof step.delayValue === 'number' ? step.delayValue : null,
      delay_unit: text(step.delayUnit),
      enabled: step.enabled !== false,
      ...(text(step.actionType) === 'send_message' ? {
        message_source: ['custom', 'template'].includes(text(step.messageSource)) ? text(step.messageSource) : 'legacy_or_unknown',
        message_texts: [
          ...(isRecord(step.customMessage) && text(step.customMessage.type) === 'text' && text(step.customMessage.text)
            ? [text(step.customMessage.text).slice(0, MAX_MESSAGE_LENGTH)]
            : []),
          ...(Array.isArray(step.messages)
            ? step.messages.filter((message): message is string => typeof message === 'string' && Boolean(message.trim())).slice(0, 20).map((message) => message.trim().slice(0, MAX_MESSAGE_LENGTH))
            : []),
        ],
      } : {}),
    })),
    scheduling: {
      start_hour: text(scheduling.startHour) || null,
      end_hour: text(scheduling.endHour) || null,
      allowed_weekdays: Array.isArray(scheduling.allowedWeekdays) ? scheduling.allowedWeekdays : null,
      daily_send_limit: typeof scheduling.dailySendLimit === 'number' ? scheduling.dailySendLimit : null,
    },
  };
};

async function loadAutomationIntegration(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('integration_settings')
    .select('id,settings,updated_at')
    .eq('slug', 'whatsapp_auto_contact')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

const automationSettingsView = (settings: AutomationSettings) => {
  const scheduling = isRecord(settings.scheduling) ? settings.scheduling : {};
  return {
    enabled: settings.enabled !== false,
    auto_send: settings.autoSend !== false,
    scheduling: {
      timezone: text(scheduling.timezone) || 'America/Sao_Paulo',
      start_hour: text(scheduling.startHour) || '08:00',
      end_hour: text(scheduling.endHour) || '19:00',
      allowed_weekdays: Array.isArray(scheduling.allowedWeekdays) ? scheduling.allowedWeekdays : [1, 2, 3, 4, 5],
      daily_send_limit: typeof scheduling.dailySendLimit === 'number' ? scheduling.dailySendLimit : null,
    },
    monitoring: isRecord(settings.monitoring)
      ? { refresh_seconds: boundedInteger(settings.monitoring.refreshSeconds, 5, 3600), realtime_enabled: settings.monitoring.realtimeEnabled !== false }
      : null,
  };
};

const validateFlowFields = async (supabase: SupabaseClient, params: Record<string, unknown>, fallback?: Record<string, unknown>): Promise<{ flow?: Record<string, unknown>; error?: McpWriteResult }> => {
  const name = text(params.nome ?? fallback?.name).slice(0, MAX_SHORT_TEXT_LENGTH);
  const active = params.ativo === undefined ? fallback?.ativo !== false : params.ativo;
  const triggerType = text(params.trigger_type ?? fallback?.triggerType);
  const triggerStatuses = Array.isArray(params.trigger_statuses)
    ? params.trigger_statuses.map(text).filter(Boolean)
    : Array.isArray(fallback?.triggerStatuses) ? fallback.triggerStatuses.map(text).filter(Boolean) : [];
  const duration = params.trigger_duration_hours === undefined
    ? boundedInteger(fallback?.triggerDurationHours, 0, 8760) ?? 0
    : boundedInteger(params.trigger_duration_hours, 0, 8760);
  const schedulingFallback = isRecord(fallback?.scheduling) ? fallback.scheduling : {};
  const startHour = validHour(params.start_hour ?? schedulingFallback.startHour);
  const endHour = validHour(params.end_hour ?? schedulingFallback.endHour);
  const weekdays = params.allowed_weekdays === undefined
    ? validWeekdays(schedulingFallback.allowedWeekdays) ?? [1, 2, 3, 4, 5]
    : validWeekdays(params.allowed_weekdays);
  const dailyLimitRaw = params.daily_send_limit === undefined ? schedulingFallback.dailySendLimit ?? null : params.daily_send_limit;
  const dailyLimit = dailyLimitRaw === null ? null : boundedInteger(dailyLimitRaw, 1, 1000);
  if (!name || typeof active !== 'boolean' || !FLOW_TRIGGER_TYPES.has(triggerType) || duration === null || !startHour || !endHour || !weekdays || (dailyLimitRaw !== null && dailyLimit === null)) {
    return { error: errorResult('INVALID_INPUT', 'Dados do fluxo inválidos: nome, ativação, gatilho, duração, horários, dias e limite devem respeitar o schema.') };
  }
  if (startHour >= endHour) return { error: errorResult('INVALID_INPUT', 'start_hour deve ser anterior a end_hour.') };
  if ((triggerType === 'status_changed' || triggerType === 'status_duration' || triggerType === 'inactivity_duration') && triggerStatuses.length === 0) {
    return { error: errorResult('INVALID_INPUT', 'Este tipo de gatilho exige pelo menos um status comercial.') };
  }
  if ((triggerType === 'status_duration' || triggerType === 'inactivity_duration') && duration < 1) {
    return { error: errorResult('INVALID_INPUT', 'Fluxos por duração exigem trigger_duration_hours de pelo menos 1 hora.') };
  }
  if (triggerStatuses.length > 20 || new Set(triggerStatuses).size !== triggerStatuses.length) return { error: errorResult('INVALID_INPUT', 'trigger_statuses deve conter até 20 status distintos.') };
  if (triggerStatuses.length > 0) {
    const { data, error } = await supabase.from('lead_status_config').select('nome,ativo').in('nome', triggerStatuses);
    if (error || !data || data.length !== triggerStatuses.length || data.some((status) => status.ativo === false)) return { error: errorResult('INVALID_STATUS', 'Um ou mais status de gatilho não existem ou estão inativos.') };
  }
  return {
    flow: {
      name,
      ativo: active,
      triggerType,
      triggerStatus: triggerStatuses[0] ?? '',
      triggerStatuses,
      triggerDurationHours: duration,
      scheduling: { startHour, endHour, allowedWeekdays: weekdays, dailySendLimit: dailyLimit },
    },
  };
};

async function audit(params: {
  supabase: SupabaseClient;
  actor: McpWriteActor;
  toolName: string;
  actionType: string;
  request: Record<string, unknown>;
  result: McpWriteResult;
  leadId?: string | null;
  chatId?: string | null;
  contractId?: string | null;
  clientRequestId?: string | null;
}) {
  const { error } = await params.supabase.from('mcp_action_audit_log').insert({
    tool_name: params.toolName,
    action_type: params.actionType,
    actor: params.actor.actor,
    actor_id: params.actor.actorId,
    lead_id: params.leadId || null,
    chat_id: params.chatId || null,
    contract_id: params.contractId || null,
    request_payload: sanitize(params.request),
    result_payload: sanitize(params.result),
    success: params.result.success,
    error_message: params.result.success ? null : text(params.result.message) || null,
    client_request_id: params.clientRequestId || null,
    source: 'chatgpt_mcp',
  });
  if (error) console.error('[chatgpt-mcp] falha ao auditar acao MCP:', error.message);
}

async function existingLead(supabase: SupabaseClient, leadId: string) {
  const { data, error } = await supabase.from('leads').select('id,status,status_id,responsavel_id').eq('id', leadId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function validateContract(supabase: SupabaseClient, leadId: string, contractId: string) {
  if (!contractId) return null;
  const { data, error } = await supabase.from('contracts').select('id,lead_id').eq('id', contractId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.lead_id === leadId ? data : null;
}

async function syncNextReturn(supabase: SupabaseClient, leadId: string) {
  const now = new Date().toISOString();
  const { data, error } = await supabase.from('reminders').select('data_lembrete').eq('lead_id', leadId).eq('lido', false).gte('data_lembrete', now).order('data_lembrete', { ascending: true }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  const nextReturn = data?.data_lembrete ?? null;
  const { error: updateError } = await supabase.from('leads').update({ proximo_retorno: nextReturn }).eq('id', leadId);
  if (updateError) throw new Error(updateError.message);
  return nextReturn;
}

async function createReminder(supabase: SupabaseClient, params: Record<string, unknown>, actor: McpWriteActor): Promise<McpWriteResult> {
  const leadId = text(params.lead_id);
  const contractId = text(params.contract_id);
  const tipo = text(params.tipo).slice(0, MAX_SHORT_TEXT_LENGTH);
  const titulo = text(params.titulo).slice(0, MAX_SHORT_TEXT_LENGTH);
  const descricao = text(params.descricao).slice(0, MAX_DESCRIPTION_LENGTH) || null;
  const prioridade = text(params.prioridade) || 'normal';
  const date = parseDate(params.data_lembrete);
  if (!safeUuid(leadId) || !tipo || !titulo || !date || !PRIORITIES.has(prioridade)) return errorResult('INVALID_INPUT', 'Informe lead_id, tipo, titulo, data_lembrete válida e prioridade válida.');
  if (FOLLOW_UP_TYPE_ALIASES.has(tipo.toLocaleLowerCase('pt-BR')) && tipo !== 'Follow-up') {
    return errorResult('INVALID_INPUT', 'Use exatamente o tipo "Follow-up" para acompanhamento comercial; "Retorno" e aliases não são mais permitidos.');
  }
  if (!(await existingLead(supabase, leadId))) return errorResult('LEAD_NOT_FOUND', 'Lead não encontrado.');
  if (contractId && (!safeUuid(contractId) || !(await validateContract(supabase, leadId, contractId)))) return errorResult('CONTRACT_NOT_FOUND', 'Contrato não encontrado para este lead.');
  const { data, error } = await supabase.from('reminders').insert({ lead_id: leadId, contract_id: contractId || null, tipo, titulo, descricao, data_lembrete: date, prioridade }).select('id,lead_id,contract_id,tipo,titulo,descricao,data_lembrete,prioridade,created_at').maybeSingle();
  if (error || !data) return errorResult('INTERNAL_ERROR', 'Não foi possível criar o lembrete.');
  const nextReturn = await syncNextReturn(supabase, leadId);
  return { success: true, reminder: data, proximo_retorno: nextReturn, actor: actor.actor };
}

async function createInteraction(supabase: SupabaseClient, params: Record<string, unknown>, actor: McpWriteActor): Promise<McpWriteResult> {
  const leadId = text(params.lead_id);
  const contractId = text(params.contract_id);
  const tipo = text(params.tipo).slice(0, MAX_SHORT_TEXT_LENGTH);
  const descricao = text(params.descricao).slice(0, MAX_DESCRIPTION_LENGTH);
  const responsavel = text(params.responsavel).slice(0, MAX_SHORT_TEXT_LENGTH) || actor.actor;
  if (!safeUuid(leadId) || !tipo || !descricao) return errorResult('INVALID_INPUT', 'Informe lead_id, tipo e descrição não vazios.');
  if (!(await existingLead(supabase, leadId))) return errorResult('LEAD_NOT_FOUND', 'Lead não encontrado.');
  if (contractId && (!safeUuid(contractId) || !(await validateContract(supabase, leadId, contractId)))) return errorResult('CONTRACT_NOT_FOUND', 'Contrato não encontrado para este lead.');
  const { data, error } = await supabase.from('interactions').insert({ lead_id: leadId, contract_id: contractId || null, tipo, descricao, responsavel, data_interacao: new Date().toISOString() }).select('*').maybeSingle();
  return error || !data ? errorResult('INTERNAL_ERROR', 'Não foi possível registrar a interação.') : { success: true, interaction: data };
}

async function updateLeadStatus(supabase: SupabaseClient, params: Record<string, unknown>, actor: McpWriteActor, dryRun = false): Promise<McpWriteResult> {
  const leadId = text(params.lead_id);
  const statusName = text(params.status).slice(0, MAX_SHORT_TEXT_LENGTH);
  const observation = text(params.observacao).slice(0, MAX_DESCRIPTION_LENGTH) || null;
  if (!safeUuid(leadId) || !statusName) return errorResult('INVALID_INPUT', 'Informe lead_id e status.');
  const lead = await existingLead(supabase, leadId);
  if (!lead) return errorResult('LEAD_NOT_FOUND', 'Lead não encontrado.');
  const { data: status, error: statusError } = await supabase.from('lead_status_config').select('id,nome,ativo').ilike('nome', statusName).maybeSingle();
  if (statusError || !status || status.ativo === false) return errorResult('INVALID_STATUS', 'Status inexistente ou inativo.');
  if (lead.status_id === status.id) return { success: true, lead_id: leadId, status_anterior: lead.status, status_novo: status.nome, unchanged: true };
  if (dryRun) return { success: true, dry_run: true, would_update: true, lead_id: leadId, status_anterior: lead.status, status_novo: status.nome };
  const timestamp = new Date().toISOString();
  const { error: updateError } = await supabase.from('leads').update({ status_id: status.id, ultimo_contato: timestamp }).eq('id', leadId);
  if (updateError) return errorResult('INTERNAL_ERROR', 'Não foi possível atualizar o status do lead.');
  const { error: interactionError } = await supabase.from('interactions').insert({ lead_id: leadId, tipo: 'Observação', descricao: observation || `Status alterado de "${lead.status}" para "${status.nome}" via ChatGPT.`, responsavel: actor.actor, data_interacao: timestamp });
  if (interactionError) console.error('[chatgpt-mcp] falha ao registrar interação de status:', interactionError.message);
  const { data: history, error: historyError } = await supabase.from('lead_status_history').insert({ lead_id: leadId, status_anterior: lead.status || '', status_novo: status.nome, responsavel: actor.actor, observacao: observation }).select('id').maybeSingle();
  if (historyError || !history) return errorResult('INTERNAL_ERROR', 'O status foi atualizado, mas o histórico não pôde ser registrado.');
  return { success: true, lead_id: leadId, status_anterior: lead.status, status_novo: status.nome, history_id: history.id };
}

async function sendWhatsAppMessage(supabase: SupabaseClient, params: Record<string, unknown>, actor: McpWriteActor): Promise<McpWriteResult> {
  const chatId = text(params.chat_id);
  const message = text(params.message);
  const clientRequestId = text(params.client_request_id).replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 128);
  if (!safeUuid(chatId)) return errorResult('CHAT_NOT_FOUND', 'Conversa de WhatsApp não encontrada.');
  if (!message) return errorResult('MESSAGE_EMPTY', 'A mensagem não pode estar vazia.');
  if (message.length > MAX_MESSAGE_LENGTH) return errorResult('MESSAGE_TOO_LONG', `A mensagem excede o limite de ${MAX_MESSAGE_LENGTH} caracteres.`);
  if (!clientRequestId) return errorResult('INVALID_INPUT', 'client_request_id é obrigatório para impedir envios duplicados.');
  const { data: chat, error: chatError } = await supabase.from('comm_whatsapp_chats').select('id,external_chat_id,deleted_at').eq('id', chatId).maybeSingle();
  if (chatError || !chat || chat.deleted_at) return errorResult('CHAT_NOT_FOUND', 'Conversa de WhatsApp não encontrada ou removida.');
  const baseUrl = Deno.env.get('SUPABASE_URL') || '';
  const secret = Deno.env.get('KIFER_MCP_WHATSAPP_INTERNAL_SECRET') || '';
  if (!baseUrl || !secret) return errorResult('INTERNAL_ERROR', 'Envio de WhatsApp ainda não está configurado no servidor MCP.');
  let response: Response;
  let body: Record<string, unknown> = {};
  try {
    response = await fetch(`${baseUrl}/functions/v1/comm-whatsapp-send`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Kifer-MCP-Internal-Secret': secret, 'X-Kifer-MCP-Actor-Id': actor.actorId }, body: JSON.stringify({ chatId: chat.external_chat_id, text: message, clientRequestId }) });
    const payload = await response.json().catch(() => ({}));
    body = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
  } catch {
    return { ...errorResult('PROVIDER_ERROR', 'Não foi possível confirmar o resultado do envio. Consulte a conversa antes de tentar novamente.'), ambiguous: true };
  }
  if (!response.ok && response.status !== 202) {
    if (response.status === 429) return errorResult('RATE_LIMITED', 'Limite de envios atingido. Aguarde antes de tentar novamente.');
    return { ...errorResult('PROVIDER_ERROR', body.ambiguous === true ? 'O resultado do envio é incerto. Consulte a conversa antes de tentar novamente.' : text(body.error) || 'O provedor de WhatsApp recusou a mensagem.'), ...(body.ambiguous === true ? { ambiguous: true } : {}) };
  }
  const externalMessageId = text(body.messageId);
  const { data: persisted } = externalMessageId ? await supabase.from('comm_whatsapp_messages').select('id,message_at,delivery_status').eq('chat_id', chatId).eq('external_message_id', externalMessageId).maybeSingle() : { data: null };
  return { success: true, duplicate: body.duplicate === true, ambiguous: body.ambiguous === true, persistence_pending: body.persistencePending === true, message_id: persisted?.id || null, external_message_id: externalMessageId || null, chat_id: chatId, delivery_status: text(body.status) || persisted?.delivery_status || 'queued', sent_at: persisted?.message_at || new Date().toISOString() };
}

async function sendWhatsAppMedia(supabase: SupabaseClient, params: Record<string, unknown>, actor: McpWriteActor): Promise<McpWriteResult> {
  const chatId = text(params.chat_id);
  const contentBase64 = rawString(params.content_base64).replace(/^data:[^;,]+;base64,/i, '');
  const mimeType = text(params.mime_type).toLowerCase();
  const fileName = rawString(params.file_name).trim();
  const caption = rawString(params.caption);
  const clientRequestId = text(params.client_request_id).replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 128);
  const expectedType = mediaTypeForMime(mimeType);
  const requestedType = text(params.media_kind);
  const validKinds = new Set(['image', 'video', 'audio', 'voice', 'document']);
  const mediaKind = requestedType || expectedType || '';
  const matchingKind = mediaKind === expectedType || (expectedType === 'audio' && mediaKind === 'voice');
  if (!safeUuid(chatId)) return errorResult('CHAT_NOT_FOUND', 'Conversa de WhatsApp não encontrada.');
  if (!contentBase64 || !mimeType || !ALLOWED_SCHEDULED_MEDIA_MIME_TYPES.has(mimeType) || !expectedType || !validKinds.has(mediaKind) || !matchingKind || !fileName || fileName.length > 255 || !clientRequestId) {
    return errorResult('INVALID_MEDIA', 'Informe chat_id, arquivo base64, nome, MIME permitido, tipo compatível e client_request_id.');
  }
  if (caption.length > MAX_MESSAGE_LENGTH) return errorResult('MESSAGE_TOO_LONG', `A legenda excede o limite de ${MAX_MESSAGE_LENGTH} caracteres.`);
  if (Math.ceil(contentBase64.length * 0.75) > MAX_SCHEDULED_MEDIA_BYTES) return errorResult('MEDIA_TOO_LARGE', `O arquivo excede o limite de ${MAX_SCHEDULED_MEDIA_BYTES / (1024 * 1024)} MB.`);
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(contentBase64), (character) => character.charCodeAt(0));
  } catch {
    return errorResult('INVALID_MEDIA', 'content_base64 não contém um arquivo base64 válido.');
  }
  if (bytes.byteLength === 0) return errorResult('INVALID_MEDIA', 'O arquivo de mídia está vazio.');
  if (bytes.byteLength > MAX_SCHEDULED_MEDIA_BYTES) return errorResult('MEDIA_TOO_LARGE', `O arquivo excede o limite de ${MAX_SCHEDULED_MEDIA_BYTES / (1024 * 1024)} MB.`);
  const { data: chat, error: chatError } = await supabase.from('comm_whatsapp_chats').select('id,external_chat_id,deleted_at').eq('id', chatId).maybeSingle();
  if (chatError || !chat || chat.deleted_at) return errorResult('CHAT_NOT_FOUND', 'Conversa de WhatsApp não encontrada ou removida.');
  const baseUrl = Deno.env.get('SUPABASE_URL') || '';
  const secret = Deno.env.get('KIFER_MCP_WHATSAPP_INTERNAL_SECRET') || '';
  if (!baseUrl || !secret) return errorResult('INTERNAL_ERROR', 'Envio de WhatsApp ainda não está configurado no servidor MCP.');
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '') || 'anexo';
  const form = new FormData();
  form.set('chatId', text(chat.external_chat_id));
  form.set('caption', caption);
  form.set('clientRequestId', clientRequestId);
  form.set('type', mediaKind);
  form.set('file', new File([bytes], safeFileName, { type: mimeType }));
  let response: Response;
  let body: Record<string, unknown> = {};
  try {
    response = await fetch(`${baseUrl}/functions/v1/comm-whatsapp-send`, { method: 'POST', headers: { 'X-Kifer-MCP-Internal-Secret': secret, 'X-Kifer-MCP-Actor-Id': actor.actorId }, body: form });
    const payload = await response.json().catch(() => ({}));
    body = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
  } catch {
    return { ...errorResult('PROVIDER_ERROR', 'Não foi possível confirmar o resultado do envio. Consulte a conversa antes de tentar novamente.'), ambiguous: true };
  }
  if (!response.ok && response.status !== 202) {
    if (response.status === 429 && body.ambiguous !== true) return errorResult('RATE_LIMITED', 'Limite de envios atingido. Aguarde antes de tentar novamente.');
    return { ...errorResult('PROVIDER_ERROR', body.ambiguous === true ? 'O resultado do envio é incerto. Consulte a conversa antes de tentar novamente.' : 'O envio da mídia foi recusado. Verifique o arquivo e tente novamente.'), ...(body.ambiguous === true ? { ambiguous: true } : {}) };
  }
  const externalMessageId = text(body.messageId);
  const { data: persisted } = externalMessageId ? await supabase.from('comm_whatsapp_messages').select('id,message_at,delivery_status').eq('chat_id', chatId).eq('external_message_id', externalMessageId).maybeSingle() : { data: null };
  return { success: true, duplicate: body.duplicate === true, ambiguous: body.ambiguous === true, persistence_pending: body.persistencePending === true, message_id: persisted?.id || null, external_message_id: externalMessageId || null, chat_id: chatId, media_kind: mediaKind, delivery_status: text(body.status) || persisted?.delivery_status || 'queued', sent_at: persisted?.message_at || new Date().toISOString() };
}

type McpWhatsAppChat = {
  id: string;
  channel_id: string;
  external_chat_id: string;
  phone_number: string;
  phone_digits: string;
  display_name: string;
  lead_id: string | null;
  deleted_at: string | null;
  merged_into_chat_id: string | null;
};

type McpLeadPhone = { id: string; nome_completo: string | null; telefone: string | null };

const normalizedBrazilWhatsAppPhone = (value: unknown) => {
  const normalized = normalizeCommWhatsAppPhone(value);
  return /^55\d{10,11}$/.test(normalized) ? normalized : '';
};

const chatView = (chat: McpWhatsAppChat, normalizedPhone: string) => ({
  id: chat.id,
  phone: normalizedBrazilWhatsAppPhone(chat.phone_digits || chat.phone_number) || normalizedPhone,
  lead_id: safeUuid(chat.lead_id) ? chat.lead_id : null,
});

async function findActiveWhatsAppChat(
  supabase: SupabaseClient,
  channelId: string,
  phone: string,
): Promise<McpWhatsAppChat | null> {
  const phoneKeys = getCommWhatsAppPhoneLookupKeys(phone);
  const { data, error } = await supabase
    .from('comm_whatsapp_chats')
    .select(MCP_WHATSAPP_CHAT_SELECT)
    .eq('channel_id', channelId)
    .in('phone_digits', phoneKeys)
    .is('deleted_at', null)
    .is('merged_into_chat_id', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as McpWhatsAppChat | null;
}

async function resolveLeadForWhatsAppChat(
  supabase: SupabaseClient,
  normalizedPhone: string,
  suppliedLeadId: string,
): Promise<{ lead: McpLeadPhone | null; leadMatch: 'matched' | 'not_found' | 'ambiguous'; error?: McpWriteResult }> {
  if (suppliedLeadId) {
    if (!safeUuid(suppliedLeadId)) return { lead: null, leadMatch: 'not_found', error: errorResult('LEAD_NOT_FOUND', 'Lead não encontrado.') };
    const { data, error } = await supabase
      .from('leads')
      .select('id,nome_completo,telefone')
      .eq('id', suppliedLeadId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const lead = data as McpLeadPhone | null;
    if (!lead) return { lead: null, leadMatch: 'not_found', error: errorResult('LEAD_NOT_FOUND', 'Lead não encontrado.') };
    if (normalizedBrazilWhatsAppPhone(lead.telefone) !== normalizedPhone) {
      return { lead: null, leadMatch: 'not_found', error: errorResult('PHONE_LEAD_MISMATCH', 'O telefone informado não corresponde ao telefone do lead.') };
    }
    return { lead, leadMatch: 'matched' };
  }

  const { data, error } = await supabase
    .from('leads')
    .select('id,nome_completo,telefone')
    .in('telefone', getCommWhatsAppPhoneLookupKeys(normalizedPhone))
    .range(0, 2);
  if (error) throw new Error(error.message);
  const candidates = (Array.isArray(data) ? data : [])
    .filter((lead): lead is McpLeadPhone => normalizedBrazilWhatsAppPhone((lead as McpLeadPhone).telefone) === normalizedPhone);
  if (candidates.length === 1) return { lead: candidates[0], leadMatch: 'matched' };
  return { lead: null, leadMatch: candidates.length > 1 ? 'ambiguous' : 'not_found' };
}

async function getOrCreateWhatsAppChat(supabase: SupabaseClient, params: Record<string, unknown>, actor: McpWriteActor): Promise<McpWriteResult> {
  const normalizedPhone = normalizedBrazilWhatsAppPhone(params.phone);
  const suppliedLeadId = text(params.lead_id);
  if (!normalizedPhone) return errorResult('INVALID_INPUT', 'Informe um telefone brasileiro válido, com DDD e número.');

  const { data: channel, error: channelError } = await supabase
    .from('comm_whatsapp_channels')
    .select('id')
    .eq('slug', 'primary')
    .maybeSingle();
  if (channelError || !channel?.id) return errorResult('INTERNAL_ERROR', 'Canal principal do WhatsApp não está disponível.');

  const resolvedLead = await resolveLeadForWhatsAppChat(supabase, normalizedPhone, suppliedLeadId);
  if (resolvedLead.error) return resolvedLead.error;

  const linkChatIfSafe = async (chat: McpWhatsAppChat) => {
    if (!resolvedLead.lead || chat.lead_id === resolvedLead.lead.id) return chat;
    if (chat.lead_id) {
      if (suppliedLeadId) throw new Error('PHONE_LEAD_MISMATCH');
      return chat;
    }
    const { data, error } = await supabase
      .from('comm_whatsapp_chats')
      .update({
        lead_id: resolvedLead.lead.id,
        lead_link_source: suppliedLeadId ? 'crm_start' : 'auto_phone',
        lead_linked_at: new Date().toISOString(),
        lead_linked_by: actor.actorId,
      })
      .eq('id', chat.id)
      .is('deleted_at', null)
      .is('merged_into_chat_id', null)
      .select(MCP_WHATSAPP_CHAT_SELECT)
      .maybeSingle();
    if (error || !data) throw new Error(error?.message || 'Não foi possível associar a conversa ao lead.');
    return data as McpWhatsAppChat;
  };

  let existing = await findActiveWhatsAppChat(supabase, channel.id, normalizedPhone);
  if (existing) {
    try {
      existing = await linkChatIfSafe(existing);
    } catch (error) {
      if (error instanceof Error && error.message === 'PHONE_LEAD_MISMATCH') {
        return errorResult('PHONE_LEAD_MISMATCH', 'A conversa existente já está vinculada a outro lead.');
      }
      throw error;
    }
    return {
      success: true,
      created: false,
      chat_id: existing.id,
      lead_id: safeUuid(existing.lead_id) ? existing.lead_id : null,
      lead_match: existing.lead_id ? 'matched' : resolvedLead.leadMatch,
      chat: chatView(existing, normalizedPhone),
    };
  }

  const externalChatId = buildWhapiDirectChatId(normalizedPhone);
  const { data: created, error: createError } = await supabase
    .from('comm_whatsapp_chats')
    .insert({
      channel_id: channel.id,
      external_chat_id: externalChatId,
      phone_number: normalizedPhone,
      phone_digits: normalizedPhone,
      display_name: text(resolvedLead.lead?.nome_completo) || formatPhoneLabel(normalizedPhone),
      lead_id: resolvedLead.lead?.id || null,
      lead_link_source: resolvedLead.lead ? (suppliedLeadId ? 'crm_start' : 'auto_phone') : null,
      lead_linked_at: resolvedLead.lead ? new Date().toISOString() : null,
      lead_linked_by: resolvedLead.lead ? actor.actorId : null,
      last_message_direction: 'system',
      unread_count: 0,
      status: 'open',
    })
    .select(MCP_WHATSAPP_CHAT_SELECT)
    .maybeSingle();

  if (createError || !created) {
    const concurrentChat = await findActiveWhatsAppChat(supabase, channel.id, normalizedPhone);
    if (concurrentChat) {
      return {
        success: true,
        created: false,
        chat_id: concurrentChat.id,
        lead_id: safeUuid(concurrentChat.lead_id) ? concurrentChat.lead_id : null,
        lead_match: concurrentChat.lead_id ? 'matched' : resolvedLead.leadMatch,
        chat: chatView(concurrentChat, normalizedPhone),
      };
    }
    return errorResult('INTERNAL_ERROR', 'Não foi possível criar a conversa no Inbox.');
  }

  const chat = created as McpWhatsAppChat;
  return {
    success: true,
    created: true,
    chat_id: chat.id,
    lead_id: safeUuid(chat.lead_id) ? chat.lead_id : null,
    lead_match: resolvedLead.leadMatch,
    chat: chatView(chat, normalizedPhone),
  };
}

async function ensureScheduledMediaExists(supabase: SupabaseClient, media: ScheduledMedia): Promise<McpWriteResult | null> {
  const { data, error } = await supabase.storage
    .from(SCHEDULED_MEDIA_BUCKET)
    .createSignedUrl(media.storagePath, 60);
  return error || !data?.signedUrl
    ? errorResult('MEDIA_NOT_FOUND', 'O anexo enviado ao MCP não está mais disponível.')
    : null;
}

async function uploadScheduledWhatsAppMedia(supabase: SupabaseClient, params: Record<string, unknown>, actor: McpWriteActor): Promise<McpWriteResult> {
  const contentBase64 = rawString(params.content_base64).replace(/^data:[^;,]+;base64,/i, '');
  const mimeType = text(params.mime_type).toLowerCase();
  const fileName = rawString(params.file_name).trim();
  const clientRequestId = text(params.client_request_id).replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 128);
  const messageType = mediaTypeForMime(mimeType);
  if (!contentBase64 || !mimeType || !fileName || !clientRequestId || !messageType || !ALLOWED_SCHEDULED_MEDIA_MIME_TYPES.has(mimeType)) {
    return errorResult('INVALID_MEDIA', 'Informe arquivo base64, nome, MIME permitido e client_request_id para anexar a mídia.');
  }
  if (fileName.length > 255) return errorResult('INVALID_MEDIA', 'O nome do arquivo excede 255 caracteres.');
  if (Math.ceil(contentBase64.length * 0.75) > MAX_SCHEDULED_MEDIA_BYTES) {
    return errorResult('MEDIA_TOO_LARGE', `O anexo excede o limite de ${MAX_SCHEDULED_MEDIA_BYTES / (1024 * 1024)} MB.`);
  }
  let bytes: Uint8Array;
  try {
    const binary = atob(contentBase64);
    bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return errorResult('INVALID_MEDIA', 'content_base64 não contém um arquivo base64 válido.');
  }
  if (bytes.byteLength === 0) return errorResult('INVALID_MEDIA', 'O arquivo anexado está vazio.');
  if (bytes.byteLength > MAX_SCHEDULED_MEDIA_BYTES) return errorResult('MEDIA_TOO_LARGE', `O anexo excede o limite de ${MAX_SCHEDULED_MEDIA_BYTES / (1024 * 1024)} MB.`);
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '') || 'anexo';
  const storagePath = `mcp/${actor.actorId}/${clientRequestId}-${safeFileName}`;
  const { error } = await supabase.storage
    .from(SCHEDULED_MEDIA_BUCKET)
    .upload(storagePath, bytes, { contentType: mimeType, upsert: false });
  const conflict = error && (String((error as { statusCode?: unknown }).statusCode) === '409' || /already exists/i.test(error.message));
  if (error && !conflict) return errorResult('INTERNAL_ERROR', 'Não foi possível armazenar o anexo para o agendamento.');
  return {
    success: true,
    duplicate: Boolean(conflict),
    media: {
      storage_path: storagePath,
      message_type: messageType,
      mime_type: mimeType,
      file_name: fileName,
      size_bytes: bytes.byteLength,
    },
    client_request_id: clientRequestId,
  };
}

async function scheduleWhatsAppMessage(supabase: SupabaseClient, params: Record<string, unknown>, actor: McpWriteActor): Promise<McpWriteResult> {
  const suppliedChatId = text(params.chat_id);
  const suppliedLeadId = text(params.lead_id);
  const message = rawString(params.message);
  const scheduledAt = parseDate(params.scheduled_at);
  const clientRequestId = text(params.client_request_id).replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 128);
  const cancelOnInboundMessage = params.cancel_on_inbound_message === undefined ? false : params.cancel_on_inbound_message;
  const parsedMedia = scheduledMediaFromParams(params.media, actor);
  if ((suppliedChatId && suppliedLeadId) || (!suppliedChatId && !suppliedLeadId)) {
    return errorResult('INVALID_INPUT', 'Informe exatamente um de chat_id ou lead_id para agendar a mensagem.');
  }
  if (parsedMedia.error) return parsedMedia.error;
  const media = parsedMedia.media;
  if (!message.trim() && !media) return errorResult('MESSAGE_EMPTY', 'Informe uma mensagem ou um anexo.');
  if (message.length > MAX_MESSAGE_LENGTH) return errorResult('MESSAGE_TOO_LONG', `A mensagem excede o limite de ${MAX_MESSAGE_LENGTH} caracteres.`);
  if (!clientRequestId) return errorResult('INVALID_INPUT', 'client_request_id é obrigatório para impedir agendamentos duplicados.');
  if (typeof cancelOnInboundMessage !== 'boolean') return errorResult('INVALID_INPUT', 'cancel_on_inbound_message deve ser booleano.');
  if (!scheduledAt || Date.parse(scheduledAt) < Date.now() + 60_000) {
    return errorResult('INVALID_SCHEDULE_TIME', 'scheduled_at deve ser uma data futura de pelo menos um minuto.');
  }
  if (Date.parse(scheduledAt) > Date.now() + 366 * 24 * 60 * 60 * 1_000) {
    return errorResult('INVALID_SCHEDULE_TIME', 'scheduled_at não pode ultrapassar 366 dias a partir de agora.');
  }
  if (media) {
    const mediaError = await ensureScheduledMediaExists(supabase, media);
    if (mediaError) return mediaError;
  }

  let chatId = suppliedChatId;
  if (suppliedLeadId) {
    if (!safeUuid(suppliedLeadId)) return errorResult('LEAD_NOT_FOUND', 'Lead não encontrado.');
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id,telefone')
      .eq('id', suppliedLeadId)
      .maybeSingle();
    if (leadError) return errorResult('INTERNAL_ERROR', 'Não foi possível consultar o lead para agendar a mensagem.');
    if (!lead) return errorResult('LEAD_NOT_FOUND', 'Lead não encontrado.');
    const leadPhone = normalizedBrazilWhatsAppPhone((lead as McpLeadPhone).telefone);
    if (!leadPhone) return errorResult('INVALID_INPUT', 'O lead não possui telefone brasileiro válido para criar uma conversa do WhatsApp.');

    const chatResult = await getOrCreateWhatsAppChat(supabase, { phone: leadPhone, lead_id: suppliedLeadId }, actor);
    if (!chatResult.success) return chatResult;
    chatId = text(chatResult.chat_id);
  }

  if (!safeUuid(chatId)) return errorResult('CHAT_NOT_FOUND', 'Conversa de WhatsApp não encontrada.');

  const { data: chat, error: chatError } = await supabase
    .from('comm_whatsapp_chats')
    .select('id,channel_id,phone_digits,phone_number,display_name,lead_id,deleted_at')
    .eq('id', chatId)
    .maybeSingle();
  if (chatError || !chat || chat.deleted_at || !chat.channel_id || !chat.phone_digits) {
    return errorResult('CHAT_NOT_FOUND', 'Conversa de WhatsApp não encontrada, removida ou sem canal associado.');
  }

  const lookupExisting = async () => await supabase
    .from('comm_whatsapp_scheduled_messages')
    .select('id,chat_id,lead_id,scheduled_at,status,cancel_on_inbound_message,mcp_client_request_id')
    .eq('channel_id', chat.channel_id)
    .eq('chat_id', chat.id)
    .eq('mcp_client_request_id', clientRequestId)
    .maybeSingle();
  const existing = await lookupExisting();
  if (existing.error) return errorResult('INTERNAL_ERROR', 'Não foi possível verificar a duplicidade do agendamento.');
  if (existing.data) {
    return {
      success: true,
      duplicate: true,
      scheduled_message_id: existing.data.id,
      chat_id: existing.data.chat_id,
      lead_id: existing.data.lead_id,
      scheduled_at: existing.data.scheduled_at,
      status: existing.data.status,
      cancel_on_inbound_message: existing.data.cancel_on_inbound_message === true,
      client_request_id: clientRequestId,
    };
  }

  const { data: scheduled, error: insertError } = await supabase
    .from('comm_whatsapp_scheduled_messages')
    .insert({
      channel_id: chat.channel_id,
      chat_id: chat.id,
      phone_digits: chat.phone_digits,
      phone_number: chat.phone_number || chat.phone_digits,
      display_name: chat.display_name || chat.phone_number || chat.phone_digits,
      message_type: media?.messageType ?? 'text',
      text_content: message || null,
      media_url: media ? `${SCHEDULED_MEDIA_URL_PREFIX}${media.storagePath}` : null,
      media_mime_type: media?.mimeType ?? null,
      media_file_name: media?.fileName ?? null,
      scheduled_at: scheduledAt,
      recurrence: 'none',
      cancel_on_inbound_message: cancelOnInboundMessage,
      lead_id: chat.lead_id || null,
      created_by: actor.actorId,
      mcp_client_request_id: clientRequestId,
      metadata: { source: 'chatgpt_mcp', client_request_id: clientRequestId },
    })
    .select('id,chat_id,lead_id,scheduled_at,status,cancel_on_inbound_message,mcp_client_request_id')
    .maybeSingle();
  if (insertError) {
    if (text((insertError as { code?: unknown }).code) === '23505') {
      const concurrent = await lookupExisting();
      if (!concurrent.error && concurrent.data) {
        return {
          success: true,
          duplicate: true,
          scheduled_message_id: concurrent.data.id,
          chat_id: concurrent.data.chat_id,
          lead_id: concurrent.data.lead_id,
          scheduled_at: concurrent.data.scheduled_at,
          status: concurrent.data.status,
          cancel_on_inbound_message: concurrent.data.cancel_on_inbound_message === true,
          client_request_id: clientRequestId,
        };
      }
    }
    return errorResult('INTERNAL_ERROR', 'Não foi possível agendar a mensagem de WhatsApp.');
  }
  if (!scheduled) return errorResult('INTERNAL_ERROR', 'Não foi possível confirmar o agendamento da mensagem.');
  return {
    success: true,
    duplicate: false,
    scheduled_message_id: scheduled.id,
    chat_id: scheduled.chat_id,
    lead_id: scheduled.lead_id,
    scheduled_at: scheduled.scheduled_at,
    status: scheduled.status,
    cancel_on_inbound_message: scheduled.cancel_on_inbound_message === true,
    client_request_id: clientRequestId,
  };
}

const scheduledMessageView = (row: Record<string, unknown>, leadName: string | null = null) => {
  const scheduledAt = parseDate(row.scheduled_at);
  const message = rawString(row.text_content);
  const storagePath = rawString(row.media_url).startsWith(SCHEDULED_MEDIA_URL_PREFIX)
    ? rawString(row.media_url).slice(SCHEDULED_MEDIA_URL_PREFIX.length)
    : null;
  return {
    scheduled_message_id: text(row.id),
    chat_id: text(row.chat_id) || null,
    lead_id: text(row.lead_id) || null,
    lead_name: leadName,
    message,
    message_parts_count: messagePartsCount(message),
    ...(row.media_url
      ? { media: {
        attached: true,
        message_type: text(row.message_type) || 'document',
        mime_type: text(row.media_mime_type) || null,
        file_name: text(row.media_file_name) || null,
        size_bytes: typeof row.media_size_bytes === 'number' ? row.media_size_bytes : null,
        storage_path: storagePath,
        managed_by_mcp: storagePath !== null,
      } }
      : {}),
    scheduled_at: scheduledAt,
    scheduled_at_utc: scheduledAt,
    timezone: 'America/Sao_Paulo',
    status: text(row.status) || null,
    cancel_on_inbound_message: row.cancel_on_inbound_message === true,
    client_request_id: text(row.mcp_client_request_id) || null,
    created_at: parseDate(row.created_at),
    updated_at: parseDate(row.updated_at),
    sent_at: parseDate(row.sent_at),
    cancelled_at: parseDate(row.cancelled_at),
    last_error: text(row.error_message) || null,
    cancellation_reason: text(row.cancelled_reason) || null,
    delivery_status: text(row.delivery_status) || null,
  };
};

async function leadNamesById(supabase: SupabaseClient, rows: Array<Record<string, unknown>>): Promise<Map<string, string>> {
  const ids = [...new Set(rows.map((row) => text(row.lead_id)).filter(safeUuid))];
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase.from('leads').select('id,nome_completo').in('id', ids).range(0, ids.length - 1);
  if (error) return new Map();
  return new Map(((data ?? []) as Array<Record<string, unknown>>).map((lead) => [text(lead.id), text(lead.nome_completo)]));
}

async function getScheduledMessageRow(supabase: SupabaseClient, scheduledMessageId: string): Promise<{ row: Record<string, unknown> | null; error: McpWriteResult | null }> {
  const { data, error } = await supabase
    .from('comm_whatsapp_scheduled_messages')
    .select(SCHEDULED_MESSAGE_SELECT)
    .eq('id', scheduledMessageId)
    .maybeSingle();
  if (error) return { row: null, error: errorResult('INTERNAL_ERROR', 'Não foi possível consultar o agendamento.') };
  if (!data) return { row: null, error: errorResult('SCHEDULE_NOT_FOUND', 'Agendamento de WhatsApp não encontrado.') };
  return { row: data as Record<string, unknown>, error: null };
}

const scheduledMessageMutationError = (row: Record<string, unknown>, operation: 'update' | 'cancel'): McpWriteResult | null => {
  const status = text(row.status);
  if (status === 'sent') return errorResult('MESSAGE_ALREADY_SENT', 'A mensagem já foi enviada e não pode mais ser alterada.');
  if (operation === 'update' && status !== 'scheduled') return errorResult('SCHEDULE_NOT_EDITABLE', 'Somente mensagens com status scheduled podem ser editadas.');
  if (operation === 'cancel' && !['scheduled', 'failed'].includes(status)) return errorResult('SCHEDULE_NOT_EDITABLE', 'Este agendamento não pode ser cancelado no estado atual.');
  return null;
};

async function getScheduledWhatsAppMessage(supabase: SupabaseClient, params: Record<string, unknown>): Promise<McpWriteResult> {
  const scheduledMessageId = text(params.scheduled_message_id);
  if (!safeUuid(scheduledMessageId)) return errorResult('INVALID_INPUT', 'scheduled_message_id inválido.');
  const current = await getScheduledMessageRow(supabase, scheduledMessageId);
  if (current.error || !current.row) return current.error ?? errorResult('SCHEDULE_NOT_FOUND', 'Agendamento de WhatsApp não encontrado.');
  const names = await leadNamesById(supabase, [current.row]);
  return { success: true, scheduled_message: scheduledMessageView(current.row, names.get(text(current.row.lead_id)) || null) };
}

async function listScheduledWhatsAppMessages(supabase: SupabaseClient, params: Record<string, unknown>): Promise<McpWriteResult> {
  const leadId = text(params.lead_id);
  const chatId = text(params.chat_id);
  const status = text(params.status);
  if (leadId && !safeUuid(leadId)) return errorResult('INVALID_INPUT', 'lead_id inválido.');
  if (chatId && !safeUuid(chatId)) return errorResult('INVALID_INPUT', 'chat_id inválido.');
  if (status && !SCHEDULED_MESSAGE_STATUSES.has(status)) return errorResult('INVALID_INPUT', 'status de agendamento inválido.');
  const start = params.data_inicial === undefined ? null : parseDate(params.data_inicial);
  const end = params.data_final === undefined ? null : parseDate(params.data_final);
  if ((params.data_inicial !== undefined && !start) || (params.data_final !== undefined && !end)) return errorResult('INVALID_INPUT', 'data_inicial e data_final devem estar no formato ISO 8601.');
  if (start && end && Date.parse(start) > Date.parse(end)) return errorResult('INVALID_INPUT', 'data_inicial deve ser anterior a data_final.');
  const page = boundedInteger(params.page ?? 1, 1, 10_000);
  const pageSize = boundedInteger(params.page_size ?? 20, 1, 100);
  if (page === null || pageSize === null) return errorResult('INVALID_INPUT', 'page e page_size estão fora do intervalo permitido.');
  const orderBy = text(params.order_by) || 'scheduled_at';
  if (!SCHEDULED_MESSAGE_ORDER_FIELDS.has(orderBy)) return errorResult('INVALID_INPUT', 'order_by inválido.');
  if (params.ascending !== undefined && typeof params.ascending !== 'boolean') return errorResult('INVALID_INPUT', 'ascending deve ser booleano.');
  let query = supabase.from('comm_whatsapp_scheduled_messages').select(SCHEDULED_MESSAGE_SELECT, { count: 'exact' });
  if (leadId) query = query.eq('lead_id', leadId);
  if (chatId) query = query.eq('chat_id', chatId);
  if (status) query = query.eq('status', status);
  if (start) query = query.gte('scheduled_at', start);
  if (end) query = query.lte('scheduled_at', end);
  const clientRequestId = text(params.client_request_id);
  if (clientRequestId) query = query.eq('mcp_client_request_id', clientRequestId);
  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.order(orderBy, { ascending: params.ascending === true }).range(from, from + pageSize - 1);
  if (error) return errorResult('INTERNAL_ERROR', 'Não foi possível listar os agendamentos de WhatsApp.');
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const names = await leadNamesById(supabase, rows);
  return {
    success: true,
    page,
    page_size: pageSize,
    total: count ?? null,
    scheduled_messages: rows.map((row) => scheduledMessageView(row, names.get(text(row.lead_id)) || null)),
  };
}

async function getCommercialFollowUpAudit(supabase: SupabaseClient, params: Record<string, unknown>, actorId: string): Promise<McpWriteResult> {
  const leadId = text(params.lead_id);
  const leadStatus = text(params.status_do_lead);
  if (leadId && !safeUuid(leadId)) return errorResult('INVALID_INPUT', 'lead_id inválido.');
  if (params.somente_problemas !== undefined && typeof params.somente_problemas !== 'boolean') return errorResult('INVALID_INPUT', 'somente_problemas deve ser booleano.');
  const date = params.data === undefined ? null : parseDate(params.data);
  if (params.data !== undefined && !date) return errorResult('INVALID_INPUT', 'data deve estar no formato ISO 8601.');
  const dayStart = date ? new Date(Date.parse(date)).toISOString().slice(0, 10) : null;
  const dayEnd = dayStart ? new Date(`${dayStart}T23:59:59.999Z`).toISOString() : null;
  let reminderQuery = supabase
    .from('reminders')
    .select('id,lead_id,tipo,titulo,data_lembrete,lido,cancelled_at', { count: 'exact' })
    .in('tipo', [...COMMERCIAL_FOLLOW_UP_TYPES])
    .eq('lido', false)
    .is('cancelled_at', null);
  let scheduledQuery = supabase
    .from('comm_whatsapp_scheduled_messages')
    .select('id,lead_id,chat_id,text_content,scheduled_at,status,error_message', { count: 'exact' })
    .in('status', ['scheduled', 'sending', 'failed']);
  if (leadId) {
    reminderQuery = reminderQuery.eq('lead_id', leadId);
    scheduledQuery = scheduledQuery.eq('lead_id', leadId);
  }
  if (date && dayStart && dayEnd) {
    reminderQuery = reminderQuery.gte('data_lembrete', dayStart).lte('data_lembrete', dayEnd);
    scheduledQuery = scheduledQuery.gte('scheduled_at', dayStart).lte('scheduled_at', dayEnd);
  }
  const [reminderResult, scheduleResult] = await Promise.all([
    reminderQuery.order('data_lembrete', { ascending: true }).range(0, FOLLOW_UP_AUDIT_READ_LIMIT - 1),
    scheduledQuery.order('scheduled_at', { ascending: true }).range(0, FOLLOW_UP_AUDIT_READ_LIMIT - 1),
  ]);
  if (reminderResult.error || scheduleResult.error) return errorResult('INTERNAL_ERROR', 'Não foi possível consultar os dados de auditoria comercial.');
  const reminders = (reminderResult.data ?? []) as Array<Record<string, unknown>>;
  const schedules = (scheduleResult.data ?? []) as Array<Record<string, unknown>>;
  const followUpAuditCoverageReasons: string[] = [];
  if (reminderResult.count !== null && reminderResult.count !== undefined && reminderResult.count > FOLLOW_UP_AUDIT_READ_LIMIT) {
    followUpAuditCoverageReasons.push('reminder_limit_exceeded');
  }
  if (scheduleResult.count !== null && scheduleResult.count !== undefined && scheduleResult.count > FOLLOW_UP_AUDIT_READ_LIMIT) {
    followUpAuditCoverageReasons.push('schedule_limit_exceeded');
  }
  const involvedLeadIds = [...new Set([...reminders, ...schedules].map((row) => text(row.lead_id)).filter(safeUuid))];
  const leadResult = involvedLeadIds.length > 0
    ? await supabase.from('leads').select('id,nome_completo,status,arquivado').in('id', involvedLeadIds).range(0, involvedLeadIds.length - 1)
    : { data: [], error: null };
  if (leadResult.error) return errorResult('INTERNAL_ERROR', 'Não foi possível consultar os leads da auditoria comercial.');
  const leads = new Map(((leadResult.data ?? []) as Array<Record<string, unknown>>).map((lead) => [text(lead.id), lead]));
  const matchesStatus = (row: Record<string, unknown>) => !leadStatus || text(leads.get(text(row.lead_id))?.status).toLocaleLowerCase() === leadStatus.toLocaleLowerCase();
  const filteredReminders = reminders.filter(matchesStatus);
  const filteredSchedules = schedules.filter(matchesStatus);
  const remindersByLead = new Map<string, Array<Record<string, unknown>>>();
  const schedulesByLead = new Map<string, Array<Record<string, unknown>>>();
  for (const reminder of filteredReminders) {
    const key = text(reminder.lead_id); if (key) remindersByLead.set(key, [...(remindersByLead.get(key) ?? []), reminder]);
  }
  for (const schedule of filteredSchedules) {
    const key = text(schedule.lead_id); if (key) schedulesByLead.set(key, [...(schedulesByLead.get(key) ?? []), schedule]);
  }
  const issues: Array<Record<string, unknown>> = [];
  const leadSummary = (id: string) => ({ lead_id: id, lead_name: text(leads.get(id)?.nome_completo) || null, lead_status: text(leads.get(id)?.status) || null });
  for (const [id, leadReminders] of remindersByLead) {
    if (leadReminders.length > 1) issues.push({ code: 'MULTIPLE_COMMERCIAL_FOLLOW_UPS', ...leadSummary(id), reminder_ids: leadReminders.map((reminder) => text(reminder.id)) });
    if (!(schedulesByLead.get(id)?.some((schedule) => text(schedule.status) === 'scheduled' || text(schedule.status) === 'sending'))) {
      issues.push({ code: 'FOLLOW_UP_WITHOUT_SCHEDULED_MESSAGE', ...leadSummary(id), reminder_ids: leadReminders.map((reminder) => text(reminder.id)) });
    }
    for (const reminder of leadReminders) {
      const reminderAt = parseDate(reminder.data_lembrete);
      if (reminderAt && Date.parse(reminderAt) < Date.now()) issues.push({ code: 'OVERDUE_COMMERCIAL_FOLLOW_UP', ...leadSummary(id), reminder_id: text(reminder.id), data_lembrete: reminderAt });
    }
  }
  for (const [id, leadSchedules] of schedulesByLead) {
    const lead = leads.get(id);
    if (leadSchedules.length > 1) {
      const duplicateKeys = new Map<string, Array<Record<string, unknown>>>();
      for (const schedule of leadSchedules) {
        const key = `${text(schedule.scheduled_at)}:${rawString(schedule.text_content)}`;
        duplicateKeys.set(key, [...(duplicateKeys.get(key) ?? []), schedule]);
      }
      for (const duplicates of duplicateKeys.values()) {
        if (duplicates.length > 1) issues.push({ code: 'DUPLICATE_SCHEDULED_MESSAGE', ...leadSummary(id), scheduled_message_ids: duplicates.map((schedule) => text(schedule.id)) });
      }
    }
    if (!remindersByLead.has(id)) issues.push({ code: 'SCHEDULED_MESSAGE_WITHOUT_FOLLOW_UP_REMINDER', ...leadSummary(id), scheduled_message_ids: leadSchedules.map((schedule) => text(schedule.id)), linkage: 'lead_level_only' });
    for (const schedule of leadSchedules) {
      const scheduleId = text(schedule.id);
      if (text(schedule.status) === 'failed') issues.push({ code: 'SCHEDULED_MESSAGE_FAILED', ...leadSummary(id), scheduled_message_id: scheduleId, last_error: text(schedule.error_message) || null });
      if (isBeforeCommercialFollowUpHour(schedule.scheduled_at)) issues.push({ code: 'SCHEDULED_MESSAGE_BEFORE_10_BRT', ...leadSummary(id), scheduled_message_id: scheduleId, scheduled_at: parseDate(schedule.scheduled_at) });
      if (lead?.arquivado === true || text(lead?.status).toLocaleLowerCase() === 'perdido') issues.push({ code: 'FOLLOW_UP_FOR_ARCHIVED_OR_LOST_LEAD', ...leadSummary(id), scheduled_message_id: scheduleId });
    }
  }
  const opportunityLeadIds = involvedLeadIds.slice(0, 500);
  const opportunityCoverageReasons: string[] = [];
  const opportunitiesById = new Map<string, ReturnType<typeof normalizeOpportunityRecords>['opportunities'][number]>();
  if (involvedLeadIds.length > 500) opportunityCoverageReasons.push('lead_limit_exceeded');
  if (opportunityLeadIds.length > 0 && !safeUuid(actorId)) {
    opportunityCoverageReasons.push('admin_actor_unavailable');
  } else if (opportunityLeadIds.length > 0) {
    const batches: string[][] = [];
    for (let index = 0; index < opportunityLeadIds.length; index += 100) batches.push(opportunityLeadIds.slice(index, index + 100));
    const opportunityResults = await Promise.all(batches.map((leadIds) => supabase.rpc('mcp_get_opportunities_for_leads', {
      p_actor_user_id: actorId,
      p_lead_ids: leadIds,
    })));
    for (const result of opportunityResults) {
      if (result.error || !result.data || typeof result.data !== 'object' || Array.isArray(result.data)) {
        opportunityCoverageReasons.push('opportunity_read_failed');
        continue;
      }
      const payload = result.data as Record<string, unknown>;
      if (payload.success !== true) {
        opportunityCoverageReasons.push('opportunity_read_rejected');
        continue;
      }
      const normalized = normalizeOpportunityRecords(payload);
      if (normalized.truncated) opportunityCoverageReasons.push('opportunity_limit_exceeded');
      for (const opportunity of normalized.opportunities) {
        if (opportunity.members_truncated) opportunityCoverageReasons.push('opportunity_member_limit_exceeded');
        opportunitiesById.set(opportunity.id, opportunity);
      }
    }
  }
  const uniqueOpportunityCoverageReasons = [...new Set(opportunityCoverageReasons)];
  const uniqueFollowUpAuditCoverageReasons = [...new Set([...followUpAuditCoverageReasons, ...uniqueOpportunityCoverageReasons])];
  issues.push(...auditOpportunityFollowUps({
    opportunities: [...opportunitiesById.values()],
    reminders: filteredReminders,
    schedules: filteredSchedules,
  }));

  const allLeadIds = [...new Set([...remindersByLead.keys(), ...schedulesByLead.keys()])];
  const allFollowUps = params.somente_problemas === false
    ? allLeadIds.map((id) => ({
      ...leadSummary(id),
      reminder_ids: (remindersByLead.get(id) ?? []).map((reminder) => text(reminder.id)),
      scheduled_message_ids: (schedulesByLead.get(id) ?? []).map((schedule) => text(schedule.id)),
    }))
    : undefined;
  return {
    success: true,
    reminders_considered: filteredReminders.length,
    scheduled_messages_considered: filteredSchedules.length,
    issues: issues.slice(0, 500),
    issues_truncated: issues.length > 500,
    ...(allFollowUps ? { follow_ups: allFollowUps } : {}),
    follow_up_audit_coverage_available: uniqueFollowUpAuditCoverageReasons.length === 0,
    follow_up_audit_coverage_incomplete_reasons: uniqueFollowUpAuditCoverageReasons,
    opportunity_checks_available: uniqueOpportunityCoverageReasons.length === 0,
    opportunity_checks_incomplete_reasons: uniqueOpportunityCoverageReasons,
    opportunities_considered: opportunitiesById.size,
  };
}

async function updateScheduledWhatsAppMessage(supabase: SupabaseClient, params: Record<string, unknown>, actor: McpWriteActor): Promise<McpWriteResult> {
  const scheduledMessageId = text(params.scheduled_message_id);
  const changes = isRecord(params.changes) ? params.changes : null;
  if (!safeUuid(scheduledMessageId) || !changes) return errorResult('INVALID_INPUT', 'scheduled_message_id e changes são obrigatórios.');
  if (Object.keys(changes).length === 0) return errorResult('INVALID_INPUT', 'Informe ao menos message, media, remove_media, scheduled_at ou cancel_on_inbound_message.');
  if (Object.keys(changes).some((key) => key !== 'message' && key !== 'media' && key !== 'remove_media' && key !== 'scheduled_at' && key !== 'cancel_on_inbound_message')) return errorResult('NOT_ALLOWED', 'A ferramenta permite alterar somente message, media, remove_media, scheduled_at e cancel_on_inbound_message.');
  const current = await getScheduledMessageRow(supabase, scheduledMessageId);
  if (current.error || !current.row) return current.error ?? errorResult('SCHEDULE_NOT_FOUND', 'Agendamento de WhatsApp não encontrado.');
  const mutationError = scheduledMessageMutationError(current.row, 'update');
  if (mutationError) return mutationError;
  if (changes.remove_media === true && changes.media !== undefined) return errorResult('INVALID_MEDIA', 'Informe media para substituir o anexo ou remove_media para removê-lo, não ambos.');
  if (changes.remove_media !== undefined && typeof changes.remove_media !== 'boolean') return errorResult('INVALID_INPUT', 'remove_media deve ser booleano.');
  const updates: Record<string, unknown> = {};
  const parsedMedia = scheduledMediaFromParams(changes.media, actor);
  if (parsedMedia.error) return parsedMedia.error;
  if (parsedMedia.media) {
    const mediaError = await ensureScheduledMediaExists(supabase, parsedMedia.media);
    if (mediaError) return mediaError;
    updates.message_type = parsedMedia.media.messageType;
    updates.media_url = `${SCHEDULED_MEDIA_URL_PREFIX}${parsedMedia.media.storagePath}`;
    updates.media_mime_type = parsedMedia.media.mimeType;
    updates.media_file_name = parsedMedia.media.fileName;
  }
  if (changes.remove_media === true) {
    updates.message_type = 'text';
    updates.media_url = null;
    updates.media_mime_type = null;
    updates.media_file_name = null;
  }
  if ('message' in changes) {
    const message = rawString(changes.message);
    if (message.length > MAX_MESSAGE_LENGTH) return errorResult('MESSAGE_TOO_LONG', `A mensagem excede o limite de ${MAX_MESSAGE_LENGTH} caracteres.`);
    updates.text_content = message;
  }
  const resultingText = 'message' in changes ? rawString(changes.message) : rawString(current.row.text_content);
  const resultingMedia = parsedMedia.media !== null || (changes.remove_media !== true && Boolean(current.row.media_url));
  if (!resultingText.trim() && !resultingMedia) return errorResult('MESSAGE_EMPTY', 'Informe uma mensagem ou mantenha um anexo.');
  if ('scheduled_at' in changes) {
    const scheduledAt = parseDate(changes.scheduled_at);
    if (!scheduledAt || Date.parse(scheduledAt) < Date.now() + 60_000 || Date.parse(scheduledAt) > Date.now() + 366 * 24 * 60 * 60 * 1_000) {
      return errorResult('INVALID_SCHEDULE_TIME', 'scheduled_at deve estar entre um minuto e 366 dias no futuro, em ISO 8601.');
    }
    updates.scheduled_at = scheduledAt;
  }
  if ('cancel_on_inbound_message' in changes) {
    if (typeof changes.cancel_on_inbound_message !== 'boolean') return errorResult('INVALID_INPUT', 'cancel_on_inbound_message deve ser booleano.');
    updates.cancel_on_inbound_message = changes.cancel_on_inbound_message;
  }
  const { data, error } = await supabase
    .from('comm_whatsapp_scheduled_messages')
    .update(updates)
    .eq('id', scheduledMessageId)
    .eq('status', 'scheduled')
    .select(SCHEDULED_MESSAGE_SELECT)
    .maybeSingle();
  if (error) return errorResult('INTERNAL_ERROR', 'Não foi possível atualizar o agendamento.');
  if (!data) {
    const reloaded = await getScheduledMessageRow(supabase, scheduledMessageId);
    if (reloaded.error || !reloaded.row) return reloaded.error ?? errorResult('SCHEDULE_NOT_FOUND', 'Agendamento de WhatsApp não encontrado.');
    return scheduledMessageMutationError(reloaded.row, 'update') ?? errorResult('CONFLICT', 'O agendamento foi alterado simultaneamente.');
  }
  const row = data as Record<string, unknown>;
  const names = await leadNamesById(supabase, [row]);
  return { success: true, scheduled_message: scheduledMessageView(row, names.get(text(row.lead_id)) || null) };
}

async function cancelScheduledWhatsAppMessage(supabase: SupabaseClient, params: Record<string, unknown>): Promise<McpWriteResult> {
  const scheduledMessageId = text(params.scheduled_message_id);
  const observation = rawString(params.observacao);
  if (!safeUuid(scheduledMessageId)) return errorResult('INVALID_INPUT', 'scheduled_message_id inválido.');
  if (observation.length > MAX_DESCRIPTION_LENGTH) return errorResult('INVALID_INPUT', `observacao excede o limite de ${MAX_DESCRIPTION_LENGTH} caracteres.`);
  const current = await getScheduledMessageRow(supabase, scheduledMessageId);
  if (current.error || !current.row) return current.error ?? errorResult('SCHEDULE_NOT_FOUND', 'Agendamento de WhatsApp não encontrado.');
  if (text(current.row.status) === 'cancelled') {
    const names = await leadNamesById(supabase, [current.row]);
    return { success: true, duplicate: true, scheduled_message: scheduledMessageView(current.row, names.get(text(current.row.lead_id)) || null) };
  }
  const mutationError = scheduledMessageMutationError(current.row, 'cancel');
  if (mutationError) return mutationError;
  const { data, error } = await supabase
    .from('comm_whatsapp_scheduled_messages')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), cancelled_reason: observation || null })
    .eq('id', scheduledMessageId)
    .in('status', ['scheduled', 'failed'])
    .select(SCHEDULED_MESSAGE_SELECT)
    .maybeSingle();
  if (error) return errorResult('INTERNAL_ERROR', 'Não foi possível cancelar o agendamento.');
  if (!data) {
    const reloaded = await getScheduledMessageRow(supabase, scheduledMessageId);
    if (reloaded.error || !reloaded.row) return reloaded.error ?? errorResult('SCHEDULE_NOT_FOUND', 'Agendamento de WhatsApp não encontrado.');
    if (text(reloaded.row.status) === 'cancelled') {
      const names = await leadNamesById(supabase, [reloaded.row]);
      return { success: true, duplicate: true, scheduled_message: scheduledMessageView(reloaded.row, names.get(text(reloaded.row.lead_id)) || null) };
    }
    return scheduledMessageMutationError(reloaded.row, 'cancel') ?? errorResult('CONFLICT', 'O agendamento foi alterado simultaneamente.');
  }
  const row = data as Record<string, unknown>;
  const names = await leadNamesById(supabase, [row]);
  return { success: true, duplicate: false, scheduled_message: scheduledMessageView(row, names.get(text(row.lead_id)) || null) };
}

async function bulkScheduleWhatsAppMessages(supabase: SupabaseClient, params: Record<string, unknown>, actor: McpWriteActor): Promise<McpWriteResult> {
  const items = params.items;
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_BULK_SCHEDULED_MESSAGES) {
    return errorResult('INVALID_INPUT', `items deve conter entre 1 e ${MAX_BULK_SCHEDULED_MESSAGES} agendamentos.`);
  }
  const results: Array<Record<string, unknown>> = [];
  let scheduled = 0;
  let duplicates = 0;
  let failed = 0;
  for (const [index, item] of items.entries()) {
    const result = isRecord(item)
      ? await scheduleWhatsAppMessage(supabase, item, actor)
      : errorResult('INVALID_INPUT', 'Cada item deve conter chat_id, message, scheduled_at e client_request_id.');
    if (result.success && result.duplicate === true) duplicates++;
    else if (result.success) scheduled++;
    else failed++;
    results.push({ item_index: index, ...result });
  }
  return { success: true, total: items.length, scheduled, duplicates, failed, results };
}

async function updateAutomationSettings(supabase: SupabaseClient, params: Record<string, unknown>): Promise<McpWriteResult> {
  const integration = await loadAutomationIntegration(supabase);
  const current = automationSettings(integration?.settings);
  if (!integration || !current) return errorResult('NOT_FOUND', 'Configuração de automação não encontrada.');
  const requested = isRecord(params.settings) ? params.settings : null;
  if (!requested) return errorResult('INVALID_INPUT', 'Informe o objeto settings com campos permitidos.');
  const allowed = new Set(['enabled', 'auto_send', 'timezone', 'start_hour', 'end_hour', 'allowed_weekdays', 'daily_send_limit', 'refresh_seconds']);
  if (Object.keys(requested).some((key) => !allowed.has(key))) return errorResult('NOT_ALLOWED', 'A ferramenta só aceita os campos operacionais explicitamente permitidos.');
  const scheduling = { ...(isRecord(current.scheduling) ? current.scheduling : {}) };
  if ('enabled' in requested && typeof requested.enabled !== 'boolean') return errorResult('INVALID_INPUT', 'enabled deve ser booleano.');
  if ('auto_send' in requested && typeof requested.auto_send !== 'boolean') return errorResult('INVALID_INPUT', 'auto_send deve ser booleano.');
  if ('timezone' in requested && !/^America\/[A-Za-z_]+$|^UTC$/.test(text(requested.timezone))) return errorResult('INVALID_INPUT', 'timezone inválido.');
  if ('start_hour' in requested && !validHour(requested.start_hour)) return errorResult('INVALID_INPUT', 'start_hour deve estar no formato HH:MM.');
  if ('end_hour' in requested && !validHour(requested.end_hour)) return errorResult('INVALID_INPUT', 'end_hour deve estar no formato HH:MM.');
  if ('allowed_weekdays' in requested && !validWeekdays(requested.allowed_weekdays)) return errorResult('INVALID_INPUT', 'allowed_weekdays deve conter dias únicos de 0 a 6.');
  if ('daily_send_limit' in requested && requested.daily_send_limit !== null && boundedInteger(requested.daily_send_limit, 1, 1000) === null) return errorResult('INVALID_INPUT', 'daily_send_limit deve ser nulo ou entre 1 e 1000.');
  if ('refresh_seconds' in requested && boundedInteger(requested.refresh_seconds, 5, 3600) === null) return errorResult('INVALID_INPUT', 'refresh_seconds deve estar entre 5 e 3600.');
  if ('timezone' in requested) scheduling.timezone = text(requested.timezone);
  if ('start_hour' in requested) scheduling.startHour = validHour(requested.start_hour);
  if ('end_hour' in requested) scheduling.endHour = validHour(requested.end_hour);
  if ('allowed_weekdays' in requested) scheduling.allowedWeekdays = validWeekdays(requested.allowed_weekdays);
  if ('daily_send_limit' in requested) scheduling.dailySendLimit = requested.daily_send_limit === null ? null : boundedInteger(requested.daily_send_limit, 1, 1000);
  const monitoring = { ...(isRecord(current.monitoring) ? current.monitoring : {}) };
  if ('refresh_seconds' in requested) monitoring.refreshSeconds = boundedInteger(requested.refresh_seconds, 5, 3600);
  const updated = {
    ...current,
    ...('enabled' in requested ? { enabled: requested.enabled } : {}),
    ...('auto_send' in requested ? { autoSend: requested.auto_send } : {}),
    scheduling,
    monitoring,
  };
  const { error } = await supabase.from('integration_settings').update({ settings: updated, updated_at: new Date().toISOString() }).eq('id', integration.id);
  return error ? errorResult('INTERNAL_ERROR', 'Não foi possível atualizar as configurações de automação.') : { success: true, settings: automationSettingsView(updated) };
}

async function updateFollowUpFlow(supabase: SupabaseClient, params: Record<string, unknown>, forceActive?: boolean): Promise<McpWriteResult> {
  const flowId = text(params.flow_id);
  if (!flowId) return errorResult('INVALID_INPUT', 'flow_id é obrigatório.');
  const integration = await loadAutomationIntegration(supabase);
  const current = automationSettings(integration?.settings);
  if (!integration || !current || !Array.isArray(current.flows)) return errorResult('NOT_FOUND', 'Configuração de fluxos não encontrada.');
  const position = current.flows.findIndex((candidate) => flowRecord(candidate)?.id === flowId);
  const previous = flowRecord(current.flows[position]);
  if (!previous) return errorResult('NOT_FOUND', 'Fluxo não encontrado.');
  const patch = isRecord(params.changes) ? params.changes : {};
  const allowed = new Set(['nome', 'ativo', 'trigger_type', 'trigger_duration_hours', 'daily_send_limit', 'start_hour', 'end_hour', 'allowed_weekdays', 'trigger_statuses', 'enabled_step_ids', 'step_delays']);
  if (Object.keys(patch).some((key) => !allowed.has(key))) return errorResult('NOT_ALLOWED', 'A ferramenta só aceita nome, gatilho, ativação, horários, limites, status de gatilho e delays das etapas existentes.');
  const next: Record<string, unknown> = { ...previous };
  if ('nome' in patch) {
    const name = text(patch.nome);
    if (!name || name.length > MAX_SHORT_TEXT_LENGTH) return errorResult('INVALID_INPUT', 'nome deve conter de 1 a 160 caracteres.');
    if (current.flows.some((candidate) => {
      const other = flowRecord(candidate);
      return other && text(other.id) !== flowId && text(other.name).toLocaleLowerCase() === name.toLocaleLowerCase();
    })) return errorResult('CONFLICT', 'Já existe outro fluxo com este nome.');
    next.name = name;
  }
  if ('trigger_type' in patch) {
    const triggerType = text(patch.trigger_type);
    if (!FLOW_TRIGGER_TYPES.has(triggerType)) return errorResult('INVALID_INPUT', 'trigger_type inválido.');
    next.triggerType = triggerType;
  }
  if ('trigger_duration_hours' in patch) {
    const duration = boundedInteger(patch.trigger_duration_hours, 0, 8760);
    if (duration === null) return errorResult('INVALID_INPUT', 'trigger_duration_hours deve estar entre 0 e 8760.');
    next.triggerDurationHours = duration;
  }
  if (forceActive !== undefined) next.ativo = forceActive;
  if ('ativo' in patch) {
    if (typeof patch.ativo !== 'boolean') return errorResult('INVALID_INPUT', 'ativo deve ser booleano.');
    next.ativo = patch.ativo;
  }
  const schedule = { ...(isRecord(previous.scheduling) ? previous.scheduling : {}) };
  if ('daily_send_limit' in patch) {
    if (patch.daily_send_limit !== null && boundedInteger(patch.daily_send_limit, 1, 1000) === null) return errorResult('INVALID_INPUT', 'daily_send_limit deve ser nulo ou entre 1 e 1000.');
    schedule.dailySendLimit = patch.daily_send_limit === null ? null : boundedInteger(patch.daily_send_limit, 1, 1000);
  }
  if ('start_hour' in patch) { const value = validHour(patch.start_hour); if (!value) return errorResult('INVALID_INPUT', 'start_hour inválido.'); schedule.startHour = value; }
  if ('end_hour' in patch) { const value = validHour(patch.end_hour); if (!value) return errorResult('INVALID_INPUT', 'end_hour inválido.'); schedule.endHour = value; }
  if ('allowed_weekdays' in patch) { const value = validWeekdays(patch.allowed_weekdays); if (!value) return errorResult('INVALID_INPUT', 'allowed_weekdays inválido.'); schedule.allowedWeekdays = value; }
  next.scheduling = schedule;
  if ('trigger_statuses' in patch) {
    if (!Array.isArray(patch.trigger_statuses) || patch.trigger_statuses.length > 20 || patch.trigger_statuses.some((item) => !text(item) || text(item).length > MAX_SHORT_TEXT_LENGTH)) return errorResult('INVALID_INPUT', 'trigger_statuses deve ser uma lista de até 20 status não vazios.');
    const { data: statuses, error } = await supabase.from('lead_status_config').select('nome,ativo').in('nome', patch.trigger_statuses.map(text));
    if (error || !statuses || statuses.length !== new Set(patch.trigger_statuses.map(text)).size || statuses.some((status) => status.ativo === false)) return errorResult('INVALID_STATUS', 'Um ou mais status de gatilho não existem ou estão inativos.');
    next.triggerStatuses = [...new Set(patch.trigger_statuses.map(text))];
  }
  const validatedFlow = await validateFlowFields(supabase, {
    nome: next.name,
    ativo: next.ativo,
    trigger_type: next.triggerType,
    trigger_statuses: next.triggerStatuses,
    trigger_duration_hours: next.triggerDurationHours,
    start_hour: schedule.startHour,
    end_hour: schedule.endHour,
    allowed_weekdays: schedule.allowedWeekdays,
    daily_send_limit: schedule.dailySendLimit ?? null,
  }, previous);
  if (validatedFlow.error || !validatedFlow.flow) return validatedFlow.error ?? errorResult('INVALID_INPUT', 'Configuração do fluxo inválida.');
  Object.assign(next, validatedFlow.flow);
  const steps = Array.isArray(previous.steps) ? previous.steps.filter(isRecord).map((step) => ({ ...step })) : [];
  const knownStepIds = new Set(steps.map((step) => text(step.id)));
  if ('enabled_step_ids' in patch) {
    if (!Array.isArray(patch.enabled_step_ids) || patch.enabled_step_ids.some((id) => typeof id !== 'string' || !knownStepIds.has(text(id))) || new Set(patch.enabled_step_ids.map(text)).size !== patch.enabled_step_ids.length) return errorResult('INVALID_INPUT', 'enabled_step_ids deve conter somente etapas existentes, sem duplicatas.');
    const enabled = new Set(patch.enabled_step_ids.map(text));
    steps.forEach((step) => { step.enabled = enabled.has(text(step.id)); });
  }
  if ('step_delays' in patch) {
    if (!Array.isArray(patch.step_delays) || patch.step_delays.length > steps.length) return errorResult('INVALID_INPUT', 'step_delays inválido.');
    const changedStepIds = new Set<string>();
    for (const change of patch.step_delays) {
      if (!isRecord(change) || Object.keys(change).some((key) => !['step_id', 'delay_value', 'delay_unit'].includes(key)) || typeof change.step_id !== 'string' || !knownStepIds.has(text(change.step_id)) || changedStepIds.has(text(change.step_id)) || boundedInteger(change.delay_value, 0, 3650) === null || !['seconds', 'minutes', 'hours', 'days'].includes(text(change.delay_unit))) return errorResult('INVALID_INPUT', 'Cada delay exige step_id existente, campos fechados, valor de 0 a 3650 e unidade válida; IDs repetidos não são aceitos.');
      changedStepIds.add(text(change.step_id));
      const step = steps.find((item) => text(item.id) === text(change.step_id));
      if (step) { step.delayValue = boundedInteger(change.delay_value, 0, 3650); step.delayUnit = text(change.delay_unit); }
    }
  }
  next.steps = steps;
  const flows = [...current.flows];
  flows[position] = next;
  const updated = { ...current, flows };
  const { error } = await supabase.from('integration_settings').update({ settings: updated, updated_at: new Date().toISOString() }).eq('id', integration.id);
  return error ? errorResult('INTERNAL_ERROR', 'Não foi possível atualizar o fluxo.') : { success: true, flow: flowView(next) };
}

async function updateLead(supabase: SupabaseClient, params: Record<string, unknown>, dryRun = false): Promise<McpWriteResult> {
  const leadId = text(params.lead_id);
  const changes = isRecord(params.changes) ? params.changes : null;
  if (!safeUuid(leadId) || !changes) return errorResult('INVALID_INPUT', 'Informe lead_id e changes.');
  const allowed = new Set(['nome_completo', 'email', 'telefone', 'cidade', 'cep', 'endereco', 'estado', 'regiao', 'canal', 'operadora_atual', 'observacoes', 'origem_id', 'responsavel_id']);
  if (Object.keys(changes).length === 0 || Object.keys(changes).some((key) => !allowed.has(key))) return errorResult('NOT_ALLOWED', 'changes contém campo não permitido.');
  if (!(await existingLead(supabase, leadId))) return errorResult('LEAD_NOT_FOUND', 'Lead não encontrado.');
  const update: Record<string, unknown> = {};
  for (const key of ['nome_completo', 'cidade', 'endereco', 'regiao', 'canal', 'operadora_atual'] as const) {
    if (key in changes) { const value = text(changes[key]); if (!value || value.length > MAX_SHORT_TEXT_LENGTH) return errorResult('INVALID_INPUT', `${key} inválido.`); update[key] = value; }
  }
  if ('observacoes' in changes) { const value = text(changes.observacoes); if (value.length > MAX_DESCRIPTION_LENGTH) return errorResult('INVALID_INPUT', 'observacoes excede o limite permitido.'); update.observacoes = value || null; }
  if ('email' in changes) { const value = text(changes.email); if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return errorResult('INVALID_INPUT', 'email inválido.'); update.email = value || null; }
  if ('telefone' in changes) { const value = text(changes.telefone); const digits = value.replace(/\D/g, ''); if (digits.length < 10 || digits.length > 13) return errorResult('INVALID_INPUT', 'telefone deve conter de 10 a 13 dígitos.'); update.telefone = value; }
  if ('cep' in changes) { const value = text(changes.cep).replace(/\D/g, ''); if (value.length !== 8) return errorResult('INVALID_INPUT', 'cep deve conter 8 dígitos.'); update.cep = value; }
  if ('estado' in changes) { const value = text(changes.estado).toUpperCase(); if (!/^[A-Z]{2}$/.test(value)) return errorResult('INVALID_INPUT', 'estado deve usar a UF com duas letras.'); update.estado = value; }
  if ('origem_id' in changes) { const id = text(changes.origem_id); const { data } = safeUuid(id) ? await supabase.from('lead_origens').select('id,ativo').eq('id', id).maybeSingle() : { data: null }; if (!data || data.ativo === false) return errorResult('INVALID_INPUT', 'origem_id não existe ou está inativo.'); update.origem_id = id; }
  if ('responsavel_id' in changes) { const id = text(changes.responsavel_id); const { data } = safeUuid(id) ? await supabase.from('lead_responsaveis').select('id,ativo').eq('id', id).maybeSingle() : { data: null }; if (!data || data.ativo === false) return errorResult('INVALID_ASSIGNEE', 'responsavel_id não existe ou está inativo.'); update.responsavel_id = id; }
  if (dryRun) return { success: true, dry_run: true, would_update: true, lead_id: leadId, changes: update };
  const { data, error } = await supabase.from('leads').update(update).eq('id', leadId).select('id,nome_completo,email,telefone,cidade,cep,endereco,estado,regiao,canal,operadora_atual,observacoes,origem_id,responsavel_id,updated_at').maybeSingle();
  return error || !data ? errorResult('INTERNAL_ERROR', 'Não foi possível atualizar os dados comerciais do lead.') : { success: true, lead: data, changed_fields: Object.keys(update) };
}

async function updateContractStatus(supabase: SupabaseClient, params: Record<string, unknown>, cancel = false): Promise<McpWriteResult> {
  const contractId = text(params.contract_id);
  const statusName = cancel ? 'Cancelado' : text(params.status);
  const expectedUpdatedAt = parseDate(params.expected_updated_at);
  if (!safeUuid(contractId) || !statusName || statusName.length > MAX_SHORT_TEXT_LENGTH || !expectedUpdatedAt) {
    return errorResult('INVALID_INPUT', 'Informe contract_id, status e expected_updated_at válido.');
  }
  const { data: current, error: currentError } = await supabase.from('contracts').select('id,codigo_contrato,status,updated_at').eq('id', contractId).maybeSingle();
  if (currentError) return errorResult('INTERNAL_ERROR', 'Não foi possível consultar o contrato.');
  if (!current) return errorResult('NOT_FOUND', 'Contrato não encontrado.');
  if (!current.updated_at || Date.parse(text(current.updated_at)) !== Date.parse(expectedUpdatedAt)) return errorResult('CONFLICT', 'O contrato mudou desde a última leitura. Recarregue antes de tentar novamente.');
  if (text(current.status) === statusName) return { success: true, contract_id: contractId, status_anterior: statusName, status_novo: statusName, unchanged: true };
  if (['Cancelado', 'Encerrado'].includes(text(current.status))) return errorResult('NOT_ALLOWED', 'Contratos cancelados ou encerrados não podem ser reabertos ou alterados para outro estado.');
  const { data: configuredStatus, error: statusError } = await supabase.from('contract_status_config').select('value,ativo').eq('value', statusName).maybeSingle();
  if (statusError || !configuredStatus || configuredStatus.ativo === false) return errorResult('INVALID_STATUS', 'Status de contrato inexistente ou inativo.');
  const updatedAt = new Date(Math.max(Date.now(), Date.parse(text(current.updated_at)) + 1)).toISOString();
  const updateQuery = supabase.from('contracts').update({ status: configuredStatus.value, updated_at: updatedAt }).eq('id', contractId).eq('updated_at', current.updated_at);
  const { data, error } = await updateQuery.select('id,codigo_contrato,status,updated_at').maybeSingle();
  return error || !data
    ? errorResult('CONFLICT', 'O contrato mudou durante a atualização. Recarregue e tente novamente.')
    : { success: true, contract_id: contractId, codigo_contrato: data.codigo_contrato, status_anterior: current.status, status_novo: data.status, updated_at: data.updated_at, ...(cancel ? { cancelled: true } : {}) };
}

const leadIdsFrom = (value: unknown): string[] | null => {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_BULK_LEAD_MUTATIONS) return null;
  const ids = value.map(text);
  if (ids.some((id) => !safeUuid(id)) || new Set(ids).size !== ids.length) return null;
  return ids;
};

const compactBulkItem = (leadId: string, result: McpWriteResult): Record<string, unknown> => {
  if (result.success !== true) return { lead_id: leadId, success: false, error_code: result.error_code ?? 'INTERNAL_ERROR', message: result.message ?? 'Falha ao processar o lead.' };
  return {
    lead_id: leadId,
    success: true,
    ...(result.unchanged === true ? { unchanged: true } : {}),
    ...(result.would_update === true ? { would_update: true } : {}),
    ...(result.would_archive === true ? { would_archive: true } : {}),
    ...(result.would_enqueue === true ? { would_enqueue: true, scheduled_at: result.scheduled_at } : {}),
    ...(Array.isArray(result.changed_fields) ? { changed_fields: result.changed_fields } : {}),
    ...(typeof result.status_novo === 'string' ? { status_novo: result.status_novo } : {}),
    ...(result.duplicate === true ? { duplicate: true } : {}),
    ...(result.job && isRecord(result.job) ? { job_id: text(result.job.id) || null } : {}),
  };
};

async function archiveLead(supabase: SupabaseClient, leadId: string, dryRun: boolean): Promise<McpWriteResult> {
  const { data: lead, error: lookupError } = await supabase.from('leads').select('id,arquivado').eq('id', leadId).maybeSingle();
  if (lookupError) return errorResult('INTERNAL_ERROR', 'Não foi possível consultar o lead.');
  if (!lead) return errorResult('LEAD_NOT_FOUND', 'Lead não encontrado.');
  if (lead.arquivado === true) return { success: true, lead_id: leadId, unchanged: true };
  if (dryRun) return { success: true, dry_run: true, would_archive: true, lead_id: leadId };
  const { data, error } = await supabase.from('leads').update({ arquivado: true }).eq('id', leadId).select('id,arquivado').maybeSingle();
  return error || !data ? errorResult('INTERNAL_ERROR', 'Não foi possível arquivar o lead.') : { success: true, lead_id: leadId, archived: true };
}

async function deterministicJobId(actorId: string, requestId: string, leadId: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`kifer-mcp-followup:${actorId}:${requestId}:${leadId}`));
  const bytes = new Uint8Array(digest).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function runBulkLeadMutation(params: {
  supabase: SupabaseClient;
  toolName: string;
  args: Record<string, unknown>;
  actor: McpWriteActor;
}): Promise<McpWriteResult> {
  const { supabase, toolName, args, actor } = params;
  const leadIds = leadIdsFrom(args.lead_ids);
  const dryRun = args.dry_run === true;
  if (!leadIds) return errorResult('INVALID_INPUT', `lead_ids deve conter entre 1 e ${MAX_BULK_LEAD_MUTATIONS} UUIDs únicos válidos.`);
  if (toolName === 'kifer_bulk_update_leads' && !isRecord(args.changes)) return errorResult('INVALID_INPUT', 'Informe changes.');
  if (toolName === 'kifer_bulk_assign_leads' && !safeUuid(text(args.responsavel_id))) return errorResult('INVALID_INPUT', 'responsavel_id inválido.');
  if (toolName === 'kifer_bulk_update_lead_status' && !text(args.status)) return errorResult('INVALID_INPUT', 'Informe status.');
  if (toolName === 'kifer_bulk_enqueue_followup') {
    const requestId = text(args.client_request_id);
    if (!text(args.flow_id) || requestId.length < 1 || requestId.length > 128) return errorResult('INVALID_INPUT', 'Informe flow_id e client_request_id estável (1 a 128 caracteres).');
  }

  const items: Record<string, unknown>[] = [];
  for (const leadId of leadIds) {
    let itemResult: McpWriteResult;
    try {
      if (toolName === 'kifer_bulk_update_leads') itemResult = await updateLead(supabase, { lead_id: leadId, changes: args.changes }, dryRun);
      else if (toolName === 'kifer_bulk_assign_leads') itemResult = await updateLead(supabase, { lead_id: leadId, changes: { responsavel_id: args.responsavel_id } }, dryRun);
      else if (toolName === 'kifer_bulk_update_lead_status') itemResult = await updateLeadStatus(supabase, { lead_id: leadId, status: args.status, observacao: args.observacao }, actor, dryRun);
      else if (toolName === 'kifer_bulk_archive_leads') itemResult = await archiveLead(supabase, leadId, dryRun);
      else if (toolName === 'kifer_bulk_enqueue_followup') itemResult = await enqueueLeadFollowUp(supabase, { lead_id: leadId, flow_id: args.flow_id, scheduled_at: args.scheduled_at, observacao: args.observacao, client_request_id: args.client_request_id }, dryRun, actor);
      else return errorResult('NOT_ALLOWED', 'Ação em lote não permitida.');
    } catch {
      console.error('[chatgpt-mcp] falha isolada em ação em lote de leads.');
      itemResult = errorResult('INTERNAL_ERROR', 'Falha inesperada ao processar este lead.');
    }
    items.push(compactBulkItem(leadId, itemResult));
  }

  const succeeded = items.filter((item) => item.success === true).length;
  const failed = items.length - succeeded;
  return {
    success: failed === 0,
    partial: succeeded > 0 && failed > 0,
    dry_run: dryRun,
    requested_count: leadIds.length,
    succeeded_count: succeeded,
    failed_count: failed,
    results: items,
  };
}

async function updateReminderAction(supabase: SupabaseClient, params: Record<string, unknown>, mode: 'update' | 'complete' | 'cancel'): Promise<McpWriteResult> {
  const reminderId = text(params.reminder_id);
  if (!safeUuid(reminderId)) return errorResult('INVALID_INPUT', 'reminder_id inválido.');
  const { data: current, error: lookupError } = await supabase.from('reminders').select('id,lead_id,lido').eq('id', reminderId).maybeSingle();
  if (lookupError || !current) return errorResult('NOT_FOUND', 'Lembrete não encontrado.');
  const update: Record<string, unknown> = {};
  if (mode === 'update') {
    const changes = isRecord(params.changes) ? params.changes : null;
    if (!changes || Object.keys(changes).length === 0 || Object.keys(changes).some((key) => !['titulo', 'descricao', 'data_lembrete', 'prioridade'].includes(key))) return errorResult('NOT_ALLOWED', 'changes deve conter apenas título, descrição, data ou prioridade.');
    if ('titulo' in changes) { const value = text(changes.titulo); if (!value || value.length > MAX_SHORT_TEXT_LENGTH) return errorResult('INVALID_INPUT', 'titulo inválido.'); update.titulo = value; }
    if ('descricao' in changes) { const value = text(changes.descricao); if (value.length > MAX_DESCRIPTION_LENGTH) return errorResult('INVALID_INPUT', 'descricao excede o limite.'); update.descricao = value || null; }
    if ('data_lembrete' in changes) { const value = parseDate(changes.data_lembrete); if (!value) return errorResult('INVALID_INPUT', 'data_lembrete inválida.'); update.data_lembrete = value; }
    if ('prioridade' in changes) { const value = text(changes.prioridade); if (!PRIORITIES.has(value)) return errorResult('INVALID_INPUT', 'prioridade inválida.'); update.prioridade = value; }
  } else {
    if (current.lido === true) return { success: true, reminder_id: reminderId, unchanged: true, state: mode === 'cancel' ? 'cancelled' : 'completed' };
    update.lido = true;
    update.concluido_em = new Date().toISOString();
    if (mode === 'cancel') {
      const reason = text(params.observacao).slice(0, MAX_DESCRIPTION_LENGTH);
      update.cancelled_at = new Date().toISOString();
      update.cancelled_by = 'chatgpt_mcp';
      update.cancellation_reason = reason || null;
    }
  }
  const { data, error } = await supabase.from('reminders').update(update).eq('id', reminderId).select('*').maybeSingle();
  if (error || !data) return errorResult('INTERNAL_ERROR', 'Não foi possível alterar o lembrete.');
  const nextReturn = current.lead_id ? await syncNextReturn(supabase, current.lead_id) : null;
  return { success: true, reminder: data, proximo_retorno: nextReturn, state: mode === 'update' ? 'updated' : mode === 'cancel' ? 'cancelled' : 'completed' };
}

const firstStepSchedule = (step: Record<string, unknown>, requestedAt: string | null) => {
  if (requestedAt) return requestedAt;
  const value = boundedInteger(step.delayValue, 0, 3650) ?? 0;
  const unit = text(step.delayUnit);
  const multiplier = unit === 'days' ? 86_400_000 : unit === 'hours' ? 3_600_000 : unit === 'minutes' ? 60_000 : 1_000;
  return new Date(Date.now() + value * multiplier).toISOString();
};

async function enqueueLeadFollowUp(supabase: SupabaseClient, params: Record<string, unknown>, dryRun = false, actor: McpWriteActor | null = null): Promise<McpWriteResult> {
  const leadId = text(params.lead_id);
  const flowId = text(params.flow_id);
  const scheduledAt = params.scheduled_at === undefined ? null : parseDate(params.scheduled_at);
  if (!safeUuid(leadId) || !flowId || (params.scheduled_at !== undefined && !scheduledAt)) return errorResult('INVALID_INPUT', 'Informe lead_id, flow_id e scheduled_at válido quando preenchido.');
  const clientRequestId = params.client_request_id === undefined ? '' : text(params.client_request_id);
  if (params.client_request_id !== undefined && (!clientRequestId || clientRequestId.length > 128 || !actor)) return errorResult('INVALID_INPUT', 'client_request_id deve ter de 1 a 128 caracteres.');
  const lead = await existingLead(supabase, leadId);
  if (!lead) return errorResult('LEAD_NOT_FOUND', 'Lead não encontrado.');
  const integration = await loadAutomationIntegration(supabase);
  const settings = automationSettings(integration?.settings);
  const flow = settings?.flows?.map(flowRecord).find((candidate) => candidate?.id === flowId) ?? null;
  if (!flow || flow.ativo === false) return errorResult('NOT_FOUND', 'Fluxo não encontrado ou está pausado.');
  const steps = Array.isArray(flow.steps) ? flow.steps.filter(isRecord).filter((step) => step.enabled !== false) : [];
  const first = steps[0];
  if (!first || !text(first.id) || !text(first.actionType)) return errorResult('INVALID_INPUT', 'O fluxo não possui uma primeira etapa ativa válida.');
  const jobId = clientRequestId && actor ? await deterministicJobId(actor.actorId, clientRequestId, leadId) : null;
  const requestSignature = JSON.stringify({ lead_id: leadId, flow_id: flowId, scheduled_at: scheduledAt, observacao: text(params.observacao) });
  if (jobId) {
    const { data: priorRequest, error: priorRequestError } = await supabase.from('auto_contact_flow_jobs').select('id,lead_id,flow_id,scheduled_at,action_payload').eq('id', jobId).maybeSingle();
    if (priorRequestError) throw new Error(priorRequestError.message);
    if (priorRequest) {
      const payload = isRecord(priorRequest.action_payload) ? priorRequest.action_payload : {};
      if (payload.mcp_request_signature !== requestSignature) return errorResult('IDEMPOTENCY_CONFLICT', 'client_request_id já foi usado com parâmetros diferentes.');
      return { success: true, duplicate: true, job: priorRequest, message: 'A solicitação já foi processada.' };
    }
  }
  const { data: activeJob, error: duplicateError } = await supabase.from('auto_contact_flow_jobs').select('id,status,scheduled_at').eq('lead_id', leadId).eq('flow_id', flowId).in('status', ['pending', 'processing']).limit(1).maybeSingle();
  if (duplicateError) throw new Error(duplicateError.message);
  if (activeJob) return { success: true, duplicate: true, job: activeJob, message: 'O lead já possui um job ativo neste fluxo.' };
  const observation = text(params.observacao).slice(0, MAX_DESCRIPTION_LENGTH);
  const actionPayload: Record<string, unknown> = observation ? { mcp_observacao: observation, mcp_source: 'chatgpt_mcp' } : { mcp_source: 'chatgpt_mcp' };
  if (jobId) {
    actionPayload.mcp_request_signature = requestSignature;
    actionPayload.mcp_client_request_id = clientRequestId;
  }
  if (text(first.actionType) === 'send_message' && Array.isArray(first.messages)) actionPayload.messages = first.messages;
  const jobScheduledAt = firstStepSchedule(first, scheduledAt);
  if (dryRun) return { success: true, dry_run: true, would_enqueue: true, lead_id: leadId, flow_id: flowId, step_id: text(first.id), scheduled_at: jobScheduledAt, action_type: text(first.actionType) };
  const { data, error } = await supabase.from('auto_contact_flow_jobs').insert({
    ...(jobId ? { id: jobId } : {}),
    lead_id: leadId,
    flow_id: flowId,
    step_id: text(first.id),
    step_order: 0,
    action_type: text(first.actionType),
    message_source: text(first.messageSource) || null,
    template_id: text(first.templateId) || null,
    custom_message: isRecord(first.customMessage) ? first.customMessage : null,
    status_to_set: text(first.statusToSet) || null,
    action_payload: actionPayload,
    scheduled_at: jobScheduledAt,
    status: 'pending',
  }).select('*').maybeSingle();
  if (error && jobId) {
    const { data: racedRequest, error: racedLookupError } = await supabase.from('auto_contact_flow_jobs').select('id,lead_id,flow_id,scheduled_at,action_payload').eq('id', jobId).maybeSingle();
    if (!racedLookupError && racedRequest) {
      const payload = isRecord(racedRequest.action_payload) ? racedRequest.action_payload : {};
      if (payload.mcp_request_signature !== requestSignature) return errorResult('IDEMPOTENCY_CONFLICT', 'client_request_id já foi usado com parâmetros diferentes.');
      return { success: true, duplicate: true, job: racedRequest, message: 'A solicitação já foi processada.' };
    }
  }
  return error || !data ? errorResult('INTERNAL_ERROR', 'Não foi possível inserir o lead no fluxo.') : { success: true, job: data };
}

async function removeLeadFromFollowUp(supabase: SupabaseClient, params: Record<string, unknown>): Promise<McpWriteResult> {
  const leadId = text(params.lead_id);
  const flowId = text(params.flow_id);
  if (!safeUuid(leadId) || !flowId) return errorResult('INVALID_INPUT', 'Informe lead_id e flow_id.');
  if (!(await existingLead(supabase, leadId))) return errorResult('LEAD_NOT_FOUND', 'Lead não encontrado.');
  const reason = text(params.observacao).slice(0, MAX_DESCRIPTION_LENGTH) || 'Removido do fluxo via ChatGPT.';
  const { data, error } = await supabase.from('auto_contact_flow_jobs').update({ status: 'skipped', last_error: reason }).eq('lead_id', leadId).eq('flow_id', flowId).eq('status', 'pending').select('id');
  return error ? errorResult('INTERNAL_ERROR', 'Não foi possível cancelar os jobs futuros do fluxo.') : { success: true, lead_id: leadId, flow_id: flowId, cancelled_jobs: data?.length ?? 0 };
}

async function changeAutomationJob(supabase: SupabaseClient, params: Record<string, unknown>, action: 'cancel' | 'retry'): Promise<McpWriteResult> {
  const jobId = text(params.job_id);
  if (!safeUuid(jobId)) return errorResult('INVALID_INPUT', 'job_id inválido.');
  const { data: job, error: lookupError } = await supabase.from('auto_contact_flow_jobs').select('id,status,attempts,scheduled_at').eq('id', jobId).maybeSingle();
  if (lookupError || !job) return errorResult('NOT_FOUND', 'Job de automação não encontrado.');
  if (action === 'cancel') {
    if (job.status !== 'pending') return errorResult('NOT_ALLOWED', 'Apenas jobs pendentes podem ser cancelados.');
    const reason = text(params.observacao).slice(0, MAX_DESCRIPTION_LENGTH) || 'Cancelado via ChatGPT.';
    const { error } = await supabase.from('auto_contact_flow_jobs').update({ status: 'skipped', last_error: reason }).eq('id', jobId).eq('status', 'pending');
    return error ? errorResult('INTERNAL_ERROR', 'Não foi possível cancelar o job.') : { success: true, job_id: jobId, status: 'skipped' };
  }
  if (job.status === 'completed') return errorResult('JOB_ALREADY_EXECUTED', 'Um job concluído não pode ser reprocessado, para evitar duplicidade.');
  if (job.status !== 'failed' && job.status !== 'skipped') return errorResult('NOT_ALLOWED', 'Somente jobs falhos ou ignorados podem ser reprocessados.');
  const requested = params.scheduled_at === undefined ? new Date().toISOString() : parseDate(params.scheduled_at);
  if (!requested) return errorResult('INVALID_INPUT', 'scheduled_at inválido.');
  const { error } = await supabase.from('auto_contact_flow_jobs').update({ status: 'pending', scheduled_at: requested, last_error: null }).eq('id', jobId).in('status', ['failed', 'skipped']);
  return error ? errorResult('INTERNAL_ERROR', 'Não foi possível reprocessar o job.') : { success: true, job_id: jobId, status: 'pending', scheduled_at: requested };
}

async function bulkCancelAutomationJobs(supabase: SupabaseClient, params: Record<string, unknown>): Promise<McpWriteResult> {
  const flowId = text(params.flow_id);
  const status = text(params.status);
  const stepId = text(params.step_id);
  const scheduledBefore = params.scheduled_before === undefined ? null : parseDate(params.scheduled_before);
  const scheduledAfter = params.scheduled_after === undefined ? null : parseDate(params.scheduled_after);
  if (!flowId && !status && !stepId && params.scheduled_before === undefined && params.scheduled_after === undefined) {
    return errorResult('INVALID_INPUT', 'Informe ao menos um filtro para evitar cancelamento acidental da fila inteira.');
  }
  if ((params.scheduled_before !== undefined && !scheduledBefore) || (params.scheduled_after !== undefined && !scheduledAfter)) return errorResult('INVALID_INPUT', 'Os filtros de data devem ser datetimes válidos.');
  if (scheduledBefore && scheduledAfter && scheduledAfter > scheduledBefore) return errorResult('INVALID_INPUT', 'scheduled_after deve ser anterior a scheduled_before.');
  let query = supabase.from('auto_contact_flow_jobs').select('id,status');
  if (flowId) query = query.eq('flow_id', flowId);
  if (status) query = query.eq('status', status);
  if (stepId) query = query.eq('step_id', stepId);
  if (scheduledBefore) query = query.lte('scheduled_at', scheduledBefore);
  if (scheduledAfter) query = query.gte('scheduled_at', scheduledAfter);
  const { data, error } = await query.limit(MAX_BULK_CANCEL_JOBS + 1);
  if (error) return errorResult('INTERNAL_ERROR', 'Não foi possível consultar os jobs para cancelamento.');
  if ((data?.length ?? 0) > MAX_BULK_CANCEL_JOBS) return errorResult('LIMIT_EXCEEDED', `A seleção ultrapassa o limite de ${MAX_BULK_CANCEL_JOBS} jobs por chamada.`);
  const rows = data ?? [];
  const pendingIds = rows.filter((job) => job.status === 'pending').map((job) => job.id);
  const skipped = rows.filter((job) => job.status !== 'pending').map((job) => ({ job_id: job.id, reason: 'Somente jobs pending podem ser cancelados.' }));
  if (pendingIds.length === 0) return { success: true, matched: rows.length, cancelled: 0, skipped, errors: [] };
  const reason = text(params.observacao).slice(0, MAX_DESCRIPTION_LENGTH) || 'Cancelamento em lote via ChatGPT.';
  const { data: cancelledRows, error: updateError } = await supabase.from('auto_contact_flow_jobs').update({ status: 'skipped', last_error: reason }).in('id', pendingIds).eq('status', 'pending').select('id');
  if (updateError) return { success: false, error_code: 'INTERNAL_ERROR', message: 'Não foi possível cancelar os jobs pendentes.', matched: rows.length, cancelled: 0, skipped, errors: [{ message: updateError.message }] };
  const cancelledIds = new Set((cancelledRows ?? []).map((job) => job.id));
  const errors = pendingIds.filter((id) => !cancelledIds.has(id)).map((jobId) => ({ job_id: jobId, message: 'O job mudou de estado antes do cancelamento.' }));
  return { success: true, matched: rows.length, cancelled: cancelledIds.size, skipped, errors };
}

async function createFollowUpFlow(supabase: SupabaseClient, params: Record<string, unknown>): Promise<McpWriteResult> {
  const integration = await loadAutomationIntegration(supabase);
  const settings = automationSettings(integration?.settings);
  if (!integration || !settings || !Array.isArray(settings.flows)) return errorResult('NOT_FOUND', 'Configuração de automação não encontrada.');
  const validated = await validateFlowFields(supabase, params);
  if (validated.error || !validated.flow) return validated.error ?? errorResult('INVALID_INPUT', 'Dados do fluxo inválidos.');
  if (settings.flows.map(flowRecord).some((flow) => flow && text(flow.name).toLocaleLowerCase() === text(validated.flow?.name).toLocaleLowerCase())) return errorResult('CONFLICT', 'Já existe um fluxo com este nome.');
  const flow = { id: crypto.randomUUID(), ...validated.flow, steps: [] as Record<string, unknown>[] };
  const updated = { ...settings, flows: [...settings.flows, flow] };
  const { error } = await supabase.from('integration_settings').update({ settings: updated, updated_at: new Date().toISOString() }).eq('id', integration.id);
  return error ? errorResult('INTERNAL_ERROR', 'Não foi possível criar o fluxo.') : { success: true, flow: flowView(flow) };
}

async function resolveStepActionConfiguration(supabase: SupabaseClient, actionType: string, value: unknown): Promise<{ configuration?: Record<string, unknown>; error?: McpWriteResult }> {
  const config = isRecord(value) ? value : {};
  if (actionType === 'send_message') {
    if (Object.keys(config).some((key) => key !== 'message')) return { error: errorResult('NOT_ALLOWED', 'send_message aceita somente o texto comercial da mensagem.') };
    const message = text(config.message);
    if (!message) return { error: errorResult('INVALID_INPUT', 'A etapa send_message exige uma mensagem não vazia.') };
    if (message.length > MAX_MESSAGE_LENGTH) return { error: errorResult('MESSAGE_TOO_LONG', `A mensagem excede o limite de ${MAX_MESSAGE_LENGTH} caracteres.`) };
    return { configuration: { messageSource: 'custom', customMessage: { type: 'text', text: message } } };
  }
  if (actionType === 'update_status') {
    if (Object.keys(config).some((key) => key !== 'status')) return { error: errorResult('NOT_ALLOWED', 'update_status aceita somente um status comercial válido.') };
    const statusName = text(config.status);
    const { data, error } = await supabase.from('lead_status_config').select('nome,ativo').ilike('nome', statusName).maybeSingle();
    if (error || !data || data.ativo === false) return { error: errorResult('INVALID_STATUS', 'O status não existe ou está inativo.') };
    return { configuration: { statusToSet: data.nome } };
  }
  if (actionType === 'create_task') {
    if (Object.keys(config).some((key) => !['title', 'description', 'priority', 'due_hours'].includes(key))) return { error: errorResult('NOT_ALLOWED', 'create_task aceita somente título, descrição, prioridade e prazo.') };
    const title = text(config.title).slice(0, MAX_SHORT_TEXT_LENGTH);
    const description = text(config.description).slice(0, MAX_DESCRIPTION_LENGTH);
    const priority = text(config.priority) || 'normal';
    const dueHours = config.due_hours === undefined ? null : boundedInteger(config.due_hours, 0, 8760);
    if (!title || !PRIORITIES.has(priority) || (config.due_hours !== undefined && dueHours === null)) return { error: errorResult('INVALID_INPUT', 'create_task exige título, prioridade válida e prazo entre 0 e 8760 horas.') };
    return { configuration: { taskTitle: title, taskDescription: description, taskPriority: priority, taskDueHours: dueHours } };
  }
  if (actionType === 'activate_autonomous_service') {
    if (Object.keys(config).length > 0) return { error: errorResult('NOT_ALLOWED', 'activate_autonomous_service não aceita configuração adicional.') };
    return { configuration: {} };
  }
  return { error: errorResult('NOT_ALLOWED', 'Este tipo de ação não é permitido para criação via MCP.') };
}

async function createFollowUpStep(supabase: SupabaseClient, params: Record<string, unknown>): Promise<McpWriteResult> {
  const flowId = text(params.flow_id);
  const order = boundedInteger(params.ordem, 0, 100);
  const actionType = text(params.action_type);
  const delayValue = boundedInteger(params.delay_value, 0, 3650);
  const delayUnit = text(params.delay_unit);
  const enabled = params.enabled;
  if (!flowId || order === null || !STEP_ACTION_TYPES.has(actionType) || delayValue === null || !DELAY_UNITS.has(delayUnit) || typeof enabled !== 'boolean') return errorResult('INVALID_INPUT', 'flow_id, ordem, action_type, delay, unidade e enabled são obrigatórios e devem ser válidos.');
  const integration = await loadAutomationIntegration(supabase); const settings = automationSettings(integration?.settings);
  if (!integration || !settings || !Array.isArray(settings.flows)) return errorResult('NOT_FOUND', 'Configuração de automação não encontrada.');
  const index = settings.flows.findIndex((flow) => flowRecord(flow)?.id === flowId); const flow = flowRecord(settings.flows[index]);
  if (!flow) return errorResult('NOT_FOUND', 'Fluxo não encontrado.');
  const steps = Array.isArray(flow.steps) ? flow.steps.filter(isRecord).map((step) => ({ ...step })) : [];
  if (order > steps.length) return errorResult('INVALID_INPUT', 'ordem deve estar entre 0 e a próxima posição disponível.');
  if (order < steps.length) {
    const { count, error } = await supabase.from('auto_contact_flow_jobs').select('id', { count: 'exact', head: true }).eq('flow_id', flowId).in('status', ['pending', 'processing']);
    if (error) return errorResult('INTERNAL_ERROR', 'Não foi possível verificar jobs ativos do fluxo.');
    if ((count ?? 0) > 0) return errorResult('CONFLICT', 'Não é possível inserir uma etapa no meio de um fluxo com jobs ativos. Adicione ao final ou pause/remova os jobs primeiro.');
  }
  const action = await resolveStepActionConfiguration(supabase, actionType, params.action_config);
  if (action.error || !action.configuration) return action.error ?? errorResult('INVALID_INPUT', 'Configuração da ação inválida.');
  const step = { id: crypto.randomUUID(), delayValue, delayUnit, actionType, enabled, ...action.configuration };
  steps.splice(order, 0, step);
  const nextFlow = { ...flow, steps }; const flows = [...settings.flows]; flows[index] = nextFlow;
  const { error } = await supabase.from('integration_settings').update({ settings: { ...settings, flows }, updated_at: new Date().toISOString() }).eq('id', integration.id);
  return error ? errorResult('INTERNAL_ERROR', 'Não foi possível criar a etapa.') : { success: true, flow_id: flowId, step: flowView(nextFlow).steps[order] };
}

async function updateFollowUpStepMessage(supabase: SupabaseClient, params: Record<string, unknown>): Promise<McpWriteResult> {
  const flowId = text(params.flow_id); const stepId = text(params.step_id); const message = text(params.message);
  if (!flowId || !stepId || !message) return errorResult('INVALID_INPUT', 'flow_id, step_id e message são obrigatórios.');
  if (message.length > MAX_MESSAGE_LENGTH) return errorResult('MESSAGE_TOO_LONG', `A mensagem excede o limite de ${MAX_MESSAGE_LENGTH} caracteres.`);
  const integration = await loadAutomationIntegration(supabase); const settings = automationSettings(integration?.settings);
  if (!integration || !settings || !Array.isArray(settings.flows)) return errorResult('NOT_FOUND', 'Configuração de automação não encontrada.');
  const index = settings.flows.findIndex((flow) => flowRecord(flow)?.id === flowId); const flow = flowRecord(settings.flows[index]);
  if (!flow) return errorResult('NOT_FOUND', 'Fluxo não encontrado.');
  const steps = Array.isArray(flow.steps) ? flow.steps.filter(isRecord).map((step) => ({ ...step })) : [];
  const step = steps.find((candidate) => text(candidate.id) === stepId);
  if (!step) return errorResult('NOT_FOUND', 'Etapa não encontrada.');
  if (text(step.actionType) !== 'send_message') return errorResult('NOT_ALLOWED', 'Somente etapas send_message podem ter o texto alterado.');
  step.messageSource = 'custom';
  step.customMessage = { type: 'text', text: message };
  delete step.templateId;
  delete step.messages;
  const nextFlow = { ...flow, steps }; const flows = [...settings.flows]; flows[index] = nextFlow;
  const { error } = await supabase.from('integration_settings').update({ settings: { ...settings, flows }, updated_at: new Date().toISOString() }).eq('id', integration.id);
  return error ? errorResult('INTERNAL_ERROR', 'Não foi possível atualizar a mensagem da etapa.') : { success: true, flow_id: flowId, step_id: stepId, message };
}

async function mutateFollowUpSteps(supabase: SupabaseClient, params: Record<string, unknown>, mode: 'delete' | 'reorder'): Promise<McpWriteResult> {
  const flowId = text(params.flow_id);
  if (!flowId) return errorResult('INVALID_INPUT', 'flow_id é obrigatório.');
  const integration = await loadAutomationIntegration(supabase);
  const settings = automationSettings(integration?.settings);
  if (!integration || !settings || !Array.isArray(settings.flows)) return errorResult('NOT_FOUND', 'Configuração de automação não encontrada.');
  const flowIndex = settings.flows.findIndex((candidate) => flowRecord(candidate)?.id === flowId);
  const flow = flowRecord(settings.flows[flowIndex]);
  if (!flow) return errorResult('NOT_FOUND', 'Fluxo não encontrado.');
  const steps = Array.isArray(flow.steps) ? flow.steps.filter(isRecord).map((step) => ({ ...step })) : [];
  let updatedSteps: Record<string, unknown>[];
  let stepId: string | null = null;

  if (mode === 'delete') {
    stepId = text(params.step_id);
    if (!stepId) return errorResult('INVALID_INPUT', 'step_id é obrigatório.');
    const index = steps.findIndex((step) => text(step.id) === stepId);
    if (index < 0) return errorResult('NOT_FOUND', 'Etapa não encontrada.');
    updatedSteps = steps.filter((step) => text(step.id) !== stepId);
  } else {
    const orderedIds = params.step_ids;
    const currentIds = steps.map((step) => text(step.id));
    if (!Array.isArray(orderedIds) || orderedIds.length !== currentIds.length || orderedIds.some((id) => typeof id !== 'string' || !text(id))) {
      return errorResult('INVALID_INPUT', 'step_ids deve listar cada etapa existente exatamente uma vez.');
    }
    const requestedIds = orderedIds.map(text);
    if (new Set(requestedIds).size !== currentIds.length || requestedIds.some((id) => !currentIds.includes(id))) {
      return errorResult('INVALID_INPUT', 'step_ids deve listar cada etapa existente exatamente uma vez.');
    }
    updatedSteps = requestedIds.map((id) => steps.find((step) => text(step.id) === id)!);
    if (requestedIds.every((id, index) => id === currentIds[index])) {
      return { success: true, flow_id: flowId, unchanged: true, steps: flowView(flow).steps };
    }
  }

  const { count, error: jobsError } = await supabase.from('auto_contact_flow_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('flow_id', flowId)
    .in('status', ['pending', 'processing']);
  if (jobsError) return errorResult('INTERNAL_ERROR', 'Não foi possível verificar jobs ativos do fluxo.');
  if ((count ?? 0) > 0) return errorResult('CONFLICT', 'Pause ou esvazie os jobs ativos deste fluxo antes de alterar as etapas.');

  const updatedFlow = { ...flow, steps: updatedSteps };
  const flows = [...settings.flows];
  flows[flowIndex] = updatedFlow;
  const { error } = await supabase.from('integration_settings')
    .update({ settings: { ...settings, flows }, updated_at: new Date().toISOString() })
    .eq('id', integration.id);
  if (error) return errorResult('INTERNAL_ERROR', mode === 'delete' ? 'Não foi possível remover a etapa.' : 'Não foi possível reordenar as etapas.');
  return {
    success: true,
    flow_id: flowId,
    ...(mode === 'delete' ? { step_id: stepId, deleted: true } : { reordered: true }),
    steps: flowView(updatedFlow).steps,
  };
}

async function cloneFollowUpFlow(supabase: SupabaseClient, params: Record<string, unknown>): Promise<McpWriteResult> {
  const sourceFlowId = text(params.source_flow_id); const overrides = isRecord(params.overrides) ? params.overrides : {};
  const allowed = new Set(['nome', 'ativo', 'trigger_type', 'trigger_statuses', 'trigger_duration_hours', 'start_hour', 'end_hour', 'allowed_weekdays', 'daily_send_limit']);
  if (!sourceFlowId || Object.keys(overrides).some((key) => !allowed.has(key))) return errorResult('INVALID_INPUT', 'source_flow_id e overrides com campos permitidos são obrigatórios.');
  if (!text(overrides.nome)) return errorResult('INVALID_INPUT', 'O clone exige um novo nome.');
  const integration = await loadAutomationIntegration(supabase); const settings = automationSettings(integration?.settings);
  if (!integration || !settings || !Array.isArray(settings.flows)) return errorResult('NOT_FOUND', 'Configuração de automação não encontrada.');
  const source = settings.flows.map(flowRecord).find((flow) => flow?.id === sourceFlowId) ?? null;
  if (!source) return errorResult('NOT_FOUND', 'Fluxo de origem não encontrado.');
  const validated = await validateFlowFields(supabase, overrides, source);
  if (validated.error || !validated.flow) return validated.error ?? errorResult('INVALID_INPUT', 'Dados do clone inválidos.');
  if (settings.flows.map(flowRecord).some((flow) => flow && text(flow.name).toLocaleLowerCase() === text(validated.flow?.name).toLocaleLowerCase())) return errorResult('CONFLICT', 'Já existe um fluxo com este nome.');
  const sourceSteps = Array.isArray(source.steps) ? source.steps.filter(isRecord) : [];
  if (sourceSteps.some((step) => !STEP_ACTION_TYPES.has(text(step.actionType)))) return errorResult('NOT_ALLOWED', 'O fluxo de origem possui uma etapa que não é permitida para clonagem via MCP.');
  const steps = sourceSteps.map((step) => ({ ...step, id: crypto.randomUUID() }));
  const flow = { ...source, ...validated.flow, id: crypto.randomUUID(), steps };
  delete flow.flowGraph;
  const updated = { ...settings, flows: [...settings.flows, flow] };
  const { error } = await supabase.from('integration_settings').update({ settings: updated, updated_at: new Date().toISOString() }).eq('id', integration.id);
  return error ? errorResult('INTERNAL_ERROR', 'Não foi possível clonar o fluxo.') : { success: true, source_flow_id: sourceFlowId, flow: flowView(flow) };
}

const pageParams = (params: Record<string, unknown>) => {
  const page = boundedInteger(params.page ?? 1, 1, 10_000) ?? 1;
  const pageSize = boundedInteger(params.page_size ?? 20, 1, 50) ?? 20;
  return { page, pageSize, from: (page - 1) * pageSize };
};

const LEADS_WITHOUT_CHAT_ORDER_FIELDS = new Set(['created_at', 'ultimo_contato', 'nome_completo']);
const LEADS_WITHOUT_CHAT_SELECT = 'id,nome_completo,telefone,email,status,cidade,estado,data_criacao,created_at,ultimo_contato,ultima_tentativa_reativacao,numero_tentativas_reativacao,reativacao_habilitada,arquivado,linked_chats:comm_whatsapp_chats!comm_whatsapp_chats_lead_id_fkey()';

type LeadsWithoutChatFilters = {
  status: string | null;
  reactivationEnabled: boolean | null;
  archived: boolean | null;
  hasPhone: boolean | null;
  reactivationAttemptIsNull: boolean | null;
  createdFrom: string | null;
  createdTo: string | null;
  lastContactFrom: string | null;
  lastContactTo: string | null;
};

const optionalBoolean = (value: unknown): boolean | null | undefined =>
  value === undefined ? undefined : typeof value === 'boolean' ? value : null;

function leadsWithoutChatFilters(params: Record<string, unknown>): { filters?: LeadsWithoutChatFilters; error?: McpWriteResult } {
  const status = text(params.status).slice(0, MAX_SHORT_TEXT_LENGTH) || null;
  const reactivationEnabled = optionalBoolean(params.reativacao_habilitada);
  const archived = optionalBoolean(params.arquivado);
  const hasPhone = optionalBoolean(params.tem_telefone);
  const reactivationAttemptIsNull = optionalBoolean(params.ultima_tentativa_reativacao_is_null);
  if ([reactivationEnabled, archived, hasPhone, reactivationAttemptIsNull].some((value) => value === null)) {
    return { error: errorResult('INVALID_INPUT', 'Os filtros booleanos devem ser true ou false.') };
  }
  const parseOptionalDate = (value: unknown, label: string) => {
    if (value === undefined) return { value: null as string | null };
    const parsed = parseDate(value);
    return parsed ? { value: parsed } : { error: errorResult('INVALID_INPUT', `${label} deve ser uma data ISO 8601 válida.`) };
  };
  const createdFrom = parseOptionalDate(params.data_criacao_de, 'data_criacao_de');
  const createdTo = parseOptionalDate(params.data_criacao_ate, 'data_criacao_ate');
  const lastContactFrom = parseOptionalDate(params.ultimo_contato_de, 'ultimo_contato_de');
  const lastContactTo = parseOptionalDate(params.ultimo_contato_ate, 'ultimo_contato_ate');
  const dateError = createdFrom.error || createdTo.error || lastContactFrom.error || lastContactTo.error;
  if (dateError) return { error: dateError };
  if (createdFrom.value && createdTo.value && createdFrom.value > createdTo.value) return { error: errorResult('INVALID_INPUT', 'data_criacao_de não pode ser posterior a data_criacao_ate.') };
  if (lastContactFrom.value && lastContactTo.value && lastContactFrom.value > lastContactTo.value) return { error: errorResult('INVALID_INPUT', 'ultimo_contato_de não pode ser posterior a ultimo_contato_ate.') };
  return {
    filters: {
      status,
      reactivationEnabled: reactivationEnabled ?? null,
      archived: archived ?? null,
      hasPhone: hasPhone ?? null,
      reactivationAttemptIsNull: reactivationAttemptIsNull ?? null,
      createdFrom: createdFrom.value,
      createdTo: createdTo.value,
      lastContactFrom: lastContactFrom.value,
      lastContactTo: lastContactTo.value,
    },
  };
}

const leadsWithoutChatFiltersView = (filters: LeadsWithoutChatFilters) => ({
  status: filters.status,
  reativacao_habilitada: filters.reactivationEnabled,
  arquivado: filters.archived,
  tem_telefone: filters.hasPhone,
  ultima_tentativa_reativacao_is_null: filters.reactivationAttemptIsNull,
  data_criacao_de: filters.createdFrom,
  data_criacao_ate: filters.createdTo,
  ultimo_contato_de: filters.lastContactFrom,
  ultimo_contato_ate: filters.lastContactTo,
});

const leadsWithoutChatView = (lead: Record<string, unknown>) => ({
  id: text(lead.id),
  nome_completo: text(lead.nome_completo),
  telefone: text(lead.telefone) || null,
  email: text(lead.email) || null,
  status: text(lead.status),
  cidade: text(lead.cidade) || null,
  estado: text(lead.estado) || null,
  data_criacao: parseDate(lead.data_criacao) || parseDate(lead.created_at),
  ultimo_contato: parseDate(lead.ultimo_contato),
  ultima_tentativa_reativacao: parseDate(lead.ultima_tentativa_reativacao),
  numero_tentativas_reativacao: typeof lead.numero_tentativas_reativacao === 'number' ? lead.numero_tentativas_reativacao : 0,
  reativacao_habilitada: lead.reativacao_habilitada === true,
  arquivado: lead.arquivado === true,
});

async function withUnlinkedPhoneChatDiagnostic(supabase: SupabaseClient, leads: Array<Record<string, unknown>>) {
  const phoneKeys = [...new Set(leads.flatMap((lead) => getCommWhatsAppPhoneLookupKeys(lead.telefone)))];
  if (phoneKeys.length === 0) return new Map<string, { id: string; phone_digits: string }>();
  const { data, error } = await supabase
    .from('comm_whatsapp_chats')
    .select('id,phone_digits')
    .is('lead_id', null)
    .in('phone_digits', phoneKeys);
  if (error) throw new Error(error.message);
  const chatsByPhone = new Map<string, { id: string; phone_digits: string }>();
  for (const chat of (data ?? []) as Array<Record<string, unknown>>) {
    const phone = normalizedBrazilWhatsAppPhone(chat.phone_digits);
    if (!phone) continue;
    const chatView = { id: text(chat.id), phone_digits: phone };
    for (const key of getCommWhatsAppPhoneLookupKeys(phone)) {
      if (!chatsByPhone.has(key)) chatsByPhone.set(key, chatView);
    }
  }
  return chatsByPhone;
}

async function listLeadsWithoutWhatsAppChat(supabase: SupabaseClient, params: Record<string, unknown>): Promise<McpWriteResult> {
  const validated = leadsWithoutChatFilters(params);
  if (validated.error || !validated.filters) return validated.error ?? errorResult('INVALID_INPUT', 'Filtros inválidos.');
  const page = boundedInteger(params.page ?? 1, 1, 10_000);
  const pageSize = boundedInteger(params.page_size ?? 20, 1, 100);
  if (page === null || pageSize === null) return errorResult('INVALID_INPUT', 'page deve ser positivo e page_size deve estar entre 1 e 100.');
  const order = LEADS_WITHOUT_CHAT_ORDER_FIELDS.has(text(params.order_by)) ? text(params.order_by) : 'created_at';
  const includeDiagnostic = params.include_phone_chat_diagnostic === true;
  if (params.include_phone_chat_diagnostic !== undefined && typeof params.include_phone_chat_diagnostic !== 'boolean') {
    return errorResult('INVALID_INPUT', 'include_phone_chat_diagnostic deve ser booleano.');
  }
  const from = (page - 1) * pageSize;
  let query = supabase
    .from('leads')
    .select(LEADS_WITHOUT_CHAT_SELECT, { count: 'exact' })
    .is('linked_chats', null);
  if (validated.filters.status) query = query.eq('status', validated.filters.status);
  if (validated.filters.reactivationEnabled !== null) query = query.eq('reativacao_habilitada', validated.filters.reactivationEnabled);
  if (validated.filters.archived !== null) query = query.eq('arquivado', validated.filters.archived);
  if (validated.filters.hasPhone === true) query = query.not('telefone', 'is', null).neq('telefone', '');
  if (validated.filters.hasPhone === false) query = query.or('telefone.is.null,telefone.eq.');
  if (validated.filters.reactivationAttemptIsNull === true) query = query.is('ultima_tentativa_reativacao', null);
  if (validated.filters.reactivationAttemptIsNull === false) query = query.not('ultima_tentativa_reativacao', 'is', null);
  if (validated.filters.createdFrom) query = query.gte('data_criacao', validated.filters.createdFrom);
  if (validated.filters.createdTo) query = query.lte('data_criacao', validated.filters.createdTo);
  if (validated.filters.lastContactFrom) query = query.gte('ultimo_contato', validated.filters.lastContactFrom);
  if (validated.filters.lastContactTo) query = query.lte('ultimo_contato', validated.filters.lastContactTo);
  const { data, error, count } = await query.order(order, { ascending: params.ascending === true }).range(from, from + pageSize - 1);
  if (error) return errorResult('INTERNAL_ERROR', 'Não foi possível listar leads sem chat de WhatsApp vinculado.');
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const diagnosticByPhone = includeDiagnostic ? await withUnlinkedPhoneChatDiagnostic(supabase, rows) : null;
  const leads = rows.map((lead) => {
    const base = leadsWithoutChatView(lead);
    if (!diagnosticByPhone) return base;
    const chat = getCommWhatsAppPhoneLookupKeys(lead.telefone)
      .map((phone) => diagnosticByPhone.get(phone))
      .find((candidate) => Boolean(candidate));
    return { ...base, linked_chat_exists: false, unlinked_chat_same_phone: Boolean(chat), unlinked_chat_id: chat?.id ?? null };
  });
  const total = count ?? 0;
  return {
    success: true,
    total,
    page,
    page_size: pageSize,
    has_more: from + leads.length < total,
    filters_applied: { ...leadsWithoutChatFiltersView(validated.filters), include_phone_chat_diagnostic: includeDiagnostic },
    leads,
  };
}

async function countLeadsWithoutWhatsAppChat(supabase: SupabaseClient, params: Record<string, unknown>): Promise<McpWriteResult> {
  const validated = leadsWithoutChatFilters(params);
  if (validated.error || !validated.filters) return validated.error ?? errorResult('INVALID_INPUT', 'Filtros inválidos.');
  let query = supabase
    .from('leads')
    .select('id,linked_chats:comm_whatsapp_chats!comm_whatsapp_chats_lead_id_fkey()', { count: 'exact', head: true })
    .is('linked_chats', null);
  if (validated.filters.status) query = query.eq('status', validated.filters.status);
  if (validated.filters.reactivationEnabled !== null) query = query.eq('reativacao_habilitada', validated.filters.reactivationEnabled);
  if (validated.filters.archived !== null) query = query.eq('arquivado', validated.filters.archived);
  if (validated.filters.hasPhone === true) query = query.not('telefone', 'is', null).neq('telefone', '');
  if (validated.filters.hasPhone === false) query = query.or('telefone.is.null,telefone.eq.');
  if (validated.filters.reactivationAttemptIsNull === true) query = query.is('ultima_tentativa_reativacao', null);
  if (validated.filters.reactivationAttemptIsNull === false) query = query.not('ultima_tentativa_reativacao', 'is', null);
  if (validated.filters.createdFrom) query = query.gte('data_criacao', validated.filters.createdFrom);
  if (validated.filters.createdTo) query = query.lte('data_criacao', validated.filters.createdTo);
  if (validated.filters.lastContactFrom) query = query.gte('ultimo_contato', validated.filters.lastContactFrom);
  if (validated.filters.lastContactTo) query = query.lte('ultimo_contato', validated.filters.lastContactTo);
  const { error, count } = await query;
  return error
    ? errorResult('INTERNAL_ERROR', 'Não foi possível contar leads sem chat de WhatsApp vinculado.')
    : { success: true, total: count ?? 0, filters_applied: leadsWithoutChatFiltersView(validated.filters) };
}

export async function executeMcpCommercialReadAction(params: { supabase: SupabaseClient; toolName: string; arguments: Record<string, unknown>; actorId?: string }): Promise<Record<string, unknown> | null> {
  const { supabase, toolName, arguments: args } = params;
  const opportunityRead = await executeMcpOpportunityReadAction({
    supabase,
    toolName,
    arguments: args,
    actorId: params.actorId ?? '',
  });
  if (opportunityRead) return opportunityRead;
  const contactPermissionRead = await executeMcpContactPermissionReadAction({
    supabase,
    toolName,
    arguments: args,
    actorId: params.actorId ?? '',
  });
  if (contactPermissionRead) return contactPermissionRead;
  const whatsappMediaRead = await executeMcpWhatsAppMediaReadAction({
    supabase,
    toolName,
    arguments: args,
    actor: { actorId: params.actorId ?? '' },
  });
  if (whatsappMediaRead) return whatsappMediaRead;
  const documentRead = await executeMcpContractDocumentAction({ supabase, toolName, arguments: args, actor: { actorId: params.actorId ?? '' } });
  if (documentRead && ['kifer_list_documents', 'kifer_get_document'].includes(toolName)) return documentRead;
  if (toolName === 'kifer_list_contract_value_adjustments') {
    const contractId = text(args.contract_id);
    const page = boundedInteger(args.page ?? 1, 1, 10_000);
    const pageSize = boundedInteger(args.page_size ?? 20, 1, 50);
    if (!safeUuid(contractId) || page === null || pageSize === null) return errorResult('INVALID_INPUT', 'contract_id válido, page positivo e page_size entre 1 e 50 são obrigatórios.');
    const from = (page - 1) * pageSize;
    const { data, error, count } = await supabase
      .from('contract_value_adjustments')
      .select('id,contract_id,tipo,valor,motivo,created_by,created_at', { count: 'exact' })
      .eq('contract_id', contractId)
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1);
    return error
      ? errorResult('INTERNAL_ERROR', 'Não foi possível listar os ajustes de valor do contrato.')
      : { success: true, page, page_size: pageSize, total: count ?? 0, adjustments: data ?? [] };
  }
  if (toolName === 'kifer_list_identity_conflicts') {
    const page = boundedInteger(args.page ?? 1, 1, 10_000);
    const pageSize = boundedInteger(args.page_size ?? 20, 1, 50);
    if (page === null || pageSize === null) return errorResult('INVALID_INPUT', 'page deve ser positivo e page_size deve estar entre 1 e 50.');
    const status = text(args.status) || 'open';
    if (!['open', 'resolved', 'ignored', 'all'].includes(status)) return errorResult('INVALID_INPUT', 'status inválido.');
    const conflictType = text(args.conflict_type);
    if (conflictType && !['lead_ambiguous', 'lead_conflict', 'identifier_conflict', 'reverse_mapping_conflict'].includes(conflictType)) return errorResult('INVALID_INPUT', 'conflict_type inválido.');
    const chatId = text(args.chat_id);
    if (chatId && !safeUuid(chatId)) return errorResult('INVALID_INPUT', 'chat_id inválido.');
    let query = supabase.from('comm_whatsapp_identity_conflicts').select('id,channel_id,chat_id,conflict_type,status,created_at,updated_at,resolved_at,resolved_by', { count: 'exact' });
    if (status !== 'all') query = query.eq('status', status);
    if (conflictType) query = query.eq('conflict_type', conflictType);
    if (chatId) query = query.eq('chat_id', chatId);
    const from = (page - 1) * pageSize;
    const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, from + pageSize - 1);
    return error ? errorResult('INTERNAL_ERROR', 'Não foi possível listar conflitos de identidade.') : { success: true, page, page_size: pageSize, total: count ?? 0, conflicts: data ?? [] };
  }
  if (toolName === 'kifer_get_identity_conflict') {
    const conflictId = text(args.conflict_id);
    if (!safeUuid(conflictId)) return errorResult('INVALID_INPUT', 'conflict_id inválido.');
    const { data, error } = await supabase.from('comm_whatsapp_identity_conflicts')
      .select('id,channel_id,chat_id,conflict_type,status,created_at,updated_at,resolved_at,resolved_by,details')
      .eq('id', conflictId).maybeSingle();
    if (error) return errorResult('INTERNAL_ERROR', 'Não foi possível consultar o conflito de identidade.');
    if (!data) return errorResult('NOT_FOUND', 'Conflito de identidade não encontrado.');
    const details = data.details && typeof data.details === 'object' && !Array.isArray(data.details)
      ? data.details as Record<string, unknown>
      : {};
    const persistedCandidates = data.conflict_type === 'lead_ambiguous'
      ? Array.isArray(details.candidate_lead_ids) ? details.candidate_lead_ids : []
      : data.conflict_type === 'lead_conflict'
        ? [details.winner_previous_lead_id, details.loser_previous_lead_id]
        : [];
    const candidateLeadIds = [...new Set(persistedCandidates.filter(safeUuid))].slice(0, 20);
    const { data: chat, error: chatError } = data.chat_id
      ? await supabase.from('comm_whatsapp_chats').select('updated_at').eq('id', data.chat_id).maybeSingle()
      : { data: null, error: null };
    const conflict = {
      id: data.id,
      channel_id: data.channel_id,
      chat_id: data.chat_id,
      conflict_type: data.conflict_type,
      status: data.status,
      created_at: data.created_at,
      updated_at: data.updated_at,
      resolved_at: data.resolved_at,
      resolved_by: data.resolved_by,
      expected_chat_updated_at: !chatError && chat && typeof chat.updated_at === 'string' ? chat.updated_at : null,
      resolution_candidate_lead_ids: candidateLeadIds,
      resolution_requires_review: !['lead_ambiguous', 'lead_conflict'].includes(data.conflict_type)
        || candidateLeadIds.length === 0,
    };
    return { success: true, conflict, details_available: true };
  }
  if (toolName === 'kifer_list_scheduled_whatsapp_messages') return listScheduledWhatsAppMessages(supabase, args);
  if (toolName === 'kifer_get_scheduled_whatsapp_message') return getScheduledWhatsAppMessage(supabase, args);
  if (toolName === 'kifer_get_commercial_followup_audit') return getCommercialFollowUpAudit(supabase, args, params.actorId ?? '');
  if (toolName === 'kifer_list_leads_without_whatsapp_chat') return listLeadsWithoutWhatsAppChat(supabase, args);
  if (toolName === 'kifer_count_leads_without_whatsapp_chat') return countLeadsWithoutWhatsAppChat(supabase, args);
  if (toolName === 'kifer_list_automation_jobs') {
    const { page, pageSize, from } = pageParams(args);
    let query = supabase.from('auto_contact_flow_jobs').select('id,lead_id,flow_id,step_id,step_order,action_type,status,attempts,last_error,scheduled_at,created_at,updated_at,enrollment_id,trigger_message_at', { count: 'exact' });
    const status = text(args.status); const type = text(args.tipo); const leadId = text(args.lead_id); const flowId = text(args.flow_id);
    const start = parseDate(args.data_inicial); const end = parseDate(args.data_final);
    if (status) query = query.eq('status', status);
    if (type) query = query.eq('action_type', type);
    if (safeUuid(leadId)) query = query.eq('lead_id', leadId);
    if (flowId) query = query.eq('flow_id', flowId);
    if (start) query = query.gte('scheduled_at', start);
    if (end) query = query.lte('scheduled_at', end);
    if (args.erro === true) query = query.not('last_error', 'is', null);
    const order = ['scheduled_at', 'created_at', 'updated_at', 'attempts'].includes(text(args.order_by)) ? text(args.order_by) : 'scheduled_at';
    const { data, error, count } = await query.order(order, { ascending: args.ascending === true }).range(from, from + pageSize - 1);
    if (error) return errorResult('INTERNAL_ERROR', 'Não foi possível consultar os jobs de automação.');
    return { success: true, page, page_size: pageSize, total: count ?? null, jobs: data ?? [] };
  }
  if (toolName === 'kifer_get_automation_job') {
    const jobId = text(args.job_id);
    if (!safeUuid(jobId)) return errorResult('INVALID_INPUT', 'job_id inválido.');
    const { data, error } = await supabase.from('auto_contact_flow_jobs').select('id,lead_id,flow_id,step_id,step_order,action_type,status,attempts,last_error,scheduled_at,created_at,updated_at,enrollment_id,trigger_message_at').eq('id', jobId).maybeSingle();
    return error || !data ? errorResult('NOT_FOUND', 'Job de automação não encontrado.') : { success: true, job: data };
  }
  if (toolName === 'kifer_get_automation_settings') {
    const integration = await loadAutomationIntegration(supabase); const settings = automationSettings(integration?.settings);
    return !settings ? errorResult('NOT_FOUND', 'Configuração de automação não encontrada.') : { success: true, settings: automationSettingsView(settings), updated_at: integration?.updated_at ?? null };
  }
  if (toolName === 'kifer_list_followup_flows' || toolName === 'kifer_get_followup_flow') {
    const integration = await loadAutomationIntegration(supabase); const settings = automationSettings(integration?.settings);
    if (!settings || !Array.isArray(settings.flows)) return errorResult('NOT_FOUND', 'Fluxos de follow-up não encontrados.');
    const requestedId = toolName === 'kifer_get_followup_flow' ? text(args.flow_id) : '';
    const flows = settings.flows.map(flowRecord).filter((flow): flow is Record<string, unknown> => Boolean(flow)).filter((flow) => !requestedId || text(flow.id) === requestedId);
    if (requestedId && flows.length === 0) return errorResult('NOT_FOUND', 'Fluxo não encontrado.');
    const summarized = await Promise.all(flows.slice(0, 50).map(async (flow) => {
      const { count } = await supabase.from('auto_contact_flow_jobs').select('id', { count: 'exact', head: true }).eq('flow_id', text(flow.id)).in('status', ['pending', 'processing']);
      return { ...flowView(flow), pending_jobs: count ?? 0 };
    }));
    return toolName === 'kifer_get_followup_flow' ? { success: true, flow: summarized[0] } : { success: true, flows: summarized };
  }
  if (toolName === 'kifer_list_lead_statuses') {
    const { data, error } = await supabase.from('lead_status_config').select('id,nome,cor,ordem,ativo,padrao').eq('ativo', true).order('ordem', { ascending: true });
    return error ? errorResult('INTERNAL_ERROR', 'Não foi possível listar os status comerciais.') : { success: true, statuses: data ?? [] };
  }
  if (toolName === 'kifer_list_reminders') {
    const { page, pageSize, from } = pageParams(args);
    let query = supabase.from('reminders').select('id,lead_id,contract_id,tipo,titulo,descricao,data_lembrete,prioridade,lido,concluido_em,cancelled_at,cancellation_reason,created_at', { count: 'exact' });
    if (safeUuid(text(args.lead_id))) query = query.eq('lead_id', text(args.lead_id));
    if (text(args.status) === 'pending') query = query.eq('lido', false).is('cancelled_at', null);
    if (text(args.status) === 'completed') query = query.eq('lido', true).is('cancelled_at', null);
    if (text(args.status) === 'cancelled') query = query.not('cancelled_at', 'is', null);
    if (PRIORITIES.has(text(args.prioridade))) query = query.eq('prioridade', text(args.prioridade));
    const start = parseDate(args.data_inicial); const end = parseDate(args.data_final);
    if (start) query = query.gte('data_lembrete', start);
    if (end) query = query.lte('data_lembrete', end);
    const { data, error, count } = await query.order('data_lembrete', { ascending: true }).range(from, from + pageSize - 1);
    return error ? errorResult('INTERNAL_ERROR', 'Não foi possível listar os lembretes.') : { success: true, page, page_size: pageSize, total: count ?? null, reminders: data ?? [] };
  }
  if (toolName === 'kifer_get_next_follow_up') {
    const leadId = text(args.lead_id);
    if (!safeUuid(leadId)) return errorResult('INVALID_INPUT', 'lead_id inválido.');
    if (!(await existingLead(supabase, leadId))) return errorResult('LEAD_NOT_FOUND', 'Lead não encontrado.');
    const { data, error } = await supabase.from('reminders').select('id,lead_id,tipo,titulo,descricao,data_lembrete,prioridade').eq('lead_id', leadId).eq('lido', false).eq('tipo', 'Follow-up').gte('data_lembrete', new Date().toISOString()).order('data_lembrete', { ascending: true }).limit(1).maybeSingle();
    return error ? errorResult('INTERNAL_ERROR', 'Não foi possível consultar o próximo retorno.') : { success: true, follow_up: data ?? null };
  }
  return null;
}

export async function executeMcpWriteAction(params: { supabase: SupabaseClient; toolName: string; arguments: Record<string, unknown>; actor: McpWriteActor }): Promise<McpWriteResult | null> {
  const { supabase, toolName, arguments: args, actor } = params;
  const isHolderImportAction = (MCP_CONTRACT_HOLDER_IMPORT_WRITE_TOOL_NAMES as readonly string[]).includes(toolName);
  let result: McpWriteResult | null = null;
  let actionType = '';
  const leadId = isHolderImportAction ? null : text(args.lead_id) || null;
  const chatId = isHolderImportAction ? null : text(args.chat_id) || null;
  const rawContractId = text(args.contract_id);
  let contractId = isHolderImportAction
    ? (safeUuid(rawContractId) ? rawContractId : null)
    : rawContractId || null;
  const clientRequestId = isHolderImportAction ? null : text(args.client_request_id) || null;
  try {
    if (toolName === 'kifer_send_whatsapp_message') { actionType = 'whatsapp_send'; result = await sendWhatsAppMessage(supabase, args, actor); }
    else if (toolName === 'kifer_send_whatsapp_media') { actionType = 'whatsapp_media_send'; result = await sendWhatsAppMedia(supabase, args, actor); }
    else if (toolName === 'kifer_get_or_create_whatsapp_chat') { actionType = 'whatsapp_chat_get_or_create'; result = await getOrCreateWhatsAppChat(supabase, args, actor); }
    else if (toolName === 'kifer_upload_scheduled_whatsapp_media') { actionType = 'whatsapp_schedule_media_upload'; result = await uploadScheduledWhatsAppMedia(supabase, args, actor); }
    else if (toolName === 'kifer_schedule_whatsapp_message') { actionType = 'whatsapp_schedule'; result = await scheduleWhatsAppMessage(supabase, args, actor); }
    else if (toolName === 'kifer_bulk_schedule_whatsapp_messages') { actionType = 'whatsapp_schedule_bulk'; result = await bulkScheduleWhatsAppMessages(supabase, args, actor); }
    else if (toolName === 'kifer_update_scheduled_whatsapp_message') { actionType = 'whatsapp_schedule_update'; result = await updateScheduledWhatsAppMessage(supabase, args, actor); }
    else if (toolName === 'kifer_cancel_scheduled_whatsapp_message') { actionType = 'whatsapp_schedule_cancel'; result = await cancelScheduledWhatsAppMessage(supabase, args); }
    else if (toolName === 'kifer_create_reminder') { actionType = 'reminder_create'; result = await createReminder(supabase, args, actor); }
    else if (toolName === 'kifer_update_lead_status') { actionType = 'lead_status_update'; result = await updateLeadStatus(supabase, args, actor); }
    else if (toolName === 'kifer_create_interaction') { actionType = 'interaction_create'; result = await createInteraction(supabase, args, actor); }
    else if (toolName === 'kifer_set_next_follow_up') { actionType = 'next_follow_up_set'; result = await createReminder(supabase, { lead_id: args.lead_id, tipo: 'Follow-up', titulo: 'Próximo retorno', descricao: args.observacao, data_lembrete: args.proximo_retorno, prioridade: 'normal' }, actor); }
    else if (toolName === 'kifer_update_automation_settings') { actionType = 'automation_settings_update'; result = await updateAutomationSettings(supabase, args); }
    else if (toolName === 'kifer_update_followup_flow') { actionType = 'followup_flow_update'; result = await updateFollowUpFlow(supabase, args); }
    else if (toolName === 'kifer_pause_followup_flow') { actionType = 'followup_flow_pause'; result = await updateFollowUpFlow(supabase, args, false); }
    else if (toolName === 'kifer_resume_followup_flow') { actionType = 'followup_flow_resume'; result = await updateFollowUpFlow(supabase, args, true); }
    else if (toolName === 'kifer_enqueue_lead_followup') { actionType = 'followup_enqueue'; result = await enqueueLeadFollowUp(supabase, args); }
    else if (toolName === 'kifer_remove_lead_from_followup') { actionType = 'followup_remove'; result = await removeLeadFromFollowUp(supabase, args); }
    else if (toolName === 'kifer_update_lead') { actionType = 'lead_update'; result = await updateLead(supabase, args); }
    else if (toolName === 'kifer_update_contract_status') { actionType = 'contract_status_update'; result = await updateContractStatus(supabase, args); }
    else if (toolName === 'kifer_cancel_contract') { actionType = 'contract_cancel'; result = await updateContractStatus(supabase, args, true); }
    else if ((MCP_INBOX_WRITE_TOOL_NAMES as readonly string[]).includes(toolName)) {
      actionType = toolName.replace(/^kifer_/, '').replaceAll('_', '-') + '-inbox';
      result = await executeMcpInboxAction({ supabase, toolName, arguments: args, actor });
    }
    else if ((MCP_IDENTITY_CONFLICT_WRITE_TOOL_NAMES as readonly string[]).includes(toolName)) {
      actionType = 'identity-conflict-resolution';
      result = await executeMcpIdentityConflictResolution({ supabase, toolName, arguments: args, actorId: actor.actorId });
    }
    else if ((MCP_CONTACT_PERMISSION_WRITE_TOOL_NAMES as readonly string[]).includes(toolName)) {
      actionType = toolName.replace(/^kifer_/, '').replaceAll('_', '-') + '-contact-permission';
      result = await executeMcpContactPermissionWriteAction({ supabase, toolName, arguments: args, actor });
    }
    else if (['kifer_upload_document', 'kifer_update_document_metadata', 'kifer_delete_document'].includes(toolName)) {
      actionType = toolName.replace(/^kifer_/, '').replaceAll('_', '-');
      result = await executeMcpContractDocumentAction({ supabase, toolName, arguments: args, actor });
    }
    else if ((MCP_CONTRACT_WRITE_TOOL_NAMES as readonly string[]).includes(toolName)) {
      actionType = toolName.replace(/^kifer_/, '').replaceAll('_', '-');
      result = await executeMcpContractWriteAction({ supabase, toolName, arguments: args, actor });
    }
    else if ((MCP_CONTRACT_HOLDER_IMPORT_WRITE_TOOL_NAMES as readonly string[]).includes(toolName)) {
      actionType = toolName.replace(/^kifer_/, '').replaceAll('_', '-');
      result = await executeMcpContractHolderImportAction({ supabase, toolName, arguments: args, actor });
    }
    else if ((MCP_OPPORTUNITY_WRITE_TOOL_NAMES as readonly string[]).includes(toolName)) {
      actionType = toolName.replace(/^kifer_/, '').replaceAll('_', '-') + '-opportunity';
      result = await executeMcpOpportunityWriteAction({ supabase, toolName, arguments: args, actor });
    }
    else if (['kifer_bulk_update_leads', 'kifer_bulk_assign_leads', 'kifer_bulk_update_lead_status', 'kifer_bulk_archive_leads', 'kifer_bulk_enqueue_followup'].includes(toolName)) {
      actionType = toolName.replace(/^kifer_/, '').replaceAll('_', '-') + '-bulk';
      result = await runBulkLeadMutation({ supabase, toolName, args, actor });
    }
    else if (toolName === 'kifer_update_reminder') { actionType = 'reminder_update'; result = await updateReminderAction(supabase, args, 'update'); }
    else if (toolName === 'kifer_complete_reminder') { actionType = 'reminder_complete'; result = await updateReminderAction(supabase, args, 'complete'); }
    else if (toolName === 'kifer_cancel_reminder') { actionType = 'reminder_cancel'; result = await updateReminderAction(supabase, args, 'cancel'); }
    else if (toolName === 'kifer_cancel_automation_job') { actionType = 'automation_job_cancel'; result = await changeAutomationJob(supabase, args, 'cancel'); }
    else if (toolName === 'kifer_retry_automation_job') { actionType = 'automation_job_retry'; result = await changeAutomationJob(supabase, args, 'retry'); }
    else if (toolName === 'kifer_bulk_cancel_automation_jobs') { actionType = 'automation_jobs_bulk_cancel'; result = await bulkCancelAutomationJobs(supabase, args); }
    else if (toolName === 'kifer_create_followup_flow') { actionType = 'followup_flow_create'; result = await createFollowUpFlow(supabase, args); }
    else if (toolName === 'kifer_create_followup_step') { actionType = 'followup_step_create'; result = await createFollowUpStep(supabase, args); }
    else if (toolName === 'kifer_update_followup_step_message') { actionType = 'followup_step_message_update'; result = await updateFollowUpStepMessage(supabase, args); }
    else if (toolName === 'kifer_delete_followup_step') { actionType = 'followup_step_delete'; result = await mutateFollowUpSteps(supabase, args, 'delete'); }
    else if (toolName === 'kifer_reorder_followup_steps') { actionType = 'followup_step_reorder'; result = await mutateFollowUpSteps(supabase, args, 'reorder'); }
    else if (toolName === 'kifer_clone_followup_flow') { actionType = 'followup_flow_clone'; result = await cloneFollowUpFlow(supabase, args); }
    else if ((MCP_LEAD_ADMIN_TOOL_NAMES as readonly string[]).includes(toolName)) {
      const action = await executeMcpLeadAdminAction({ supabase, toolName, arguments: args, actor });
      if (!action) return null;
      actionType = action.actionType;
      result = action.result;
    }
    else return null;
  } catch {
    console.error('[chatgpt-mcp] falha inesperada em ação MCP.');
    result = errorResult('INTERNAL_ERROR', 'Falha inesperada ao executar a ação. Detalhes internos não foram expostos.');
  }
  const resultLeadId = safeUuid(result?.lead_id) ? text(result?.lead_id) : leadId;
  const resultChatId = safeUuid(result?.chat_id) ? text(result?.chat_id) : chatId;
  if (safeUuid(result?.contract_id)) contractId = text(result?.contract_id);
  else if (isRecord(result?.contract) && safeUuid(result.contract.id)) contractId = text(result.contract.id);
  const bulkResults = Array.isArray(result?.results) ? result.results.filter(isRecord) : [];
  if (bulkResults.length > 0) {
    const sharedRequest = Object.fromEntries(Object.entries(args).filter(([key]) => key !== 'lead_ids'));
    for (const item of bulkResults) {
      const itemLeadId = safeUuid(item.lead_id) ? text(item.lead_id) : null;
      await audit({
        supabase,
        actor,
        toolName,
        actionType,
        request: { ...sharedRequest, lead_id: itemLeadId, batch_count: bulkResults.length },
        result: { success: item.success === true, ...item },
        leadId: itemLeadId,
        clientRequestId,
      });
    }
  } else {
    const auditRequest = isHolderImportAction
      ? {
          contract_id: safeUuid(args.contract_id) ? text(args.contract_id) : null,
          import_id: safeUuid(args.import_id) ? text(args.import_id) : null,
        }
      : args;
    const auditClientRequestId = isHolderImportAction
      ? await requestIdFingerprint(actor.actorId, 'holder.import.consume', args.client_request_id)
      : clientRequestId;
    await audit({
      supabase,
      actor,
      toolName,
      actionType,
      request: auditRequest,
      result: result!,
      leadId: resultLeadId,
      chatId: resultChatId,
      contractId,
      clientRequestId: auditClientRequestId,
    });
  }
  return result;
}
