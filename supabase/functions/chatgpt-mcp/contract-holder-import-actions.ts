import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

type Args = Record<string, unknown>;
type Actor = { actorId: string };
type ActionError = {
  success: false;
  error_code: string;
  message: string;
  missing_fields?: string[];
};
type ActionSuccess = {
  success: true;
  replayed: boolean;
  contract_id: string;
  holder_id: string;
  import_id: string;
};
type ActionResult = ActionSuccess | ActionError;

const TOOL_NAME = 'kifer_create_contract_holder_from_import';
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const REQUEST_ID = /^[A-Za-z0-9:_-]{1,128}$/;
const ALLOWED_ARGUMENTS = new Set(['contract_id', 'import_id', 'client_request_id']);
const REQUIRED_HOLDER_FIELDS = new Set(['nome_completo', 'cpf', 'data_nascimento', 'telefone']);
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const writeAnnotation = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

export const MCP_CONTRACT_HOLDER_IMPORT_WRITE_TOOL_NAMES = [TOOL_NAME] as const;

export const MCP_CONTRACT_HOLDER_IMPORT_TOOLS = [
  {
    name: TOOL_NAME,
    description: 'Cria o titular de um contrato usando dados previamente armazenados em staging privado. O payload MCP contém somente identificadores opacos e não contém os dados pessoais do titular. OAuth admin obrigatório.',
    inputSchema: {
      type: 'object',
      required: ['contract_id', 'import_id', 'client_request_id'],
      additionalProperties: false,
      properties: {
        contract_id: { type: 'string', format: 'uuid' },
        import_id: { type: 'string', format: 'uuid' },
        client_request_id: { type: 'string', minLength: 1, maxLength: 128 },
      },
    },
    annotations: writeAnnotation,
  },
] as const;

const ERROR_RESULTS: Record<string, Omit<ActionError, 'success'>> = {
  MCP_IMPORT_NOT_FOUND: { error_code: 'IMPORT_NOT_FOUND', message: 'Importação de titular não encontrada.' },
  MCP_IMPORT_EXPIRED: { error_code: 'IMPORT_EXPIRED', message: 'A importação de titular expirou. Gere uma nova importação.' },
  MCP_IMPORT_ALREADY_CONSUMED: { error_code: 'IMPORT_ALREADY_CONSUMED', message: 'A importação de titular já foi consumida.' },
  MCP_IMPORT_CONTRACT_MISMATCH: { error_code: 'IMPORT_CONTRACT_MISMATCH', message: 'A importação não está vinculada a este contrato.' },
  MCP_CONTRACT_NOT_FOUND: { error_code: 'CONTRACT_NOT_FOUND', message: 'Contrato não encontrado.' },
  MCP_CONTRACT_ALREADY_HAS_HOLDER: { error_code: 'CONTRACT_ALREADY_HAS_HOLDER', message: 'O contrato já possui titular.' },
  MCP_MISSING_REQUIRED_HOLDER_FIELDS: { error_code: 'MISSING_REQUIRED_HOLDER_FIELDS', message: 'A importação não contém todos os campos obrigatórios do titular.' },
  MCP_INVALID_HOLDER_DATA: { error_code: 'INVALID_HOLDER_DATA', message: 'Os dados importados do titular são inválidos.' },
  MCP_DUPLICATE_HOLDER: { error_code: 'DUPLICATE_HOLDER', message: 'Já existe um titular com estes dados.' },
  MCP_ACTOR_NOT_ACTIVE_ADMIN: { error_code: 'UNAUTHORIZED', message: 'Esta ação exige uma conexão OAuth de administrador ativa.' },
  MCP_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD: {
    error_code: 'CONFLICT',
    message: 'client_request_id já foi usado com dados diferentes.',
  },
};

const internal = (): ActionError => ({
  success: false,
  error_code: 'INTERNAL_ERROR',
  message: 'Não foi possível criar o titular a partir da importação.',
});

