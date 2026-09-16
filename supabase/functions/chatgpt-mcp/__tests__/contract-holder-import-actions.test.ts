import { describe, expect, it, vi } from 'vitest';
import {
  executeMcpContractHolderImportAction,
  MCP_CONTRACT_HOLDER_IMPORT_TOOLS,
  MCP_CONTRACT_HOLDER_IMPORT_WRITE_TOOL_NAMES,
} from '../contract-holder-import-actions';
import { executeMcpWriteAction } from '../write-actions';

const actorId = '7b09577d-49ec-4f00-a54a-56bf370e5179';
const contractId = '42c47f2e-c306-493f-8d7d-c08495017974';
const importId = '2d566723-20bd-4b9e-bb0e-c8b6ecbaebd1';
const holderId = '50e4c4c7-f311-4e7f-a6db-c81540f2ebc7';
const toolName = 'kifer_create_contract_holder_from_import';
const validArgs = {
  contract_id: contractId,
  import_id: importId,
  client_request_id: 'holder-import-request-1',
};

const makeSupabase = (
  data: unknown = { replayed: false, contract_id: contractId, holder_id: holderId, import_id: importId },
  error: unknown = null,
) => {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { client: { rpc } as never, rpc };
};

const execute = (supabase: never, args: Record<string, unknown> = validArgs, actor = { actorId }) =>
  executeMcpContractHolderImportAction({ supabase, toolName, arguments: args, actor });

