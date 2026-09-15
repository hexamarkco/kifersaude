import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

type Args = Record<string, unknown>;
type ContactPermissionActor = { actorId: string };
type ActionResult = { success: boolean; [key: string]: unknown };
type Channel = 'whatsapp' | 'sms' | 'email' | 'phone_call';
type Scope = 'global' | 'commercial' | 'service_reply' | 'transactional';
type PermissionState = 'blocked' | 'allowed' | 'unknown';

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const REQUEST_ID = /^[A-Za-z0-9:_-]{1,128}$/;
const CHANNELS = new Set<Channel>(['whatsapp', 'sms', 'email', 'phone_call']);
const SCOPES = new Set<Scope>(['global', 'commercial', 'service_reply', 'transactional']);
const STATES = new Set<PermissionState>(['blocked', 'allowed', 'unknown']);
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

type PermissionChange = {
  channel: Channel;
  endpoint: string;
  purpose_scope: Scope;
  state: PermissionState;
  lead_id?: string | null;
  expected_updated_at?: string;
  reason?: string;
  evidence?: Record<string, unknown>;
};

const invalid = (message: string): ActionResult => ({
  success: false,
  error_code: 'INVALID_INPUT',
  message,
});

const internal = (): ActionResult => ({
  success: false,
  error_code: 'INTERNAL_ERROR',
  message: 'Não foi possível consultar ou atualizar a permissão de contato.',
});

function normalizedEndpoint(channel: Channel, endpoint: string): string {
  return channel === 'email' ? endpoint.trim().toLowerCase() : endpoint.replace(/\D/g, '');
}

function readChange(value: unknown): PermissionChange | null {
  if (!isRecord(value)) return null;
  const allowedKeys = new Set([
    'channel', 'endpoint', 'purpose_scope', 'state', 'reason', 'evidence',
    'lead_id', 'expected_updated_at',
  ]);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) return null;
  const channel = text(value.channel) as Channel;
  const endpoint = text(value.endpoint);
  const purposeScope = text(value.purpose_scope) as Scope;
  const state = text(value.state) as PermissionState;
  const leadId = value.lead_id === undefined || value.lead_id === null ? value.lead_id : text(value.lead_id);
  const expectedUpdatedAt = value.expected_updated_at === undefined ? undefined : text(value.expected_updated_at);
  const reason = value.reason === undefined ? undefined : text(value.reason);
  const evidence = value.evidence === undefined ? {} : value.evidence;
  if (!CHANNELS.has(channel) || endpoint.length < 3 || endpoint.length > 320
    || !SCOPES.has(purposeScope) || !STATES.has(state)
    || (typeof leadId === 'string' && !UUID.test(leadId))
    || (expectedUpdatedAt !== undefined && (!expectedUpdatedAt || !Number.isFinite(Date.parse(expectedUpdatedAt))))
    || (reason !== undefined && reason.length > 1000)
    || !isRecord(evidence)) return null;
  return {
    channel,
    endpoint,
    purpose_scope: purposeScope,
    state,
    lead_id: leadId,
    expected_updated_at: expectedUpdatedAt,
    reason,
    evidence,
  };
}

async function callPermissionRpc(
  supabase: SupabaseClient,
  functionName: string,
  parameters: Record<string, unknown>,
): Promise<ActionResult> {
  const { data, error } = await supabase.rpc(functionName, parameters);
  if (error) {
    const errorText = `${error.code ?? ''} ${error.message ?? ''}`;
    if (error.code === '42501' || errorText.includes('MCP_ADMIN_REQUIRED')) {
      return { success: false, error_code: 'UNAUTHORIZED', message: 'OAuth admin obrigatório.' };
    }
    if (errorText.includes('CONTACT_PERMISSION_IDEMPOTENCY_CONFLICT')) {
      return { success: false, error_code: 'IDEMPOTENCY_CONFLICT', message: 'client_request_id já foi usado com parâmetros diferentes.' };
    }
    if (errorText.includes('CONTACT_PERMISSION_BULK_LIMIT')) {
      return invalid('O lote deve conter de 1 a 50 alterações.');
    }
    if (errorText.includes('CONTACT_PERMISSION_LEAD_ENDPOINT_MISMATCH')) {
      return invalid('lead_id deve ser um lead ativo com telefone/e-mail igual ao endpoint normalizado.');
    }
    return internal();
  }
  if (!isRecord(data) || typeof data.success !== 'boolean') return internal();
  return data as ActionResult;
}

export const MCP_CONTACT_PERMISSION_READ_TOOL_NAMES = [
  'kifer_get_contact_permission',
] as const;

export const MCP_CONTACT_PERMISSION_WRITE_TOOL_NAMES = [
  'kifer_set_contact_permission',
  'kifer_bulk_set_contact_permission',
] as const;