const invalid = (message: string): ActionError => ({
  success: false,
  error_code: 'INVALID_INPUT',
  message,
});

function safeMissingFields(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const fields = [...new Set(value.filter((field): field is string =>
    typeof field === 'string' && REQUIRED_HOLDER_FIELDS.has(field),
  ))];
  return fields.length > 0 ? fields : undefined;
}

function missingFieldsFromDetails(details: unknown): string[] | undefined {
  if (typeof details !== 'string') return undefined;
  try {
    const parsed: unknown = JSON.parse(details);
    if (isRecord(parsed)) return safeMissingFields(parsed.missing_fields);
    return safeMissingFields(parsed);
  } catch {
    return undefined;
  }
}

function predictableError(value: unknown): ActionError | null {
  if (!isRecord(value)) return null;

  const rawCode = text(value.error_code);
  let errorKey = Object.hasOwn(ERROR_RESULTS, rawCode)
    ? rawCode
    : Object.entries(ERROR_RESULTS).find(([, mapped]) => mapped.error_code === rawCode)?.[0] ?? '';
  if (!errorKey) {
    const messages = [value.message, value.details]
      .filter((part): part is string => typeof part === 'string');
    errorKey = Object.keys(ERROR_RESULTS).find((candidate) =>
      messages.some((message) => new RegExp(`(?:^|[^A-Z0-9_])${candidate}(?:$|[^A-Z0-9_])`).test(message)),
    ) ?? '';
  }
  if (!errorKey) return null;

  const mapped = ERROR_RESULTS[errorKey];
  const result: ActionError = { success: false, ...mapped };
  const missingFields = safeMissingFields(value.missing_fields) ?? missingFieldsFromDetails(value.details);
  if (mapped.error_code === 'MISSING_REQUIRED_HOLDER_FIELDS' && missingFields) {
    result.missing_fields = missingFields;
  }
  return result;
}

export async function executeMcpContractHolderImportAction(params: {
  supabase: SupabaseClient;
  toolName: string;
  arguments: Args;
  actor: Actor;
}): Promise<ActionResult | null> {
  const { supabase, toolName, arguments: args, actor } = params;
  if (!(MCP_CONTRACT_HOLDER_IMPORT_WRITE_TOOL_NAMES as readonly string[]).includes(toolName)) return null;
  if (!UUID.test(actor.actorId)) {
    return { success: false, error_code: 'UNAUTHORIZED', message: 'OAuth admin obrigatório.' };
  }
  if (Object.keys(args).some((key) => !ALLOWED_ARGUMENTS.has(key))) {
    return invalid('A ação aceita somente contract_id, import_id e client_request_id.');
  }

  const contractId = text(args.contract_id);
  const importId = text(args.import_id);
  const clientRequestId = text(args.client_request_id);
  if (!UUID.test(contractId) || !UUID.test(importId) || !REQUEST_ID.test(clientRequestId)) {
    return invalid('contract_id, import_id e client_request_id válidos são obrigatórios.');
  }

  const { data, error } = await supabase.rpc('mcp_create_contract_holder_from_import', {
    p_actor_user_id: actor.actorId,
    p_contract_id: contractId,
    p_import_id: importId,
    p_client_request_id: clientRequestId,
  });

  if (error) return predictableError(error) ?? internal();
  if (!isRecord(data)) return internal();
  if (data.success === false) return predictableError(data) ?? internal();

  if (
    data.replayed !== true && data.replayed !== false
    || !UUID.test(text(data.contract_id))
    || !UUID.test(text(data.holder_id))
    || !UUID.test(text(data.import_id))
    || text(data.contract_id).toLowerCase() !== contractId.toLowerCase()
    || text(data.import_id).toLowerCase() !== importId.toLowerCase()
  ) return internal();

  return {
    success: true,
    replayed: data.replayed,
    contract_id: text(data.contract_id),
    holder_id: text(data.holder_id),
    import_id: text(data.import_id),
  };
}
