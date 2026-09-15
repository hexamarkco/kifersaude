import { describe, expect, it, vi } from 'vitest';
import {
  executeMcpContractDocumentAction,
  MCP_CONTRACT_DOCUMENT_TOOL_NAMES,
  MCP_CONTRACT_DOCUMENT_TOOLS,
} from '../contract-document-actions';

const actorId = '7b09577d-49ec-4f00-a54a-56bf370e5179';
const entityId = '42c47f2e-c306-493f-8d7d-c08495017974';
const documentId = '83d150cb-ab48-4cc0-9426-324c8cf39151';
const updatedAt = '2026-09-15T12:00:00.000Z';
const bucket = 'contract-documents-private';

function makeSupabase(options: {
  rpcResponses?: unknown[];
  uploadResponse?: unknown;
  removeResponses?: unknown[];
  signedUrlResponse?: unknown;
} = {}) {
  const rpcResponses = [...(options.rpcResponses ?? [{ success: true }])];
  const removeResponses = [...(options.removeResponses ?? [{ error: null }])];
  const rpc = vi.fn(async (_name: string, _parameters: Record<string, unknown>) => rpcResponses.shift() ?? { data: { success: true }, error: null });
  const upload = vi.fn().mockResolvedValue(options.uploadResponse ?? { data: { path: 'uploaded' }, error: null });
  const remove = vi.fn(async () => removeResponses.shift() ?? { error: null });
  const createSignedUrl = vi.fn().mockResolvedValue(options.signedUrlResponse ?? { data: { signedUrl: 'https://private.example/signed?token=short' }, error: null });
  const from = vi.fn(() => ({ upload, remove, createSignedUrl }));
  return { client: { rpc, storage: { from } } as never, rpc, upload, remove, createSignedUrl, from };
}

const pdfBase64 = btoa('%PDF-1.7 test');
const execute = (supabase: unknown, toolName: string, args: Record<string, unknown>) => executeMcpContractDocumentAction({
  supabase: supabase as never,
  toolName,
  arguments: args,
  actor: { actorId },
});

