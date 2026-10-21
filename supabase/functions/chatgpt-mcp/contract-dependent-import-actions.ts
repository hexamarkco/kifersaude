import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

type Args = Record<string, unknown>;
type Actor = { actorId: string };
type ActionError = { success: false; error_code: string; message: string };
type ActionResult = { success: true; replayed: boolean; contract_id: string; holder_id: string; dependent_id: string; import_id: string } | ActionError;

const TOOL_NAME = 'kifer_create_dependent_from_import';
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const REQUEST_ID = /^[A-Za-z0-9:_-]{1,128}$/;
const ALLOWED_ARGUMENTS = new Set(['contract_id', 'holder_id', 'import_id', 'client_request_id']);
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const writeAnnotation = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

export const MCP_CONTRACT_DEPENDENT_IMPORT_WRITE_TOOL_NAMES = [TOOL_NAME] as const;
export const MCP_CONTRACT_DEPENDENT_IMPORT_TOOLS = [
  {
    name: TOOL_NAME,
    description: 'Cria um dependente a partir de staging privado previamente validado. Envie apenas import_id, contract_id, holder_id e client_request_id; os dados pessoais ficam fora do payload e da auditoria MCP. OAuth admin obrigatório.',
    inputSchema: {
      type: 'object',
      required: ['contract_id', 'holder_id', 'import_id', 'client_request_id'],
      additionalProperties: false,
      properties: {
        contract_id: { type: 'string', format: 'uuid' },
        holder_id: { type: 'string', format: 'uuid' },
        import_id: { type: 'string', format: 'uuid' },
        client_request_id: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[A-Za-z0-9:_-]{1,128}$' },
      },
    },
    annotations: writeAnnotation,
  },
] as const;

const ERROR_RESULTS: Record<string, Omit<ActionError, 'success'>> = {
  MCP_IMPORT_NOT_FOUND: { error_code: 'IMPORT_NOT_FOUND', message: 'Importação de dependente não encontrada.' },
  MCP_IMPORT_EXPIRED: { error_code: 'IMPORT_EXPIRED', message: 'A importação de dependente expirou. Gere uma nova importação.' },
  MCP_IMPORT_ALREADY_CONSUMED: { error_code: 'IMPORT_ALREADY_CONSUMED', message: 'A importação de dependente já foi consumida.' },
  MCP_IMPORT_CONTRACT_MISMATCH: { error_code: 'IMPORT_LINK_MISMATCH', message: 'A importação não está vinculada ao contrato e titular informados.' },
  MCP_HOLDER_NOT_IN_CONTRACT: { error_code: 'HOLDER_NOT_IN_CONTRACT', message: 'O titular não pertence ao contrato informado.' },
  MCP_REQUIRED_DEPENDENT_FIELD_MISSING: { error_code: 'MISSING_REQUIRED_DEPENDENT_FIELDS', message: 'A importação não contém os campos obrigatórios do dependente.' },
  MCP_INVALID_DEPENDENT_DATA: { error_code: 'INVALID_DEPENDENT_DATA', message: 'Os dados importados do dependente são inválidos.' },
  MCP_DUPLICATE_DEPENDENT: { error_code: 'DUPLICATE_DEPENDENT', message: 'Já existe um dependente com estes dados.' },
  MCP_CONTRACT_DEPENDENT_IMPORT_DUPLICATE: { error_code: 'DUPLICATE_IMPORT', message: 'Já existe uma importação igual para este dependente.' },
  MCP_ACTOR_NOT_ACTIVE_ADMIN: { error_code: 'UNAUTHORIZED', message: 'Esta ação exige uma conexão OAuth de administrador ativa.' },
  MCP_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD: { error_code: 'CONFLICT', message: 'client_request_id já foi usado com dados diferentes.' },
};

const internal = (): ActionError => ({
  success: false,
  error_code: 'INTERNAL_ERROR',
  message: 'Não foi possível criar o dependente a partir da importação.',
});

const invalid = (): ActionError => ({
  success: false,
  error_code: 'INVALID_INPUT',
  message: 'contract_id, holder_id, import_id e client_request_id válidos são obrigatórios.',
});

function predictableError(value: unknown): ActionError | null {
  if (!isRecord(value)) return null;
  const messages = [value.message, value.details].filter((part): part is string => typeof part === 'string');
  const key = Object.keys(ERROR_RESULTS).find((candidate) =>
    Object.hasOwn(ERROR_RESULTS, text(value.error_code))
      ? candidate === text(value.error_code)
      : messages.some((message) => new RegExp(`(?:^|[^A-Z0-9_])${candidate}(?:$|[^A-Z0-9_])`).test(message)),
  );
  return key ? { success: false, ...ERROR_RESULTS[key] } : null;
}

export async function executeMcpContractDependentImportAction(params: {
  supabase: SupabaseClient;
  toolName: string;
  arguments: Args;
  actor: Actor;
}): Promise<ActionResult | null> {
  const { supabase, toolName, arguments: args, actor } = params;
  if (toolName !== TOOL_NAME) return null;
  if (!UUID.test(actor.actorId)) return { success: false, error_code: 'UNAUTHORIZED', message: 'OAuth admin obrigatório.' };
  if (Object.keys(args).some((key) => !ALLOWED_ARGUMENTS.has(key))) {
    return { success: false, error_code: 'INVALID_INPUT', message: 'A ação aceita somente contract_id, holder_id, import_id e client_request_id.' };
  }

  const contractId = text(args.contract_id);
  const holderId = text(args.holder_id);
  const importId = text(args.import_id);
  const clientRequestId = text(args.client_request_id);
  if (!UUID.test(contractId) || !UUID.test(holderId) || !UUID.test(importId) || !REQUEST_ID.test(clientRequestId)) return invalid();

  const { data, error } = await supabase.rpc('mcp_create_contract_dependent_from_import', {
    p_actor_user_id: actor.actorId,
    p_import_id: importId,
    p_contract_id: contractId,
    p_holder_id: holderId,
    p_client_request_id: clientRequestId,
  });

  if (error) return predictableError(error) ?? internal();
  if (!isRecord(data)) return internal();
  if (data.success === false) return predictableError(data) ?? internal();
  if (
    (data.replayed !== true && data.replayed !== false)
    || !UUID.test(text(data.import_id))
    || !UUID.test(text(data.contract_id))
    || !UUID.test(text(data.holder_id))
    || !UUID.test(text(data.dependent_id))
    || text(data.import_id).toLowerCase() !== importId.toLowerCase()
    || text(data.contract_id).toLowerCase() !== contractId.toLowerCase()
    || text(data.holder_id).toLowerCase() !== holderId.toLowerCase()
  ) return internal();

  return {
    success: true,
    replayed: data.replayed,
    import_id: text(data.import_id),
    contract_id: text(data.contract_id),
    holder_id: text(data.holder_id),
    dependent_id: text(data.dependent_id),
  };
}
