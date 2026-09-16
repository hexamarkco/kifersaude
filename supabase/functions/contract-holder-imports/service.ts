type RpcError = { message?: string; code?: string } | null;

type HolderImportRpcClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: RpcError }>;
};

export type HolderImportActor = {
  userId: string;
  role: string;
};

type HolderImportRecord = {
  contract_id: string;
  lead_id?: string | null;
  holder: Record<string, unknown>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SINGLE_BODY_BYTES = 40 * 1024;
const MAX_BATCH_BODY_BYTES = 1024 * 1024;
const MAX_BATCH_RECORDS = 25;
const HOLDER_FIELDS = new Set([
  'nome_completo',
  'cpf',
  'rg',
  'data_nascimento',
  'sexo',
  'estado_civil',
  'telefone',
  'email',
  'cep',
  'endereco',
  'numero',
  'complemento',
  'bairro',
  'cidade',
  'estado',
  'cns',
  'cnpj',
  'razao_social',
  'nome_fantasia',
  'percentual_societario',
  'data_abertura_cnpj',
  'bonus_por_vida_aplicado',
]);
const REQUIRED_HOLDER_FIELDS = ['nome_completo', 'cpf', 'data_nascimento', 'telefone'] as const;
const HOLDER_IMPORT_SOURCE = 'other';
const BATCH_IMPORT_SOURCE = 'admin_bulk';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_PATTERN.test(value);

const hasOnlyKeys = (value: Record<string, unknown>, allowedKeys: readonly string[]) =>
  Object.keys(value).every((key) => allowedKeys.includes(key));

const validHolder = (value: unknown): value is Record<string, unknown> => {
  if (!isObject(value) || !Object.keys(value).every((key) => HOLDER_FIELDS.has(key))) return false;
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > 32768) return false;

  for (const field of REQUIRED_HOLDER_FIELDS) {
    if (typeof value[field] !== 'string' || !(value[field] as string).trim()) return false;
  }

  for (const [field, fieldValue] of Object.entries(value)) {
    if (fieldValue === null) continue;
    if (field === 'percentual_societario') {
      if (typeof fieldValue !== 'number' || !Number.isFinite(fieldValue)) return false;
      continue;
    }
    if (field === 'bonus_por_vida_aplicado') {
      if (typeof fieldValue !== 'boolean') return false;
      continue;
    }
    if (typeof fieldValue !== 'string' || fieldValue.length > 2000) return false;
  }

  return true;
};

const validateRecord = (value: unknown): HolderImportRecord | null => {
  if (!isObject(value) || !hasOnlyKeys(value, ['contract_id', 'lead_id', 'holder'])) return null;
  if (!isUuid(value.contract_id) || !validHolder(value.holder)) return null;
  if (value.lead_id !== undefined && value.lead_id !== null && !isUuid(value.lead_id)) return null;

  return {
    contract_id: value.contract_id,
    lead_id: value.lead_id as string | null | undefined,
    holder: value.holder,
  };
};

const jsonResponse = (
  payload: unknown,
  status: number,
  headers: HeadersInit,
) => new Response(JSON.stringify(payload), { status, headers });

const rpcErrorResponse = (error: RpcError, headers: HeadersInit) => {
  const errorCode = error?.message?.match(/^(MCP_[A-Z0-9_]+)$/)?.[1];
  const publicErrors: Record<string, { status: number; message: string }> = {
    MCP_ACTOR_NOT_ACTIVE_ADMIN: { status: 403, message: 'Usuário sem permissão para preparar titulares.' },
    MCP_CONTRACT_NOT_FOUND: { status: 404, message: 'Contrato não encontrado.' },
    MCP_CONTRACT_ALREADY_HAS_HOLDER: { status: 409, message: 'Este contrato já possui titular.' },
    MCP_IMPORT_CONTRACT_MISMATCH: { status: 422, message: 'O titular não corresponde ao contrato informado.' },
    MCP_INVALID_HOLDER_DATA: { status: 422, message: 'Revise os dados informados para o titular.' },
    MCP_MISSING_REQUIRED_HOLDER_FIELDS: { status: 422, message: 'Preencha os campos obrigatórios do titular.' },
    MCP_DUPLICATE_HOLDER: { status: 409, message: 'Já existe um titular com esses dados.' },
  };
  const knownError = errorCode ? publicErrors[errorCode] : undefined;

  return jsonResponse({
    success: false,
    error_code: knownError ? errorCode : 'INTERNAL_ERROR',
    message: knownError?.message ?? 'Não foi possível preparar o titular para importação.',
  }, knownError?.status ?? 500, headers);
};

