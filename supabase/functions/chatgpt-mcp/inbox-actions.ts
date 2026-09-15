import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

type Args = Record<string, unknown>;
type InboxActor = { actorId: string };
type ActionResult = { success: boolean; [key: string]: unknown };

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const REQUEST_ID = /^[A-Za-z0-9:_-]{1,128}$/;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|([+-])(\d{2}):(\d{2}))$/i;
const CHAT_STATE_KEYS = [
  'chat_id', 'updated_at', 'status',
  'is_archived', 'archived_at',
  'is_muted', 'muted_at',
  'is_pinned', 'pinned_at',
  'manual_unread', 'manual_unread_at', 'unread_count', 'last_read_at',
  'lead_id', 'lead_link_source', 'lead_linked_at',
] as const;

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const invalid = (message: string): ActionResult => ({ success: false, error_code: 'INVALID_INPUT', message });
const internal = (): ActionResult => ({ success: false, error_code: 'INTERNAL_ERROR', message: 'Não foi possível executar a ação da Inbox.' });

const isDateTime = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const match = DATE_TIME.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[8] ? Number(match[9]) : 0;
  const offsetMinute = match[8] ? Number(match[10]) : 0;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysPerMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1
    && month >= 1 && month <= 12
    && day >= 1 && day <= (daysPerMonth[month - 1] ?? 0)
    && hour <= 23 && minute <= 59 && second <= 59
    && offsetHour <= 14 && offsetMinute <= 59
    && (offsetHour < 14 || offsetMinute === 0);
};

const safeChatState = (value: unknown): Record<string, unknown> | null => {
  if (!isRecord(value)) return null;
  const safe = Object.fromEntries(CHAT_STATE_KEYS.filter((key) => key in value).map((key) => [key, value[key]]));
  if (!UUID.test(text(safe.chat_id)) || !isDateTime(safe.updated_at)) return null;
  if (typeof safe.is_archived !== 'boolean'
    || typeof safe.is_muted !== 'boolean'
    || typeof safe.is_pinned !== 'boolean'
    || typeof safe.manual_unread !== 'boolean'
    || typeof safe.unread_count !== 'number'
    || !Number.isInteger(safe.unread_count)
    || safe.unread_count < 0) return null;
  return safe;
};

const mapRpcError = (error: { code?: string; message?: string } | null): ActionResult => {
  if (error?.code === '42501' || error?.message?.includes('MCP_ADMIN_REQUIRED')) {
    return { success: false, error_code: 'UNAUTHORIZED', message: 'A ação exige uma conta administradora ativa.' };
  }
  if (error?.code === 'P0002') {
    return { success: false, error_code: 'NOT_FOUND', message: 'A conversa ou o lead informado não foi encontrado.' };
  }
  if (error?.message?.includes('MCP_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD')) {
    return { success: false, error_code: 'IDEMPOTENCY_CONFLICT', message: 'client_request_id já foi usado com outros dados; gere uma nova chave.' };
  }
  if (error?.message?.includes('MCP_IDENTITY_CONFLICT_RESOLUTION_REQUIRED')) {
    return { success: false, error_code: 'REQUIRES_REVIEW', status: 'requires_review', message: 'Consulte kifer_get_identity_conflict e use kifer_resolve_identity_conflict com um candidato persistido.' };
  }
  if (error?.code === '40001') {
    return { success: false, error_code: 'CONFLICT', message: 'A solicitação entrou em conflito; recarregue a conversa e tente novamente com uma nova chave.' };
  }
  if (error?.code === '22023') {
    return { success: false, error_code: 'INVALID_INPUT', message: 'Os dados da ação foram rejeitados.' };
  }
  return internal();
};