export const MCP_CONTACT_PERMISSION_TOOLS = [
  {
    name: 'kifer_get_contact_permission',
    description: 'Consulta permissões atuais de contato por canal e endpoint normalizado, incluindo bloqueios globais. Não busca nem propaga preferências de familiares. OAuth admin obrigatório.',
    inputSchema: {
      type: 'object',
      required: ['channel', 'endpoint'],
      additionalProperties: false,
      properties: {
        channel: { type: 'string', enum: ['whatsapp', 'sms', 'email', 'phone_call'] },
        endpoint: { type: 'string', minLength: 3, maxLength: 320 },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'kifer_set_contact_permission',
    description: 'Registra uma permissão explícita para um endpoint e escopo. allowed representa consentimento apenas para o escopo informado; global afeta todos os envios. Para alterar política existente, envie expected_updated_at da última leitura. lead_id é validado contra o endpoint. Toda decisão fica em auditoria append-only. Exige client_request_id e OAuth admin.',
    inputSchema: {
      type: 'object',
      required: ['client_request_id', 'channel', 'endpoint', 'purpose_scope', 'state'],
      additionalProperties: false,
      properties: {
        client_request_id: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9:_-]+$' },
        channel: { type: 'string', enum: ['whatsapp', 'sms', 'email', 'phone_call'] },
        endpoint: { type: 'string', minLength: 3, maxLength: 320 },
        purpose_scope: { type: 'string', enum: ['global', 'commercial', 'service_reply', 'transactional'] },
        state: { type: 'string', enum: ['blocked', 'allowed', 'unknown'] },
        lead_id: { type: ['string', 'null'], format: 'uuid' },
        expected_updated_at: { type: 'string', format: 'date-time' },
        reason: { type: 'string', maxLength: 1000 },
        evidence: { type: 'object' },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: 'kifer_bulk_set_contact_permission',
    description: 'Registra de forma atômica até 50 permissões explícitas para endpoints/escopos diferentes. Para alterar políticas existentes, cada item deve incluir expected_updated_at da última leitura. lead_id é validado contra o endpoint; quando omitido, só associa correspondência única com lead ativo. Não propaga preferências entre familiares; duplicatas do mesmo endpoint/escopo são recusadas. Exige client_request_id e OAuth admin.',
    inputSchema: {
      type: 'object',
      required: ['client_request_id', 'changes'],
      additionalProperties: false,
      properties: {
        client_request_id: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9:_-]+$' },
        changes: {
          type: 'array', minItems: 1, maxItems: 50,
          items: {
            type: 'object',
            required: ['channel', 'endpoint', 'purpose_scope', 'state'],
            additionalProperties: false,
            properties: {
              channel: { type: 'string', enum: ['whatsapp', 'sms', 'email', 'phone_call'] },
              endpoint: { type: 'string', minLength: 3, maxLength: 320 },
              purpose_scope: { type: 'string', enum: ['global', 'commercial', 'service_reply', 'transactional'] },
              state: { type: 'string', enum: ['blocked', 'allowed', 'unknown'] },
              lead_id: { type: ['string', 'null'], format: 'uuid' },
              expected_updated_at: { type: 'string', format: 'date-time' },
              reason: { type: 'string', maxLength: 1000 },
              evidence: { type: 'object' },
            },
          },
        },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
] as const;

export async function executeMcpContactPermissionReadAction(params: {
  supabase: SupabaseClient;
  toolName: string;
  arguments: Args;
  actorId: string;
}): Promise<ActionResult | null> {
  const { supabase, toolName, arguments: args, actorId } = params;
  if (toolName !== 'kifer_get_contact_permission') return null;
  const channel = text(args.channel) as Channel;
  const endpoint = text(args.endpoint);
  if (!UUID.test(actorId)) return { success: false, error_code: 'UNAUTHORIZED', message: 'OAuth admin obrigatório.' };
  if (!CHANNELS.has(channel) || endpoint.length < 3 || endpoint.length > 320) {
    return invalid('Informe channel e endpoint válidos.');
  }
  return callPermissionRpc(supabase, 'mcp_get_contact_permission', {
    p_actor_user_id: actorId,
    p_channel: channel,
    p_endpoint: endpoint,
  });
}

export async function executeMcpContactPermissionWriteAction(params: {
  supabase: SupabaseClient;
  toolName: string;
  arguments: Args;
  actor: ContactPermissionActor;
}): Promise<ActionResult | null> {
  const { supabase, toolName, arguments: args, actor } = params;
  if (!(MCP_CONTACT_PERMISSION_WRITE_TOOL_NAMES as readonly string[]).includes(toolName)) return null;
  if (!UUID.test(actor.actorId)) return { success: false, error_code: 'UNAUTHORIZED', message: 'OAuth admin obrigatório.' };

  const clientRequestId = text(args.client_request_id);
  if (!REQUEST_ID.test(clientRequestId)) return invalid('client_request_id deve ter de 1 a 128 caracteres alfanuméricos, : _ ou -.');

  if (toolName === 'kifer_set_contact_permission') {
    const singleChange: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(args)) {
      if (key !== 'client_request_id') singleChange[key] = value;
    }
    const change = readChange(singleChange);
    if (!change) return invalid('Informe channel, endpoint, purpose_scope e state válidos; reason e evidence são opcionais.');
    return callPermissionRpc(supabase, 'mcp_set_contact_permission', {
      p_actor_user_id: actor.actorId,
      p_client_request_id: clientRequestId,
      p_channel: change.channel,
      p_endpoint: change.endpoint,
      p_purpose_scope: change.purpose_scope,
      p_state: change.state,
      p_reason: change.reason ?? null,
      p_evidence: change.evidence ?? {},
      p_lead_id: change.lead_id ?? null,
      p_expected_updated_at: change.expected_updated_at ?? null,
    });
  }

  if (!Array.isArray(args.changes) || args.changes.length < 1 || args.changes.length > 50) {
    return invalid('changes deve conter de 1 a 50 alterações.');
  }
  const changes = args.changes.map(readChange);
  if (changes.some((change) => change === null)) return invalid('Cada alteração deve conter um canal, endpoint, escopo e estado válidos.');
  const normalizedChanges = changes as PermissionChange[];
  const targets = normalizedChanges.map((change) =>
    `${change.channel}|${normalizedEndpoint(change.channel, change.endpoint)}|${change.purpose_scope}`,
  );
  if (new Set(targets).size !== targets.length) return invalid('O lote contém endpoints e escopos duplicados.');

  return callPermissionRpc(supabase, 'mcp_bulk_set_contact_permission', {
    p_actor_user_id: actor.actorId,
    p_client_request_id: clientRequestId,
    p_changes: normalizedChanges,
  });
}
