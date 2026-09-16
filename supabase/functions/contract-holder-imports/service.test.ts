import { describe, expect, it, vi } from 'vitest';
import { handleContractHolderImportRequest } from './service';

const actor = { userId: '7b09577d-49ec-4f00-a54a-56bf370e5179', role: 'admin' };
const contractId = '42c47f2e-c306-493f-8d7d-c08495017974';
const importId = '2d566723-20bd-4b9e-bb0e-c8b6ecbaebd1';
const headers = { 'Content-Type': 'application/json' };
const holder = {
  nome_completo: 'Titular de teste',
  cpf: '000.000.000-00',
  data_nascimento: '1980-01-01',
  telefone: '(11) 90000-0000',
  endereco: 'Rua de teste',
};

const request = (path: string, body: unknown, extraHeaders: Record<string, string> = {}) =>
  new Request(`https://example.test/functions/v1/contract-holder-imports${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  });

const responseBody = async (response: Response) => await response.json() as Record<string, unknown>;

describe('internal contract holder staging endpoint', () => {
  it('creates a staging record and returns only its opaque ID and expiry', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { success: true, import_id: importId, expires_at: '2026-09-16T12:00:00Z', replayed: false },
      error: null,
    });

    const response = await handleContractHolderImportRequest({
      req: request('', { contract_id: contractId, holder }),
      supabaseAdmin: { rpc },
      actor,
      headers,
    });

    expect(response.status).toBe(200);
    const payload = await responseBody(response);
    expect(payload).toEqual({
      success: true,
      import_id: importId,
      expires_at: '2026-09-16T12:00:00Z',
    });
    expect(JSON.stringify(payload)).not.toMatch(/Titular de teste|000\.000|Rua de teste/);
    expect(rpc).toHaveBeenCalledWith('create_contract_holder_import', expect.objectContaining({
      p_actor_user_id: actor.userId,
      p_contract_id: contractId,
      p_lead_id: null,
      p_ttl_hours: 24,
      p_source: 'other',
      p_holder_payload: holder,
    }));
  });

  it('rejects non-admin users before calling the staging RPC', async () => {
    const rpc = vi.fn();
    const response = await handleContractHolderImportRequest({
      req: request('', { contract_id: contractId, holder }),
      supabaseAdmin: { rpc },
      actor: { ...actor, role: 'sales' },
      headers,
    });

    expect(response.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects additional PII fields and malformed identifiers before calling the RPC', async () => {
    const rpc = vi.fn();
    const response = await handleContractHolderImportRequest({
      req: request('', { contract_id: 'invalid', holder: { ...holder, internal_note: 'CPF 123' } }),
      supabaseAdmin: { rpc },
      actor,
      headers,
    });

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
    expect(JSON.stringify(await responseBody(response))).not.toContain('CPF 123');
  });

  it('rejects oversized request bodies before calling the staging RPC', async () => {
    const rpc = vi.fn();
    const response = await handleContractHolderImportRequest({
      req: new Request('https://example.test/functions/v1/contract-holder-imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: ' '.repeat(40 * 1024 + 1),
      }),
      supabaseAdmin: { rpc },
      actor,
      headers,
    });

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('does not echo database error detail that might contain personal data', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'database rejected CPF 000.000.000-00 at address Rua de teste' },
    });
    const response = await handleContractHolderImportRequest({
      req: request('', { contract_id: contractId, holder }),
      supabaseAdmin: { rpc },
      actor,
      headers,
    });
    const result = JSON.stringify(await responseBody(response));

    expect(response.status).toBe(500);
    expect(result).not.toMatch(/000\.000|Rua de teste|CPF/);
  });

  it('returns batch results with only import ID, contract ID and status', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: { success: true, import_id: importId, expires_at: '2026-09-16T12:00:00Z' },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { message: 'private database detail' } });
    const secondContract = '52c47f2e-c306-493f-8d7d-c08495017975';
    const response = await handleContractHolderImportRequest({
      req: request('/batch', [
        { contract_id: contractId, holder },
        { contract_id: secondContract, holder: { ...holder, cpf: '000.000.000-01' } },
      ]),
      supabaseAdmin: { rpc },
      actor,
      headers,
    });

    expect(await response.json()).toEqual([
      { import_id: importId, contract_id: contractId, status: 'created' },
      { import_id: null, contract_id: secondContract, status: 'failed' },
    ]);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0]?.[1]).toMatchObject({
      p_client_request_id: expect.stringMatching(/^admin-holder-[\w-]+:1$/),
      p_source: 'admin_bulk',
    });
  });

  it('uses a caller-supplied UUID idempotency key for retries', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { success: true, import_id: importId, expires_at: '2026-09-16T12:00:00Z' },
      error: null,
    });

    await handleContractHolderImportRequest({
      req: request('', { contract_id: contractId, holder }, { 'X-Idempotency-Key': '7b09577d-49ec-4f00-a54a-56bf370e5179' }),
      supabaseAdmin: { rpc },
      actor,
      headers,
    });

    expect(rpc.mock.calls[0]?.[1]).toMatchObject({ p_client_request_id: 'admin-holder-7b09577d-49ec-4f00-a54a-56bf370e5179' });
  });
});