const normalizeRpcResult = (value: unknown, expectedOperation: string): ActionResult => {
  if (!isRecord(value) || typeof value.success !== 'boolean' || value.operation !== expectedOperation) return internal();
  const chat = safeChatState(value.chat);
  if (!chat) return internal();
  if (value.success === false) {
    const error = isRecord(value.error) ? value.error : {};
    if (error.code !== 'STALE_WRITE') return internal();
    return {
      success: false,
      operation: expectedOperation,
      error_code: 'STALE_WRITE',
      message: typeof error.message === 'string' ? error.message : 'A conversa mudou desde a leitura; recarregue e tente novamente.',
      current_updated_at: isDateTime(error.current_updated_at) ? error.current_updated_at : chat.updated_at,
      chat,
      replayed: value.replayed === true,
    };
  }
  return {
    success: true,
    operation: expectedOperation,
    ...(typeof value.value === 'boolean' ? { value: value.value } : {}),
    chat,
    replayed: value.replayed === true,
  };
};

async function callInboxRpc(
  supabase: SupabaseClient,
  functionName: string,
  parameters: Record<string, unknown>,
  operation: string,
): Promise<ActionResult> {
  const { data, error } = await supabase.rpc(functionName, parameters);
  if (error) return mapRpcError(error);
  return normalizeRpcResult(data, operation);
}

const EXPECTED_AT_SCHEMA = { type: 'string', format: 'date-time', description: 'updated_at exato retornado pela leitura; preserve os dígitos fracionários.' } as const;
const REQUEST_ID_SCHEMA = { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9:_-]{1,128}$' } as const;
const CHAT_MUTATION_ANNOTATIONS = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

const stateTool = (name: string, description: string) => ({
  name,
  description,
  inputSchema: {
    type: 'object',
    required: ['chat_id', 'expected_updated_at', 'client_request_id'],
    additionalProperties: false,
    properties: {
      chat_id: { type: 'string', format: 'uuid' },
      expected_updated_at: EXPECTED_AT_SCHEMA,
      client_request_id: REQUEST_ID_SCHEMA,
    },
  },
  annotations: CHAT_MUTATION_ANNOTATIONS,
});

const CHAT_ACTION_SCHEMAS = [
  stateTool('kifer_archive_whatsapp_chat', 'Arquiva uma conversa do WhatsApp. Exige expected_updated_at da leitura e client_request_id idempotente; OAuth admin obrigatório.'),
  stateTool('kifer_unarchive_whatsapp_chat', 'Desarquiva uma conversa do WhatsApp. Exige expected_updated_at da leitura e client_request_id idempotente; OAuth admin obrigatório.'),
  stateTool('kifer_pin_whatsapp_chat', 'Fixe uma conversa no topo da Inbox. Exige expected_updated_at da leitura e client_request_id idempotente; OAuth admin obrigatório.'),
  stateTool('kifer_unpin_whatsapp_chat', 'Desafixe uma conversa da Inbox. Exige expected_updated_at da leitura e client_request_id idempotente; OAuth admin obrigatório.'),
  stateTool('kifer_mute_whatsapp_chat', 'Silencia notificações de uma conversa. Exige expected_updated_at da leitura e client_request_id idempotente; OAuth admin obrigatório.'),
  stateTool('kifer_unmute_whatsapp_chat', 'Reativa notificações de uma conversa. Exige expected_updated_at da leitura e client_request_id idempotente; OAuth admin obrigatório.'),
  stateTool('kifer_mark_whatsapp_chat_unread', 'Marca uma conversa como não lida seguindo a regra de unread manual da Inbox. Exige expected_updated_at e client_request_id; OAuth admin obrigatório.'),
  {
    name: 'kifer_mark_whatsapp_chat_read',
    description: 'Marca a conversa como lida. Se não enviar cursor, marca como lida até a última mensagem visível; caso contrário envie timestamp, ID ou ambos. Exige expected_updated_at e client_request_id; OAuth admin obrigatório.',
    inputSchema: {
      type: 'object',
      required: ['chat_id', 'expected_updated_at', 'client_request_id'],
      additionalProperties: false,
      properties: {
        chat_id: { type: 'string', format: 'uuid' },
        expected_updated_at: EXPECTED_AT_SCHEMA,
        client_request_id: REQUEST_ID_SCHEMA,
        last_seen_message_at: { type: ['string', 'null'], format: 'date-time' },
        last_seen_message_id: { type: ['string', 'null'], format: 'uuid' },
      },
    },
    annotations: CHAT_MUTATION_ANNOTATIONS,
  },
  {
    name: 'kifer_link_chat_to_lead',
    description: 'Vincula manualmente uma conversa a um lead quando não há conflito de identidade de associação aberto. Se houver conflito, use kifer_resolve_identity_conflict com um candidato persistido. Não mescla chats. Exige expected_updated_at e client_request_id; OAuth admin obrigatório.',
    inputSchema: {
      type: 'object', required: ['chat_id', 'lead_id', 'expected_updated_at', 'client_request_id'], additionalProperties: false,
      properties: {
        chat_id: { type: 'string', format: 'uuid' },
        lead_id: { type: 'string', format: 'uuid' },
        expected_updated_at: EXPECTED_AT_SCHEMA,
        client_request_id: REQUEST_ID_SCHEMA,
      },
    },
    annotations: CHAT_MUTATION_ANNOTATIONS,
  },
  {
    name: 'kifer_unlink_chat_from_lead',
    description: 'Desvincula o lead de uma conversa e bloqueia nova associação automática, preservando o histórico. Não exclui lead nem conversa. Exige expected_updated_at e client_request_id; OAuth admin obrigatório.',
    inputSchema: {
      type: 'object', required: ['chat_id', 'expected_updated_at', 'client_request_id'], additionalProperties: false,
      properties: {
        chat_id: { type: 'string', format: 'uuid' },
        expected_updated_at: EXPECTED_AT_SCHEMA,
        client_request_id: REQUEST_ID_SCHEMA,
      },
    },
    annotations: CHAT_MUTATION_ANNOTATIONS,
  },
] as const;

