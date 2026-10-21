import { describe, expect, it, vi } from 'vitest';
import {
  executeMcpContractDependentImportAction,
  MCP_CONTRACT_DEPENDENT_IMPORT_TOOLS,
} from '../contract-dependent-import-actions';

const actorId = '00000000-0000-4000-8000-000000000001';
const contractId = '00000000-0000-4000-8000-000000000002';
const holderId = '00000000-0000-4000-8000-000000000003';
const importId = '00000000-0000-4000-8000-000000000004';
const dependentId = '00000000-0000-4000-8000-000000000005';
const validArgs = {
  contract_id: contractId,
  holder_id: holderId,
  import_id: importId,
  client_request_id: 'dependent-consume-001',
};

function client(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  return { supabase: { rpc } as never, rpc };
}

describe('MCP dependent import action', () => {
  it('publishes a closed schema containing only opaque IDs and an idempotency key', () => {
    const tool = MCP_CONTRACT_DEPENDENT_IMPORT_TOOLS[0];
    expect(tool.name).toBe('kifer_create_dependent_from_import');
    expect(tool.inputSchema).toMatchObject({
      type: 'object',
      required: ['contract_id', 'holder_id', 'import_id', 'client_request_id'],
      additionalProperties: false,
    });
    expect(JSON.stringify(tool.inputSchema)).not.toMatch(/cpf|data_nascimento|nome_completo/i);
  });

  it('consumes the staging row through the narrow transactional RPC and returns IDs only', async () => {
    const { supabase, rpc } = client({
      success: true,
      replayed: false,
      contract_id: contractId,
      holder_id: holderId,
      import_id: importId,
      dependent_id: dependentId,
    });

    const result = await executeMcpContractDependentImportAction({
      supabase,
      toolName: 'kifer_create_dependent_from_import',
      arguments: validArgs,
      actor: { actorId },
    });

    expect(rpc).toHaveBeenCalledWith('mcp_create_contract_dependent_from_import', {
      p_actor_user_id: actorId,
      p_import_id: importId,
      p_contract_id: contractId,
      p_holder_id: holderId,
      p_client_request_id: 'dependent-consume-001',
    });
    expect(result).toEqual({
      success: true,
      replayed: false,
      contract_id: contractId,
      holder_id: holderId,
      import_id: importId,
      dependent_id: dependentId,
    });
    expect(JSON.stringify(result)).not.toMatch(/cpf|data_nascimento|nome_completo/i);
  });

  it('rejects extra fields, malformed identifiers, and non-admin actors before RPC', async () => {
    const { supabase, rpc } = client(null);
    const extra = await executeMcpContractDependentImportAction({
      supabase,
      toolName: 'kifer_create_dependent_from_import',
      arguments: { ...validArgs, cpf: '11122233344' },
      actor: { actorId },
    });
    const malformed = await executeMcpContractDependentImportAction({
      supabase,
      toolName: 'kifer_create_dependent_from_import',
      arguments: { ...validArgs, holder_id: 'invalid' },
      actor: { actorId },
    });
    const unauthorized = await executeMcpContractDependentImportAction({
      supabase,
      toolName: 'kifer_create_dependent_from_import',
      arguments: validArgs,
      actor: { actorId: '' },
    });

    expect(extra).toMatchObject({ success: false, error_code: 'INVALID_INPUT' });
    expect(malformed).toMatchObject({ success: false, error_code: 'INVALID_INPUT' });
    expect(unauthorized).toMatchObject({ success: false, error_code: 'UNAUTHORIZED' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps known database errors without forwarding private details', async () => {
    const { supabase } = client(null, {
      message: 'MCP_IMPORT_EXPIRED CPF 11122233344',
      details: 'raw record contains a private name',
    });
    const result = await executeMcpContractDependentImportAction({
      supabase,
      toolName: 'kifer_create_dependent_from_import',
      arguments: validArgs,
      actor: { actorId },
    });

    expect(result).toEqual({ success: false, error_code: 'IMPORT_EXPIRED', message: 'A importação de dependente expirou. Gere uma nova importação.' });
    expect(JSON.stringify(result)).not.toMatch(/11122233344|raw record|private name/i);
  });
});