const getRequestId = (req: Request) => {
  const provided = req.headers.get('X-Idempotency-Key')?.trim();
  if (provided && !isUuid(provided)) return null;
  return `admin-holder-${provided || crypto.randomUUID()}`;
};

const parseJsonBody = async (req: Request, maxBytes: number): Promise<unknown | null> => {
  const contentType = req.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') return null;

  const contentLength = Number(req.headers.get('Content-Length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) return null;

  const reader = req.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // The request has already been rejected; cancellation errors are not user-facing.
      }
      return null;
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch {
    return null;
  }
};

const createStaging = async (
  client: HolderImportRpcClient,
  actorId: string,
  requestId: string,
  record: HolderImportRecord,
  source: string,
) => client.rpc('create_contract_holder_import', {
  p_actor_user_id: actorId,
  p_client_request_id: requestId,
  p_holder_payload: record.holder,
  p_lead_id: record.lead_id ?? null,
  p_contract_id: record.contract_id,
  p_source: source,
  p_ttl_hours: 24,
});

const extractSuccess = (data: unknown): { import_id: string; expires_at: string } | null => {
  if (!isObject(data) || data.success !== true || !isUuid(data.import_id)) return null;
  if (typeof data.expires_at !== 'string' || !Number.isFinite(Date.parse(data.expires_at))) return null;
  return { import_id: data.import_id, expires_at: data.expires_at };
};

export async function handleContractHolderImportRequest({
  req,
  supabaseAdmin,
  actor,
  headers,
}: {
  req: Request;
  supabaseAdmin: HolderImportRpcClient;
  actor: HolderImportActor;
  headers: HeadersInit;
}): Promise<Response> {
  if (actor.role !== 'admin') {
    return jsonResponse({ error: 'Permissão insuficiente.' }, 403, headers);
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido.' }, 405, headers);
  }

  const pathParts = new URL(req.url).pathname.split('/').filter(Boolean);
  const route = pathParts.at(-1);
  const isBatch = route === 'batch';
  if (!isBatch && route !== 'contract-holder-imports') {
    return jsonResponse({ error: 'Rota não encontrada.' }, 404, headers);
  }

  const requestId = getRequestId(req);
  if (!requestId) {
    return jsonResponse({ error: 'Identificador de requisição inválido.' }, 400, headers);
  }

  const body = await parseJsonBody(req, isBatch ? MAX_BATCH_BODY_BYTES : MAX_SINGLE_BODY_BYTES);
  if (body === null) {
    return jsonResponse({ error: 'Envie um JSON válido dentro do limite permitido.' }, 400, headers);
  }

  if (!isBatch) {
    const record = validateRecord(body);
    if (!record) {
      return jsonResponse({ error: 'Informe contrato e dados válidos do titular.' }, 400, headers);
    }

    const { data, error } = await createStaging(
      supabaseAdmin,
      actor.userId,
      requestId,
      record,
      HOLDER_IMPORT_SOURCE,
    );
    if (error) return rpcErrorResponse(error, headers);

    const staged = extractSuccess(data);
    if (!staged) {
      return jsonResponse({
        success: false,
        error_code: 'INTERNAL_ERROR',
        message: 'Não foi possível preparar o titular para importação.',
      }, 500, headers);
    }

    return jsonResponse({ success: true, ...staged }, 200, headers);
  }

  if (!Array.isArray(body) || body.length === 0 || body.length > MAX_BATCH_RECORDS) {
    return jsonResponse({ error: `Envie de 1 a ${MAX_BATCH_RECORDS} registros válidos.` }, 400, headers);
  }

  const records = body.map(validateRecord);
  if (records.some((record) => record === null)) {
    return jsonResponse({ error: 'Um ou mais registros são inválidos.' }, 400, headers);
  }
  const validatedRecords = records as HolderImportRecord[];
  const contractIds = validatedRecords.map((record) => record.contract_id);
  if (new Set(contractIds).size !== contractIds.length) {
    return jsonResponse({ error: 'Cada contrato pode aparecer apenas uma vez por lote.' }, 400, headers);
  }

  const results: Array<{ import_id: string | null; contract_id: string; status: 'created' | 'failed' }> = [];
  for (const [index, record] of validatedRecords.entries()) {
    const { data, error } = await createStaging(
      supabaseAdmin,
      actor.userId,
      `${requestId}:${index + 1}`,
      record,
      BATCH_IMPORT_SOURCE,
    );
    const staged = error ? null : extractSuccess(data);
    results.push({
      import_id: staged?.import_id ?? null,
      contract_id: record.contract_id,
      status: staged ? 'created' : 'failed',
    });
  }

  return jsonResponse(results, 200, headers);
}