export const MCP_INBOX_WRITE_TOOL_NAMES = CHAT_ACTION_SCHEMAS.map(({ name }) => name) as readonly string[];
export const MCP_INBOX_TOOLS = CHAT_ACTION_SCHEMAS;

const TOOL_ARGUMENTS: Record<string, readonly string[]> = {
  kifer_archive_whatsapp_chat: ['chat_id', 'expected_updated_at', 'client_request_id'],
  kifer_unarchive_whatsapp_chat: ['chat_id', 'expected_updated_at', 'client_request_id'],
  kifer_pin_whatsapp_chat: ['chat_id', 'expected_updated_at', 'client_request_id'],
  kifer_unpin_whatsapp_chat: ['chat_id', 'expected_updated_at', 'client_request_id'],
  kifer_mute_whatsapp_chat: ['chat_id', 'expected_updated_at', 'client_request_id'],
  kifer_unmute_whatsapp_chat: ['chat_id', 'expected_updated_at', 'client_request_id'],
  kifer_mark_whatsapp_chat_unread: ['chat_id', 'expected_updated_at', 'client_request_id'],
  kifer_mark_whatsapp_chat_read: ['chat_id', 'expected_updated_at', 'client_request_id', 'last_seen_message_at', 'last_seen_message_id'],
  kifer_link_chat_to_lead: ['chat_id', 'lead_id', 'expected_updated_at', 'client_request_id'],
  kifer_unlink_chat_from_lead: ['chat_id', 'expected_updated_at', 'client_request_id'],
};

const STATE_TOOL_MAP: Record<string, { rpc: string; operation: string; valueArgument: string; value: boolean }> = {
  kifer_archive_whatsapp_chat: { rpc: 'mcp_comm_whatsapp_set_chat_archived', operation: 'chat.archived.set', valueArgument: 'p_is_archived', value: true },
  kifer_unarchive_whatsapp_chat: { rpc: 'mcp_comm_whatsapp_set_chat_archived', operation: 'chat.archived.set', valueArgument: 'p_is_archived', value: false },
  kifer_pin_whatsapp_chat: { rpc: 'mcp_comm_whatsapp_set_chat_pinned', operation: 'chat.pinned.set', valueArgument: 'p_is_pinned', value: true },
  kifer_unpin_whatsapp_chat: { rpc: 'mcp_comm_whatsapp_set_chat_pinned', operation: 'chat.pinned.set', valueArgument: 'p_is_pinned', value: false },
  kifer_mute_whatsapp_chat: { rpc: 'mcp_comm_whatsapp_set_chat_muted', operation: 'chat.muted.set', valueArgument: 'p_is_muted', value: true },
  kifer_unmute_whatsapp_chat: { rpc: 'mcp_comm_whatsapp_set_chat_muted', operation: 'chat.muted.set', valueArgument: 'p_is_muted', value: false },
};