describe('MCP contract holder import action', () => {
  it('publishes only opaque identifiers and requires all three identifiers', () => {
    expect(MCP_CONTRACT_HOLDER_IMPORT_WRITE_TOOL_NAMES).toEqual([toolName]);
    expect(MCP_CONTRACT_HOLDER_IMPORT_TOOLS).toHaveLength(1);
    expect(MCP_CONTRACT_HOLDER_IMPORT_TOOLS[0]).toMatchObject({
      name: toolName,
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
    });
    expect(Object.keys(MCP_CONTRACT_HOLDER_IMPORT_TOOLS[0].inputSchema.properties)).toEqual([
      'contract_id', 'import_id', 'client_request_id',
    ]);
  });

  it('calls the import RPC with only actor and opaque identifiers and returns a narrow response', async () => {
    const { client, rpc } = makeSupabase({
      replayed: false,
      contract_id: contractId,
      holder_id: holderId,
      import_id: importId,
      holder: {
        cpf: '11122233344',
        nome_completo: 'Pessoa Titular',
        email: 'person@example.com',
      },
    });
    const result = await execute(client);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('mcp_create_contract_holder_from_import', {
      p_actor_user_id: actorId,
      p_contract_id: contractId,
      p_import_id: importId,
      p_client_request_id: 'holder-import-request-1',
    });
    expect(result).toEqual({
      success: true,
      replayed: false,
      contract_id: contractId,
      holder_id: holderId,
      import_id: importId,
    });
    expect(JSON.stringify(result)).not.toMatch(/11122233344|Pessoa Titular|person@example\.com/);
  });

  it('routes through MCP write dispatch and audits only the opaque request and response', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { replayed: false, contract_id: contractId, holder_id: holderId, import_id: importId },
      error: null,
    });
    const insertAudit = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ insert: insertAudit });
    const supabase = { rpc, from } as never;

    const result = await executeMcpWriteAction({
      supabase,
      toolName,
      arguments: validArgs,
      actor: { actor: 'chatgpt:admin@kifer.test', actorId },
    });

    expect(result).toMatchObject({ success: true, holder_id: holderId });
    expect(rpc).toHaveBeenCalledWith('mcp_create_contract_holder_from_import', {
      p_actor_user_id: actorId,
      p_contract_id: contractId,
      p_import_id: importId,
      p_client_request_id: 'holder-import-request-1',
    });
    expect(from).toHaveBeenCalledWith('mcp_action_audit_log');
    const auditRecord = insertAudit.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    const audited = JSON.stringify(auditRecord);
    expect(audited).toContain(importId);
    expect(audited).not.toContain('holder-import-request-1');
    expect(auditRecord?.client_request_id).toMatch(/^[a-f0-9]{64}$/);
    expect(audited).not.toMatch(/cpf|nome_completo|data_nascimento|telefone|email/i);
  });

  it('rejects extra properties and excludes them and the request id from the generic audit', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { replayed: false, contract_id: contractId, holder_id: holderId, import_id: importId },
      error: null,
    });
    const insertAudit = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ insert: insertAudit });
    const supabase = { rpc, from } as never;
    const args = {
      ...validArgs,
      internal_note: 'CPF 11122233344 de pessoa titular',
    };

    const result = await executeMcpWriteAction({
      supabase,
      toolName,
      arguments: args,
      actor: { actor: 'chatgpt:admin@kifer.test', actorId },
    });

    expect(result).toMatchObject({ success: false, error_code: 'INVALID_INPUT' });
    expect(rpc).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledWith('mcp_action_audit_log');
    const audited = JSON.stringify(insertAudit.mock.calls[0]?.[0]);
    expect(audited).toContain(contractId);
    expect(audited).toContain(importId);
    expect(audited).not.toContain('internal_note');
    expect(audited).not.toContain('11122233344');
    expect(audited).not.toContain('pessoa titular');
    expect(audited).not.toContain('holder-import-request-1');
  });

  it('does not audit arbitrary values sent in identifier fields', async () => {
    const rpc = vi.fn();
    const insertAudit = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ insert: insertAudit });
    const supabase = { rpc, from } as never;
    const args = {
      contract_id: 'CPF 11122233344',
      import_id: 'person@example.com',
      client_request_id: 'ALESSANDRA SILVA',
    };

    const result = await executeMcpWriteAction({
      supabase,
      toolName,
      arguments: args,
      actor: { actor: 'chatgpt:admin@kifer.test', actorId },
    });

    expect(result).toMatchObject({ success: false, error_code: 'INVALID_INPUT' });
    expect(rpc).not.toHaveBeenCalled();
    const audited = JSON.stringify(insertAudit.mock.calls[0]?.[0]);
    expect(audited).not.toContain('11122233344');
    expect(audited).not.toContain('person@example.com');
    expect(audited).not.toContain('ALESSANDRA SILVA');
    expect(insertAudit.mock.calls[0]?.[0]?.client_request_id).toBeNull();
  });

  it('requires an OAuth admin actor and well-formed identifiers before calling the RPC', async () => {
    const { client, rpc } = makeSupabase();
    const unauthorized = await execute(client, validArgs, { actorId: '' });
    const invalidContract = await execute(client, { ...validArgs, contract_id: 'bad-id' });
    const invalidImport = await execute(client, { ...validArgs, import_id: 'bad-id' });
    const invalidRequest = await execute(client, { ...validArgs, client_request_id: 'contains spaces' });

    expect(unauthorized).toMatchObject({ success: false, error_code: 'UNAUTHORIZED' });
    expect(invalidContract).toMatchObject({ success: false, error_code: 'INVALID_INPUT' });
    expect(invalidImport).toMatchObject({ success: false, error_code: 'INVALID_INPUT' });
    expect(invalidRequest).toMatchObject({ success: false, error_code: 'INVALID_INPUT' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['MCP_IMPORT_NOT_FOUND', 'IMPORT_NOT_FOUND'],
    ['MCP_IMPORT_EXPIRED', 'IMPORT_EXPIRED'],
    ['MCP_IMPORT_ALREADY_CONSUMED', 'IMPORT_ALREADY_CONSUMED'],
    ['MCP_IMPORT_CONTRACT_MISMATCH', 'IMPORT_CONTRACT_MISMATCH'],
    ['MCP_CONTRACT_NOT_FOUND', 'CONTRACT_NOT_FOUND'],
    ['MCP_CONTRACT_ALREADY_HAS_HOLDER', 'CONTRACT_ALREADY_HAS_HOLDER'],
    ['MCP_MISSING_REQUIRED_HOLDER_FIELDS', 'MISSING_REQUIRED_HOLDER_FIELDS'],
    ['MCP_INVALID_HOLDER_DATA', 'INVALID_HOLDER_DATA'],
    ['MCP_DUPLICATE_HOLDER', 'DUPLICATE_HOLDER'],
    ['MCP_ACTOR_NOT_ACTIVE_ADMIN', 'UNAUTHORIZED'],
    ['MCP_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD', 'CONFLICT'],
  ])('maps the safe RPC error %s to %s without forwarding database text', async (databaseCode, expectedCode) => {
    const privateDetail = `CPF 11122233344 ${databaseCode}`;
    const { client } = makeSupabase(null, { message: privateDetail, details: 'raw PII details' });
    const result = await execute(client);

    expect(result).toMatchObject({ success: false, error_code: expectedCode });
    expect(JSON.stringify(result)).not.toContain(privateDetail);
    expect(JSON.stringify(result)).not.toContain('raw PII details');
  });

  it('returns only allowlisted missing field names from RPC details', async () => {
    const { client } = makeSupabase(null, {
      message: 'MCP_MISSING_REQUIRED_HOLDER_FIELDS',
      details: JSON.stringify({ missing_fields: ['cpf', 'data_nascimento', 'email', '11122233344'] }),
    });
    const result = await execute(client);

    expect(result).toEqual({
      success: false,
      error_code: 'MISSING_REQUIRED_HOLDER_FIELDS',
      message: 'A importação não contém todos os campos obrigatórios do titular.',
      missing_fields: ['cpf', 'data_nascimento'],
    });
    expect(JSON.stringify(result)).not.toContain('11122233344');
    expect(JSON.stringify(result)).not.toContain('email');
  });

  it('does not expose unknown RPC errors or malformed success payloads', async () => {
    const { client: failedClient } = makeSupabase(null, { message: 'secret database detail with CPF 11122233344' });
    const { client: malformedClient } = makeSupabase({
      replayed: false,
      contract_id: 'invalid-contract-id',
      holder_id: holderId,
      import_id: importId,
      cpf: '11122233344',
    });
    const failed = await execute(failedClient);
    const malformed = await execute(malformedClient);

    expect(failed).toEqual({
      success: false,
      error_code: 'INTERNAL_ERROR',
      message: 'Não foi possível criar o titular a partir da importação.',
    });
    expect(malformed).toEqual(failed);
    expect(JSON.stringify(failed)).not.toContain('11122233344');
    expect(JSON.stringify(failed)).not.toContain('secret database detail');
  });

  it('ignores tool names owned by other action modules', async () => {
    const { client, rpc } = makeSupabase();
    const result = await executeMcpContractHolderImportAction({
      supabase: client,
      toolName: 'kifer_create_contract_holder',
      arguments: validArgs,
      actor: { actorId },
    });

    expect(result).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
});
