import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

type Args = Record<string, unknown>;
type ActionResult = { success: boolean; [key: string]: unknown };

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const REQUEST_ID = /^[A-Za-z0-9:_-]{1,128}$/;
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const MCP_IDENTITY_CONFLICT_RESOLUTION_TOOL = {
  name: 'kifer_resolve_identity_conflict',
  description: 'Resolve somente conflitos de associação a lead por escolha explícita entre candidatos persistidos. Exige expected_updated_at do conflito, expected_chat_updated_at e client_request_id. Conflitos de identidade externa retornam requires_review e precisam de revalidação server-side; esta ação nunca mescla chats. OAuth admin obrigatório.',
  inputSchema: {
    type: 'object',
    required: ['conflict_id', 'lead_id', 'expected_updated_at', 'expected_chat_updated_at', 'client_request_id'],
    additionalProperties: false,
    properties: {
      conflict_id: { type: 'string', format: 'uuid' },
      lead_id: { type: 'string', format: 'uuid', description: 'Deve constar entre os candidatos retornados por kifer_get_identity_conflict.' },
      expected_updated_at: { type: 'string', format: 'date-time', description: 'updated_at do conflito retornado por kifer_get_identity_conflict.' },
      expected_chat_updated_at: { type: 'string', format: 'date-time', description: 'updated_at da conversa retornado por kifer_get_identity_conflict.' },
      client_request_id: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9:_-]+$' },
    },
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
} as const;

export const MCP_IDENTITY_CONFLICT_TOOLS = [MCP_IDENTITY_CONFLICT_RESOLUTION_TOOL] as const;
export const MCP_IDENTITY_CONFLICT_WRITE_TOOL_NAMES = [MCP_IDENTITY_CONFLICT_RESOLUTION_TOOL.name] as const;

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string'
    && value.length <= 64
    && /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
    && Number.isFinite(Date.parse(value));
}

export async function executeMcpIdentityConflictResolution(params: {
  supabase: SupabaseClient;
  toolName: string;
  arguments: Args;
  actorId: string;
}): Promise<ActionResult | null> {
  const { supabase, toolName, arguments: args, actorId } = params;
  if (toolName !== MCP_IDENTITY_CONFLICT_RESOLUTION_TOOL.name) return null;
  if (!UUID.test(actorId)) {
    return { success: false, error_code: 'UNAUTHORIZED', message: 'OAuth admin obrigatório.' };
  }
  if (Object.keys(args).some((key) => ![
    'conflict_id', 'lead_id', 'expected_updated_at', 'expected_chat_updated_at', 'client_request_id',
  ].includes(key))) {
    return { success: false, error_code: 'INVALID_INPUT', message: 'A resolução contém campos não permitidos.' };
  }

  const conflictId = text(args.conflict_id);
  const leadId = text(args.lead_id);
  const expectedConflictUpdatedAt = args.expected_updated_at;
  const expectedChatUpdatedAt = args.expected_chat_updated_at;
  const clientRequestId = text(args.client_request_id);
  if (!UUID.test(conflictId) || !UUID.test(leadId)
    || !validTimestamp(expectedConflictUpdatedAt) || !validTimestamp(expectedChatUpdatedAt)
    || !REQUEST_ID.test(clientRequestId)) {
    return {
      success: false,
      error_code: 'INVALID_INPUT',
      message: 'Informe conflito, lead candidato, as duas versões atuais e client_request_id válidos.',
    };
  }

  const { data, error } = await supabase.rpc('mcp_resolve_whatsapp_identity_conflict', {
    p_actor_user_id: actorId,
    p_conflict_id: conflictId,
    p_lead_id: leadId,
    p_expected_conflict_updated_at: expectedConflictUpdatedAt,
    p_expected_chat_updated_at: expectedChatUpdatedAt,
    p_client_request_id: clientRequestId,
  });
  if (error) {
    if (error.code === '42501' || error.message?.includes('MCP_ADMIN_REQUIRED')) {
      return { success: false, error_code: 'UNAUTHORIZED', message: 'OAuth admin obrigatório.' };
    }
    if (error.code === 'P0002') {
      return { success: false, error_code: 'NOT_FOUND', message: 'Conflito ou conversa não encontrado.' };
    }
    if (error.code === '40001') {
      return { success: false, error_code: 'CONFLICT', message: 'A resolução já está em andamento; recarregue e tente novamente com outra chave.' };
    }
    if (error.message?.includes('MCP_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD')) {
      return { success: false, error_code: 'IDEMPOTENCY_CONFLICT', message: 'client_request_id já foi usado com outros dados.' };
    }
    if (error.code === '22023') {
      return { success: false, error_code: 'INVALID_INPUT', message: 'Os dados da resolução foram rejeitados.' };
    }
    return { success: false, error_code: 'INTERNAL_ERROR', message: 'Não foi possível resolver o conflito de identidade.' };
  }

  if (!isRecord(data) || typeof data.success !== 'boolean') {
    return { success: false, error_code: 'INTERNAL_ERROR', message: 'Resposta inválida ao resolver conflito de identidade.' };
  }
  if (data.status === 'requires_review') {
    return {
      success: false,
      error_code: 'REQUIRES_REVIEW',
      status: 'requires_review',
      reason: text(data.reason) || 'identity_evidence_requires_server_revalidation',
      message: 'As evidências persistidas não permitem resolver este conflito com segurança; é necessária revisão manual.',
      replayed: data.replayed === true,
    };
  }
  if (data.error_code === 'STALE_WRITE') {
    return {
      success: false,
      error_code: 'STALE_WRITE',
      status: 'stale',
      current_conflict_updated_at: data.current_conflict_updated_at ?? null,
      current_chat_updated_at: data.current_chat_updated_at ?? null,
      replayed: data.replayed === true,
    };
  }
  return data as ActionResult;
}
