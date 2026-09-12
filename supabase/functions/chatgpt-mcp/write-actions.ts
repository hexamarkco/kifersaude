import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

const MAX_MESSAGE_LENGTH = 4_096;
const MAX_SHORT_TEXT_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 4_000;
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const PRIORITIES = new Set(['baixa', 'normal', 'alta']);
const SECRET_KEY = /(?:token|secret|password|credential|authorization|api[_-]?key)/i;

export type McpWriteActor = { actor: string; actorId: string };
export type McpWriteResult = { success: boolean; [key: string]: unknown };

type ActionErrorCode =
  | 'UNAUTHORIZED' | 'LEAD_NOT_FOUND' | 'CHAT_NOT_FOUND' | 'CONTRACT_NOT_FOUND'
  | 'INVALID_STATUS' | 'MESSAGE_EMPTY' | 'MESSAGE_TOO_LONG' | 'RATE_LIMITED'
  | 'DUPLICATE_REQUEST' | 'PROVIDER_ERROR' | 'INVALID_INPUT' | 'INTERNAL_ERROR'
  | 'NOT_FOUND' | 'CONFLICT' | 'NOT_ALLOWED' | 'JOB_ALREADY_EXECUTED'
  | 'INVALID_ASSIGNEE';

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const safeUuid = (value: unknown) => UUID.test(text(value));
const sanitize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, SECRET_KEY.test(key) ? '[REDACTED]' : sanitize(child)]));
};

const errorResult = (errorCode: ActionErrorCode, message: string): McpWriteResult => ({ success: false, error_code: errorCode, message });

const parseDate = (value: unknown): string | null => {
  const raw = text(value);
  const timestamp = Date.parse(raw);
  return raw && Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

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
  const { data, error } = await supabase.from('leads').select('id,status,status_id,responsavel').eq('id', leadId).maybeSingle();
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

async function updateLeadStatus(supabase: SupabaseClient, params: Record<string, unknown>, actor: McpWriteActor): Promise<McpWriteResult> {
  const leadId = text(params.lead_id);
  const statusName = text(params.status).slice(0, MAX_SHORT_TEXT_LENGTH);
  const observation = text(params.observacao).slice(0, MAX_DESCRIPTION_LENGTH) || null;
  if (!safeUuid(leadId) || !statusName) return errorResult('INVALID_INPUT', 'Informe lead_id e status.');
  const lead = await existingLead(supabase, leadId);
  if (!lead) return errorResult('LEAD_NOT_FOUND', 'Lead não encontrado.');
  const { data: status, error: statusError } = await supabase.from('lead_status_config').select('id,nome,ativo').ilike('nome', statusName).maybeSingle();
  if (statusError || !status || status.ativo === false) return errorResult('INVALID_STATUS', 'Status inexistente ou inativo.');
  if (lead.status_id === status.id) return { success: true, lead_id: leadId, status_anterior: lead.status, status_novo: status.nome, unchanged: true };
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
    return errorResult('PROVIDER_ERROR', 'Não foi possível contactar o serviço de WhatsApp.');
  }
  if (!response.ok && response.status !== 202) {
    if (response.status === 429) return errorResult('RATE_LIMITED', 'Limite de envios atingido. Aguarde antes de tentar novamente.');
    return errorResult('PROVIDER_ERROR', text(body.error) || 'O provedor de WhatsApp recusou a mensagem.');
  }
  const externalMessageId = text(body.messageId);
  const { data: persisted } = externalMessageId ? await supabase.from('comm_whatsapp_messages').select('id,message_at,delivery_status').eq('chat_id', chatId).eq('external_message_id', externalMessageId).maybeSingle() : { data: null };
  return { success: true, duplicate: body.duplicate === true, message_id: persisted?.id || null, external_message_id: externalMessageId || null, chat_id: chatId, delivery_status: text(body.status) || persisted?.delivery_status || 'queued', sent_at: persisted?.message_at || new Date().toISOString() };
}

export async function executeMcpWriteAction(params: { supabase: SupabaseClient; toolName: string; arguments: Record<string, unknown>; actor: McpWriteActor }): Promise<McpWriteResult | null> {
  const { supabase, toolName, arguments: args, actor } = params;
  let result: McpWriteResult | null = null;
  let actionType = '';
  const leadId = text(args.lead_id) || null;
  const chatId = text(args.chat_id) || null;
  const contractId = text(args.contract_id) || null;
  const clientRequestId = text(args.client_request_id) || null;
  try {
    if (toolName === 'kifer_send_whatsapp_message') { actionType = 'whatsapp_send'; result = await sendWhatsAppMessage(supabase, args, actor); }
    else if (toolName === 'kifer_create_reminder') { actionType = 'reminder_create'; result = await createReminder(supabase, args, actor); }
    else if (toolName === 'kifer_update_lead_status') { actionType = 'lead_status_update'; result = await updateLeadStatus(supabase, args, actor); }
    else if (toolName === 'kifer_create_interaction') { actionType = 'interaction_create'; result = await createInteraction(supabase, args, actor); }
    else if (toolName === 'kifer_set_next_follow_up') { actionType = 'next_follow_up_set'; result = await createReminder(supabase, { lead_id: args.lead_id, tipo: 'Retorno', titulo: 'Próximo retorno', descricao: args.observacao, data_lembrete: args.proximo_retorno, prioridade: 'normal' }, actor); }
    else return null;
  } catch (error) {
    result = errorResult('INTERNAL_ERROR', error instanceof Error ? error.message : 'Falha inesperada ao executar a ação.');
  }
  await audit({ supabase, actor, toolName, actionType, request: args, result: result!, leadId, chatId, contractId, clientRequestId });
  return result;
}