describe('MCP contract document actions', () => {
  it('declares five unique document tools', () => {
    const names = MCP_CONTRACT_DOCUMENT_TOOLS.map(({ name }) => name);
    expect(names).toEqual([...MCP_CONTRACT_DOCUMENT_TOOL_NAMES]);
    expect(new Set(names).size).toBe(5);
  });

  it('rejects an invalid signature before touching Storage or database', async () => {
    const { client, rpc, upload } = makeSupabase();
    const result = await execute(client, 'kifer_upload_document', {
      client_request_id: 'upload-1',
      entity_type: 'contract',
      entity_id: entityId,
      tipo_documento: 'Contrato',
      nome_arquivo: 'contrato.pdf',
      mime_type: 'application/pdf',
      content_base64: btoa('not a PDF'),
    });

    expect(result).toMatchObject({ success: false, error_code: 'INVALID_INPUT' });
    expect(upload).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('uploads to a deterministic private path and registers metadata with the actor', async () => {
    const { client, rpc, upload, from, createSignedUrl } = makeSupabase({
      rpcResponses: [{ data: { id: documentId, is_legacy: false, storage_bucket_id: bucket, storage_object_path: 'contract/path.pdf', replayed: false, updated_at: updatedAt }, error: null }],
    });
    const args = {
      client_request_id: 'same-upload',
      entity_type: 'contract',
      entity_id: entityId,
      tipo_documento: 'Contrato',
      nome_arquivo: 'contrato.pdf',
      mime_type: 'application/pdf',
      content_base64: pdfBase64,
    };
    const result = await execute(client, 'kifer_upload_document', args);
    const firstPath = upload.mock.calls[0]?.[0];

    expect(result).toMatchObject({ success: true, document: { id: documentId, signed_url: expect.any(String), signed_url_expires_in: 120 } });
    expect(firstPath).toMatch(new RegExp(`^contract/${entityId}/[0-9a-f-]+\\.pdf$`));
    expect(from).toHaveBeenCalledWith(bucket);
    expect(createSignedUrl).toHaveBeenCalledWith('contract/path.pdf', 120);
    expect(rpc).toHaveBeenCalledWith('mcp_contract_document_create_metadata', expect.objectContaining({
      p_actor_user_id: actorId,
      p_client_request_id: 'same-upload',
      p_entity_type: 'contract',
      p_entity_id: entityId,
      p_mime_type: 'application/pdf',
      p_tamanho_bytes: new TextEncoder().encode('%PDF-1.7 test').length,
      p_storage_object_path: firstPath,
      p_sha256_hex: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect((result as { document: Record<string, unknown> }).document.storage_object_path).toBeUndefined();
  });

  it('compensates a newly uploaded object if metadata registration fails', async () => {
    const { client, rpc, upload, remove } = makeSupabase({
      rpcResponses: [{ data: null, error: { code: 'P0002', message: 'MCP_DOCUMENT_ENTITY_NOT_FOUND' } }],
    });
    const result = await execute(client, 'kifer_upload_document', {
      client_request_id: 'missing-entity',
      entity_type: 'contract',
      entity_id: entityId,
      tipo_documento: 'Contrato',
      nome_arquivo: 'contrato.pdf',
      mime_type: 'application/pdf',
      content_base64: pdfBase64,
    });

    expect(result).toMatchObject({ success: false, error_code: 'NOT_FOUND' });
    expect(upload).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0]?.[0]]);
  });

  it('returns short-lived signed links for private documents and preserves legacy URLs', async () => {
    const legacyUrl = 'https://legacy.example/document.pdf';
    const { client, rpc, createSignedUrl } = makeSupabase({
      rpcResponses: [{
        data: {
          documents: [
            { id: documentId, is_legacy: false, storage_bucket_id: bucket, storage_object_path: 'contract/private.pdf', created_at: updatedAt },
            { id: entityId, is_legacy: true, storage_object_path: null, storage_bucket_id: null, legacy_url: legacyUrl },
          ],
          has_more: false,
          next_cursor: null,
        },
        error: null,
      }],
    });
    const result = await execute(client, 'kifer_list_documents', { entity_type: 'contract', entity_id: entityId, limit: 10 });
    const documents = (result as { documents: Record<string, unknown>[] }).documents;

    expect(rpc).toHaveBeenCalledWith('mcp_contract_documents_list', expect.objectContaining({
      p_actor_user_id: actorId,
      p_entity_type: 'contract',
      p_entity_id: entityId,
      p_limit: 10,
      p_before_created_at: null,
      p_before_document_id: null,
    }));
    expect(documents[0]).toMatchObject({ signed_url_expires_in: 120 });
    expect(documents[0].storage_object_path).toBeUndefined();
    expect(documents[1]).toMatchObject({ legacy_url: legacyUrl });
    expect(createSignedUrl).toHaveBeenCalledOnce();
  });

  it('fetches legacy documents without attempting to sign a private object', async () => {
    const { client, rpc, createSignedUrl } = makeSupabase({
      rpcResponses: [{ data: { id: documentId, is_legacy: true, legacy_url: 'https://legacy.example/file.pdf' }, error: null }],
    });
    const result = await execute(client, 'kifer_get_document', { document_id: documentId });

    expect(result).toMatchObject({ success: true, document: { id: documentId, legacy_url: 'https://legacy.example/file.pdf' } });
    expect(rpc).toHaveBeenCalledWith('mcp_contract_document_get', { p_actor_user_id: actorId, p_document_id: documentId });
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it('uses optimistic concurrency for metadata edits without direct table writes', async () => {
    const { client, rpc, from } = makeSupabase({
      rpcResponses: [{ data: { id: documentId, is_legacy: false, storage_bucket_id: bucket, storage_object_path: 'contract/x.pdf', updated_at: updatedAt }, error: null }],
    });
    const result = await execute(client, 'kifer_update_document_metadata', {
      client_request_id: 'rename-1', document_id: documentId, expected_updated_at: updatedAt,
      tipo_documento: 'Aditivo', nome_arquivo: 'aditivo.pdf',
    });

    expect(result).toMatchObject({ success: true, document: { id: documentId, updated_at: updatedAt } });
    expect(rpc).toHaveBeenCalledWith('mcp_contract_document_update_metadata', {
      p_actor_user_id: actorId,
      p_client_request_id: 'rename-1',
      p_document_id: documentId,
      p_expected_updated_at: updatedAt,
      p_tipo_documento: 'Aditivo',
      p_nome_arquivo: 'aditivo.pdf',
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('tombstones, removes by Storage API, and finalizes cleanup in that order', async () => {
    const { client, rpc, remove } = makeSupabase({
      rpcResponses: [
        { data: { document_id: documentId, deleted: true, storage_bucket_id: bucket, storage_object_path: 'contract/private.pdf', cleanup_status: 'pending', replayed: false }, error: null },
        { data: { document_id: documentId, cleanup_status: 'completed', replayed: false }, error: null },
      ],
    });
    const result = await execute(client, 'kifer_delete_document', {
      client_request_id: 'delete-1', document_id: documentId, expected_updated_at: updatedAt,
    });

    expect(result).toMatchObject({ success: true, deleted: true, cleanup_status: 'completed' });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'mcp_contract_document_delete_metadata',
      'mcp_contract_document_finalize_cleanup',
    ]);
    expect(rpc.mock.calls[0]?.[1]).toMatchObject({ p_actor_user_id: actorId, p_client_request_id: 'delete-1' });
    expect(rpc.mock.calls[1]?.[1]).toEqual({ p_actor_user_id: actorId, p_document_id: documentId, p_delete_client_request_id: 'delete-1' });
    expect(remove).toHaveBeenCalledWith(['contract/private.pdf']);
  });

  it('leaves retryable cleanup state when Storage removal keeps failing', async () => {
    const { client, rpc, remove } = makeSupabase({
      rpcResponses: [{ data: { document_id: documentId, deleted: true, storage_bucket_id: bucket, storage_object_path: 'contract/private.pdf', cleanup_status: 'pending' }, error: null }],
      removeResponses: [{ error: { message: 'transient' } }, { error: { message: 'transient' } }, { error: { message: 'transient' } }],
    });
    const result = await execute(client, 'kifer_delete_document', {
      client_request_id: 'delete-retry', document_id: documentId, expected_updated_at: updatedAt,
    });

    expect(result).toMatchObject({ success: true, deleted: true, cleanup_status: 'pending', retry_with_same_client_request_id: true });
    expect(remove).toHaveBeenCalledTimes(3);
    expect(rpc).toHaveBeenCalledOnce();
  });
});