export async function executeMcpInboxAction(params: {
  supabase: SupabaseClient;
  toolName: string;
  arguments: Args;
  actor: InboxActor;
}): Promise<ActionResult | null> {
  const { supabase, toolName, arguments: args, actor } = params;
  if (!(MCP_INBOX_WRITE_TOOL_NAMES as readonly string[]).includes(toolName)) return null;
  if (!isRecord(args)) return invalid('Informe os argumentos da ação em um objeto JSON.');
  if (Object.keys(args).some((key) => !TOOL_ARGUMENTS[toolName]?.includes(key))) return invalid('A ação contém campos não permitidos.');
  const actorUserId = text(actor.actorId);
  if (!UUID.test(actorUserId)) return { success: false, error_code: 'UNAUTHORIZED', message: 'OAuth admin obrigatório.' };

  const chatId = text(args.chat_id);
  if (!UUID.test(chatId)) return invalid('chat_id deve ser um UUID válido.');
  const expectedUpdatedAt = text(args.expected_updated_at);
  if (!isDateTime(expectedUpdatedAt)) return invalid('expected_updated_at deve ser uma data ISO válida com fuso horário.');
  const clientRequestId = text(args.client_request_id);
  if (!REQUEST_ID.test(clientRequestId)) return invalid('client_request_id deve conter entre 1 e 128 caracteres alfanuméricos, hífen, sublinhado ou dois-pontos.');

  const shared = {
    p_actor_user_id: actorUserId,
    p_chat_id: chatId,
    p_expected_updated_at: expectedUpdatedAt,
    p_client_request_id: clientRequestId,
  };

  const state = STATE_TOOL_MAP[toolName];
  if (state) {
    return callInboxRpc(
      supabase,
      state.rpc,
      { ...shared, [state.valueArgument]: state.value },
      state.operation,
    );
  }

  if (toolName === 'kifer_mark_whatsapp_chat_unread') {
    return callInboxRpc(
      supabase,
      'mcp_comm_whatsapp_set_chat_unread',
      { ...shared, p_is_unread: true },
      'chat.unread.set',
    );
  }

  if (toolName === 'kifer_mark_whatsapp_chat_read') {
    const rawSeenAt = args.last_seen_message_at;
    const rawSeenId = args.last_seen_message_id;
    const seenAt = rawSeenAt === undefined || rawSeenAt === null ? null : rawSeenAt;
    const seenId = rawSeenId === undefined || rawSeenId === null ? null : text(rawSeenId);
    if (seenAt !== null && !isDateTime(seenAt)) return invalid('last_seen_message_at deve ser uma data ISO válida com fuso horário ou nula.');
    if (seenId !== null && !UUID.test(seenId)) return invalid('last_seen_message_id deve ser um UUID válido ou nulo.');
    return callInboxRpc(
      supabase,
      'mcp_comm_whatsapp_mark_chat_read',
      {
        ...shared,
        p_last_seen_message_at: seenAt,
        p_last_seen_message_id: seenId,
      },
      'chat.read',
    );
  }

  if (toolName === 'kifer_link_chat_to_lead') {
    const leadId = text(args.lead_id);
    if (!UUID.test(leadId)) return invalid('lead_id deve ser um UUID válido.');
    return callInboxRpc(
      supabase,
      'mcp_comm_whatsapp_link_chat_lead',
      { ...shared, p_lead_id: leadId },
      'chat.lead.link',
    );
  }

  if (toolName === 'kifer_unlink_chat_from_lead') {
    return callInboxRpc(
      supabase,
      'mcp_comm_whatsapp_unlink_chat_lead',
      shared,
      'chat.lead.unlink',
    );
  }

  return null;
}
