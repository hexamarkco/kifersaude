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
  const allowed = new Set(['ativo', 'daily_send_limit', 'start_hour', 'end_hour', 'allowed_weekdays', 'trigger_statuses', 'enabled_step_ids', 'step_delays']);
  if (Object.keys(patch).some((key) => !allowed.has(key))) return errorResult('NOT_ALLOWED', 'A ferramenta só pode alterar ativação, horários, limites, status de gatilho e delays das etapas existentes.');
  const next: Record<string, unknown> = { ...previous };
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
  const steps = Array.isArray(previous.steps) ? previous.steps.filter(isRecord).map((step) => ({ ...step })) : [];
  const knownStepIds = new Set(steps.map((step) => text(step.id)));
  if ('enabled_step_ids' in patch) {
    if (!Array.isArray(patch.enabled_step_ids) || patch.enabled_step_ids.some((id) => !knownStepIds.has(text(id)))) return errorResult('INVALID_INPUT', 'enabled_step_ids deve conter somente etapas existentes do fluxo.');
    const enabled = new Set(patch.enabled_step_ids.map(text));
    steps.forEach((step) => { step.enabled = enabled.has(text(step.id)); });
  }
  if ('step_delays' in patch) {
    if (!Array.isArray(patch.step_delays) || patch.step_delays.length > steps.length) return errorResult('INVALID_INPUT', 'step_delays inválido.');
    for (const change of patch.step_delays) {
      if (!isRecord(change) || !knownStepIds.has(text(change.step_id)) || boundedInteger(change.delay_value, 0, 3650) === null || !['seconds', 'minutes', 'hours', 'days'].includes(text(change.delay_unit))) return errorResult('INVALID_INPUT', 'Cada delay exige step_id existente, valor de 0 a 3650 e unidade válida.');
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

async function updateLead(supabase: SupabaseClient, params: Record<string, unknown>): Promise<McpWriteResult> {
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
  const { data, error } = await supabase.from('leads').update(update).eq('id', leadId).select('id,nome_completo,email,telefone,cidade,cep,endereco,estado,regiao,canal,operadora_atual,observacoes,origem_id,responsavel_id,updated_at').maybeSingle();
  return error || !data ? errorResult('INTERNAL_ERROR', 'Não foi possível atualizar os dados comerciais do lead.') : { success: true, lead: data, changed_fields: Object.keys(update) };
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

async function enqueueLeadFollowUp(supabase: SupabaseClient, params: Record<string, unknown>): Promise<McpWriteResult> {
  const leadId = text(params.lead_id);
  const flowId = text(params.flow_id);
  const scheduledAt = params.scheduled_at === undefined ? null : parseDate(params.scheduled_at);
  if (!safeUuid(leadId) || !flowId || (params.scheduled_at !== undefined && !scheduledAt)) return errorResult('INVALID_INPUT', 'Informe lead_id, flow_id e scheduled_at válido quando preenchido.');
  const lead = await existingLead(supabase, leadId);
  if (!lead) return errorResult('LEAD_NOT_FOUND', 'Lead não encontrado.');
  const integration = await loadAutomationIntegration(supabase);
  const settings = automationSettings(integration?.settings);
  const flow = settings?.flows?.map(flowRecord).find((candidate) => candidate?.id === flowId) ?? null;
  if (!flow || flow.ativo === false) return errorResult('NOT_FOUND', 'Fluxo não encontrado ou está pausado.');
  const steps = Array.isArray(flow.steps) ? flow.steps.filter(isRecord).filter((step) => step.enabled !== false) : [];
  const first = steps[0];
  if (!first || !text(first.id) || !text(first.actionType)) return errorResult('INVALID_INPUT', 'O fluxo não possui uma primeira etapa ativa válida.');
  const { data: activeJob, error: duplicateError } = await supabase.from('auto_contact_flow_jobs').select('id,status,scheduled_at').eq('lead_id', leadId).eq('flow_id', flowId).in('status', ['pending', 'processing']).limit(1).maybeSingle();
  if (duplicateError) throw new Error(duplicateError.message);
  if (activeJob) return { success: true, duplicate: true, job: activeJob, message: 'O lead já possui um job ativo neste fluxo.' };
  const observation = text(params.observacao).slice(0, MAX_DESCRIPTION_LENGTH);
  const actionPayload: Record<string, unknown> = observation ? { mcp_observacao: observation, mcp_source: 'chatgpt_mcp' } : { mcp_source: 'chatgpt_mcp' };
  if (text(first.actionType) === 'send_message' && Array.isArray(first.messages)) actionPayload.messages = first.messages;
  const { data, error } = await supabase.from('auto_contact_flow_jobs').insert({
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
    scheduled_at: firstStepSchedule(first, scheduledAt),
    status: 'pending',
  }).select('*').maybeSingle();
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

const pageParams = (params: Record<string, unknown>) => {
  const page = boundedInteger(params.page ?? 1, 1, 10_000) ?? 1;
  const pageSize = boundedInteger(params.page_size ?? 20, 1, 50) ?? 20;
  return { page, pageSize, from: (page - 1) * pageSize };
};

export async function executeMcpCommercialReadAction(params: { supabase: SupabaseClient; toolName: string; arguments: Record<string, unknown> }): Promise<Record<string, unknown> | null> {
  const { supabase, toolName, arguments: args } = params;
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
    const { data, error } = await supabase.from('reminders').select('id,lead_id,tipo,titulo,descricao,data_lembrete,prioridade').eq('lead_id', leadId).eq('lido', false).in('tipo', ['Follow-up', 'Retorno']).gte('data_lembrete', new Date().toISOString()).order('data_lembrete', { ascending: true }).limit(1).maybeSingle();
    return error ? errorResult('INTERNAL_ERROR', 'Não foi possível consultar o próximo retorno.') : { success: true, follow_up: data ?? null };
  }
  return null;
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
    else if (toolName === 'kifer_update_automation_settings') { actionType = 'automation_settings_update'; result = await updateAutomationSettings(supabase, args); }
    else if (toolName === 'kifer_update_followup_flow') { actionType = 'followup_flow_update'; result = await updateFollowUpFlow(supabase, args); }
    else if (toolName === 'kifer_pause_followup_flow') { actionType = 'followup_flow_pause'; result = await updateFollowUpFlow(supabase, args, false); }
    else if (toolName === 'kifer_resume_followup_flow') { actionType = 'followup_flow_resume'; result = await updateFollowUpFlow(supabase, args, true); }
    else if (toolName === 'kifer_enqueue_lead_followup') { actionType = 'followup_enqueue'; result = await enqueueLeadFollowUp(supabase, args); }
    else if (toolName === 'kifer_remove_lead_from_followup') { actionType = 'followup_remove'; result = await removeLeadFromFollowUp(supabase, args); }
    else if (toolName === 'kifer_update_lead') { actionType = 'lead_update'; result = await updateLead(supabase, args); }
    else if (toolName === 'kifer_update_reminder') { actionType = 'reminder_update'; result = await updateReminderAction(supabase, args, 'update'); }
    else if (toolName === 'kifer_complete_reminder') { actionType = 'reminder_complete'; result = await updateReminderAction(supabase, args, 'complete'); }
    else if (toolName === 'kifer_cancel_reminder') { actionType = 'reminder_cancel'; result = await updateReminderAction(supabase, args, 'cancel'); }
    else if (toolName === 'kifer_cancel_automation_job') { actionType = 'automation_job_cancel'; result = await changeAutomationJob(supabase, args, 'cancel'); }
    else if (toolName === 'kifer_retry_automation_job') { actionType = 'automation_job_retry'; result = await changeAutomationJob(supabase, args, 'retry'); }
    else return null;
  } catch (error) {
    result = errorResult('INTERNAL_ERROR', error instanceof Error ? error.message : 'Falha inesperada ao executar a ação.');
  }
  await audit({ supabase, actor, toolName, actionType, request: args, result: result!, leadId, chatId, contractId, clientRequestId });
  return result;
}
