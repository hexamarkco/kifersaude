import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

type Args = Record<string, unknown>;
type Actor = { actorId: string };
type ActionResult = { success: boolean; [key: string]: unknown };
type EntityType = 'lead' | 'contract' | 'contract_holder' | 'dependent';

const BUCKET = 'contract-documents-private';
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 120;
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const REQUEST_ID = /^[A-Za-z0-9:_-]{1,128}$/;
const ENTITY_TYPES = new Set<EntityType>(['lead', 'contract', 'contract_holder', 'dependent']);
const MIME_EXTENSIONS = new Map([
  ['application/pdf', 'pdf'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

const writeAnnotation = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
const stringField = (maxLength: number, minLength = 1) => ({ type: 'string', minLength, maxLength });
const uuidField = { type: 'string', format: 'uuid' } as const;
const timestampField = { type: 'string', format: 'date-time' } as const;

export const MCP_CONTRACT_DOCUMENT_TOOL_NAMES = [
  'kifer_list_documents',
  'kifer_get_document',
  'kifer_upload_document',
  'kifer_update_document_metadata',
  'kifer_delete_document',
] as const;

export const MCP_CONTRACT_DOCUMENT_TOOLS = [
  {
    name: 'kifer_list_documents',
    description: 'Lista documentos ativos de lead, contrato, titular ou dependente. Arquivos novos recebem URL assinada privada por 120 segundos; documentos legados preservam sua URL original. OAuth admin obrigatório.',
    inputSchema: {
      type: 'object', required: ['entity_type', 'entity_id'], additionalProperties: false,
      properties: {
        entity_type: { type: 'string', enum: ['lead', 'contract', 'contract_holder', 'dependent'] },
        entity_id: uuidField,
        limit: { type: 'integer', minimum: 1, maximum: 100 },
        before_created_at: timestampField,
        before_document_id: uuidField,
      },
    },
    annotations: { ...writeAnnotation, readOnlyHint: true },
  },
  {
    name: 'kifer_get_document',
    description: 'Obtém metadados e acesso temporário privado de um documento. URLs privadas expiram em 120 segundos; documentos legados permanecem somente leitura. OAuth admin obrigatório.',
    inputSchema: { type: 'object', required: ['document_id'], additionalProperties: false, properties: { document_id: uuidField } },
    annotations: { ...writeAnnotation, readOnlyHint: true },
  },
  {
    name: 'kifer_upload_document',
    description: 'Envia PDF ou imagem permitida de até 20 MB para armazenamento privado e registra metadados com validação de entidade e idempotência. OAuth admin obrigatório.',
    inputSchema: {
      type: 'object',
      required: ['client_request_id', 'entity_type', 'entity_id', 'tipo_documento', 'nome_arquivo', 'mime_type', 'content_base64'],
      additionalProperties: false,
      properties: {
        client_request_id: stringField(128),
        entity_type: { type: 'string', enum: ['lead', 'contract', 'contract_holder', 'dependent'] },
        entity_id: uuidField,
        tipo_documento: stringField(80),
        nome_arquivo: stringField(255),
        mime_type: { type: 'string', enum: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] },
        content_base64: stringField(Math.ceil(MAX_DOCUMENT_BYTES / 3) * 4),
      },
    },
    annotations: writeAnnotation,
  },
  {
    name: 'kifer_update_document_metadata',
    description: 'Atualiza apenas o tipo e o nome do arquivo, usando expected_updated_at para evitar sobrescrever uma alteração concorrente. O conteúdo não é substituído; faça novo upload e depois exclua o anterior. OAuth admin obrigatório.',
    inputSchema: {
      type: 'object', required: ['client_request_id', 'document_id', 'expected_updated_at', 'tipo_documento', 'nome_arquivo'], additionalProperties: false,
      properties: {
        client_request_id: stringField(128),
        document_id: uuidField,
        expected_updated_at: timestampField,
        tipo_documento: stringField(80),
        nome_arquivo: stringField(255),
      },
    },
    annotations: writeAnnotation,
  },
  {
    name: 'kifer_delete_document',
    description: 'Exclui logicamente o documento e remove o objeto privado por Storage API com repetição segura; a operação exige expected_updated_at e client_request_id. Documentos legados são somente leitura. OAuth admin obrigatório.',
    inputSchema: {
      type: 'object', required: ['client_request_id', 'document_id', 'expected_updated_at'], additionalProperties: false,
      properties: { client_request_id: stringField(128), document_id: uuidField, expected_updated_at: timestampField },
    },
    annotations: { ...writeAnnotation, destructiveHint: true },
  },
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const validTimestamp = (value: unknown) => Boolean(text(value)) && Number.isFinite(Date.parse(text(value)));
const invalid = (message: string): ActionResult => ({ success: false, error_code: 'INVALID_INPUT', message });
const internal = (): ActionResult => ({ success: false, error_code: 'INTERNAL_ERROR', message: 'Não foi possível executar a operação de documentos.' });

function rpcFailure(error: unknown): ActionResult {
  if (!isRecord(error)) return internal();
  const code = String(error.code ?? '');
  const message = String(error.message ?? '');
  if (/ACTIVE_ADMIN|ADMIN_REQUIRED|UNAUTHORIZED/i.test(message) || code === '42501') {
    return { success: false, error_code: 'UNAUTHORIZED', message: 'OAuth admin obrigatório para documentos.' };
  }
  if (/NOT_FOUND|ENTITY_NOT_FOUND|STORAGE_OBJECT_REQUIRED|DOCUMENT_DELETED/i.test(message) || code === 'P0002') {
    return { success: false, error_code: 'NOT_FOUND', message: 'Documento ou entidade não encontrado.' };
  }
  if (/CONCURRENCY_CONFLICT/i.test(message) || code === '40001') {
    return { success: false, error_code: 'CONFLICT', message: 'O documento foi alterado. Consulte os dados atuais e tente novamente.' };
  }
  if (/INVALID|MISMATCH|LEGACY_DOCUMENT_READ_ONLY/i.test(message) || code === '22023') {
    return { success: false, error_code: 'INVALID_INPUT', message: 'Os dados do documento são inválidos ou não podem ser alterados.' };
  }
  return internal();
}

async function callDocumentRpc(
  supabase: SupabaseClient,
  name: string,
  parameters: Record<string, unknown>,
): Promise<{ data: Record<string, unknown> } | { error: ActionResult }> {
  try {
    const { data, error } = await supabase.rpc(name, parameters);
    if (error) return { error: rpcFailure(error) };
    if (!isRecord(data)) return { error: internal() };
    if (data.success === false) return { error: data as ActionResult };
    return { data };
  } catch {
    return { error: internal() };
  }
}

function assertActor(actorId: string): boolean {
  return UUID.test(actorId);
}

function documentView(row: Record<string, unknown>, signedUrl?: string): Record<string, unknown> {
  const { storage_object_path: _path, storage_bucket_id: _bucket, sha256_hex: _hash, ...publicMetadata } = row;
  return {
    ...publicMetadata,
    ...(signedUrl ? { signed_url: signedUrl, signed_url_expires_in: SIGNED_URL_TTL_SECONDS } : {}),
  };
}

async function signDocument(supabase: SupabaseClient, document: Record<string, unknown>): Promise<string | null> {
  if (document.is_legacy === true) return null;
  if (document.storage_bucket_id !== BUCKET || typeof document.storage_object_path !== 'string') return null;
  try {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(document.storage_object_path, SIGNED_URL_TTL_SECONDS);
    return error || typeof data?.signedUrl !== 'string' ? null : data.signedUrl;
  } catch {
    return null;
  }
}

async function listDocuments(supabase: SupabaseClient, actorId: string, args: Args): Promise<ActionResult> {
  const entityType = text(args.entity_type) as EntityType;
  const entityId = text(args.entity_id);
  const hasBeforeCreatedAt = args.before_created_at !== undefined && args.before_created_at !== null;
  const hasBeforeId = args.before_document_id !== undefined && args.before_document_id !== null;
  const limit = args.limit === undefined ? 50 : Number(args.limit);
  if (!ENTITY_TYPES.has(entityType) || !UUID.test(entityId)) return invalid('entity_type e entity_id válidos são obrigatórios.');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return invalid('limit deve estar entre 1 e 100.');
  if (hasBeforeCreatedAt !== hasBeforeId || (hasBeforeCreatedAt && (!validTimestamp(args.before_created_at) || !UUID.test(text(args.before_document_id))))) {
    return invalid('before_created_at e before_document_id devem ser informados juntos e válidos.');
  }
  const result = await callDocumentRpc(supabase, 'mcp_contract_documents_list', {
    p_actor_user_id: actorId,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_limit: limit,
    p_before_created_at: hasBeforeCreatedAt ? text(args.before_created_at) : null,
    p_before_document_id: hasBeforeId ? text(args.before_document_id) : null,
  });
  if ('error' in result) return result.error;
  if (!Array.isArray(result.data.documents)) return internal();
  const documents = await Promise.all(result.data.documents.map(async (item) => {
    if (!isRecord(item)) return null;
    const signedUrl = await signDocument(supabase, item);
    const view = documentView(item, signedUrl ?? undefined);
    if (item.is_legacy !== true && !signedUrl) view.download_available = false;
    return view;
  }));
  return { success: true, ...result.data, documents: documents.filter((document) => document !== null) };
}

async function getDocument(supabase: SupabaseClient, actorId: string, documentId: string): Promise<ActionResult> {
  if (!UUID.test(documentId)) return invalid('document_id deve ser um UUID válido.');
  const result = await callDocumentRpc(supabase, 'mcp_contract_document_get', {
    p_actor_user_id: actorId,
    p_document_id: documentId,
  });
  if ('error' in result) return result.error;
  const signedUrl = await signDocument(supabase, result.data);
  const document = documentView(result.data, signedUrl ?? undefined);
  if (result.data.is_legacy !== true && !signedUrl) document.download_available = false;
  return { success: true, document };
}

function decodeDocumentBase64(value: unknown, mimeType: string): Uint8Array | ActionResult {
  if (typeof value !== 'string') return invalid('content_base64 deve conter o arquivo em base64.');
  let encoded = value.trim();
  const dataUri = encoded.match(/^data:([^;,]+);base64,(.*)$/is);
  if (dataUri) {
    if (dataUri[1].toLowerCase() !== mimeType) return invalid('O MIME da data URI não corresponde a mime_type.');
    encoded = dataUri[2];
  }
  if (!encoded || encoded.length > Math.ceil(MAX_DOCUMENT_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 === 1) {
    return invalid('content_base64 inválido ou excede 20 MB.');
  }
  const firstPadding = encoded.indexOf('=');
  if (firstPadding >= 0 && (encoded.length % 4 !== 0 || encoded.length - firstPadding > 2)) return invalid('content_base64 inválido.');
  let bytes: Uint8Array;
  try {
    const binary = atob(encoded);
    bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return invalid('content_base64 não contém um arquivo válido.');
  }
  if (bytes.byteLength === 0) return invalid('O arquivo anexado está vazio.');
  if (bytes.byteLength > MAX_DOCUMENT_BYTES) return invalid('O arquivo excede o limite de 20 MB.');
  if (!matchesMagicBytes(bytes, mimeType)) return invalid('O conteúdo do arquivo não corresponde ao MIME informado.');
  return bytes;
}

function matchesMagicBytes(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === 'application/pdf') return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
  if (mimeType === 'image/png') return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/webp') return bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP';
  return false;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function stableObjectUuid(actorId: string, requestId: string, hash: string): Promise<string> {
  const input = new TextEncoder().encode(`${actorId}:${requestId}:${hash}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', input)).slice(0, 16);
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isStorageConflict(error: unknown): boolean {
  if (!isRecord(error)) return false;
  return String(error.statusCode ?? error.status ?? '') === '409' || /already exists|duplicate/i.test(String(error.message ?? ''));
}

async function retryStorageRemoval(supabase: SupabaseClient, path: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const { error } = await supabase.storage.from(BUCKET).remove([path]);
      if (!error) return true;
    } catch {
      // A later bounded retry covers transient Storage errors and lost responses.
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
  }
  return false;
}

async function uploadDocument(supabase: SupabaseClient, actorId: string, args: Args): Promise<ActionResult> {
  const requestId = text(args.client_request_id);
  const entityType = text(args.entity_type) as EntityType;
  const entityId = text(args.entity_id);
  const documentType = text(args.tipo_documento);
  const fileName = text(args.nome_arquivo);
  const mimeType = text(args.mime_type).toLowerCase();
  if (!REQUEST_ID.test(requestId) || !ENTITY_TYPES.has(entityType) || !UUID.test(entityId)) return invalid('client_request_id, entity_type e entity_id válidos são obrigatórios.');
  if (!documentType || documentType.length > 80 || !fileName || fileName.length > 255 || /[\x00-\x1f\x7f]/.test(fileName)) return invalid('tipo_documento ou nome_arquivo inválidos.');
  const extension = MIME_EXTENSIONS.get(mimeType);
  if (!extension) return invalid('mime_type não permitido.');
  const decoded = decodeDocumentBase64(args.content_base64, mimeType);
  if (!(decoded instanceof Uint8Array)) return decoded;

  let hash: string;
  let objectUuid: string;
  try {
    hash = await sha256Hex(decoded);
    objectUuid = await stableObjectUuid(actorId, requestId, hash);
  } catch {
    return internal();
  }
  const path = `${entityType}/${entityId}/${objectUuid}.${extension}`;
  let uploadedNewObject = false;
  try {
    const { error } = await supabase.storage.from(BUCKET).upload(path, decoded, { contentType: mimeType, upsert: false });
    if (error && !isStorageConflict(error)) return internal();
    uploadedNewObject = !error;
  } catch {
    return internal();
  }

  const result = await callDocumentRpc(supabase, 'mcp_contract_document_create_metadata', {
    p_actor_user_id: actorId,
    p_client_request_id: requestId,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_tipo_documento: documentType,
    p_nome_arquivo: fileName,
    p_mime_type: mimeType,
    p_tamanho_bytes: decoded.byteLength,
    p_sha256_hex: hash,
    p_storage_object_path: path,
  });
  if ('error' in result) {
    const cleanupCompleted = !uploadedNewObject || await retryStorageRemoval(supabase, path);
    return cleanupCompleted ? result.error : {
      ...result.error,
      cleanup_pending: true,
      retry_with_same_client_request_id: true,
    };
  }
  const signedUrl = await signDocument(supabase, result.data);
  const document = documentView(result.data, signedUrl ?? undefined);
  if (!signedUrl) document.download_available = false;
  return { success: true, document, replayed: result.data.replayed === true };
}

async function updateDocument(supabase: SupabaseClient, actorId: string, args: Args): Promise<ActionResult> {
  const requestId = text(args.client_request_id);
  const documentId = text(args.document_id);
  const expectedUpdatedAt = text(args.expected_updated_at);
  const documentType = text(args.tipo_documento);
  const fileName = text(args.nome_arquivo);
  if (!REQUEST_ID.test(requestId) || !UUID.test(documentId) || !validTimestamp(expectedUpdatedAt)) return invalid('client_request_id, document_id e expected_updated_at válidos são obrigatórios.');
  if (!documentType || documentType.length > 80 || !fileName || fileName.length > 255 || /[\x00-\x1f\x7f]/.test(fileName)) return invalid('tipo_documento ou nome_arquivo inválidos.');
  const result = await callDocumentRpc(supabase, 'mcp_contract_document_update_metadata', {
    p_actor_user_id: actorId,
    p_client_request_id: requestId,
    p_document_id: documentId,
    p_expected_updated_at: expectedUpdatedAt,
    p_tipo_documento: documentType,
    p_nome_arquivo: fileName,
  });
  if ('error' in result) return result.error;
  return { success: true, document: documentView(result.data), replayed: result.data.replayed === true };
}

async function deleteDocument(supabase: SupabaseClient, actorId: string, args: Args): Promise<ActionResult> {
  const requestId = text(args.client_request_id);
  const documentId = text(args.document_id);
  const expectedUpdatedAt = text(args.expected_updated_at);
  if (!REQUEST_ID.test(requestId) || !UUID.test(documentId) || !validTimestamp(expectedUpdatedAt)) return invalid('client_request_id, document_id e expected_updated_at válidos são obrigatórios.');
  const result = await callDocumentRpc(supabase, 'mcp_contract_document_delete_metadata', {
    p_actor_user_id: actorId,
    p_client_request_id: requestId,
    p_document_id: documentId,
    p_expected_updated_at: expectedUpdatedAt,
  });
  if ('error' in result) return result.error;
  const data = result.data;
  if (data.deleted !== true) return { success: false, error_code: 'NOT_FOUND', message: 'Documento não encontrado ou já excluído.' };
  if (data.cleanup_status === 'completed') {
    return { success: true, document_id: documentId, deleted: true, cleanup_status: 'completed', replayed: data.replayed === true };
  }
  if (data.storage_bucket_id !== BUCKET || typeof data.storage_object_path !== 'string') {
    return { success: true, document_id: documentId, deleted: true, cleanup_status: 'pending', retry_with_same_client_request_id: true };
  }
  if (!await retryStorageRemoval(supabase, data.storage_object_path)) {
    return { success: true, document_id: documentId, deleted: true, cleanup_status: 'pending', retry_with_same_client_request_id: true };
  }

  const finalized = await callDocumentRpc(supabase, 'mcp_contract_document_finalize_cleanup', {
    p_actor_user_id: actorId,
    p_document_id: documentId,
    p_delete_client_request_id: requestId,
  });
  if ('error' in finalized || finalized.data.cleanup_status !== 'completed') {
    return { success: true, document_id: documentId, deleted: true, cleanup_status: 'pending', retry_with_same_client_request_id: true };
  }
  return { success: true, document_id: documentId, deleted: true, cleanup_status: 'completed', replayed: data.replayed === true };
}

export async function executeMcpContractDocumentAction(params: {
  supabase: SupabaseClient;
  toolName: string;
  arguments: Args;
  actor: Actor;
}): Promise<ActionResult | null> {
  const { supabase, toolName, arguments: args, actor } = params;
  if (!(MCP_CONTRACT_DOCUMENT_TOOL_NAMES as readonly string[]).includes(toolName)) return null;
  if (!assertActor(actor.actorId)) return { success: false, error_code: 'UNAUTHORIZED', message: 'OAuth admin obrigatório.' };
  if (!isRecord(args)) return invalid('Os argumentos da ferramenta devem ser um objeto.');
  switch (toolName) {
    case 'kifer_list_documents':
      return listDocuments(supabase, actor.actorId, args);
    case 'kifer_get_document':
      return getDocument(supabase, actor.actorId, text(args.document_id));
    case 'kifer_upload_document':
      return uploadDocument(supabase, actor.actorId, args);
    case 'kifer_update_document_metadata':
      return updateDocument(supabase, actor.actorId, args);
    case 'kifer_delete_document':
      return deleteDocument(supabase, actor.actorId, args);
    default:
      return null;
  }
}
