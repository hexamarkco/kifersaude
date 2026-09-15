import { describe, expect, it, vi } from 'vitest';
import { executeMcpContractWriteAction, MCP_CONTRACT_TOOLS } from '../contract-actions';

const actorId = '7b09577d-49ec-4f00-a54a-56bf370e5179';
const contractId = '42c47f2e-c306-493f-8d7d-c08495017974';
const updatedAt = '2026-09-15T12:00:00.000Z';

const makeSupabase = (response: unknown = { contract_id: contractId, updated_at: updatedAt }) => {
  const rpc = vi.fn().mockResolvedValue({ data: response, error: null });
  return { client: { rpc } as never, rpc };
};

describe('MCP contract actions', () => {
  it('declares the contract, holder, dependent, bundle and modeled adjustment tools once', () => {
    const names = MCP_CONTRACT_TOOLS.map(({ name }) => name);
    expect(names).toHaveLength(11);
    expect(new Set(names).size).toBe(names.length);
  });

  it('rejects protected fields before calling the database', async () => {
    const { client, rpc } = makeSupabase();
    const result = await executeMcpContractWriteAction({
      supabase: client,
      toolName: 'kifer_update_contract',
      arguments: { contract_id: contractId, expected_updated_at: updatedAt, changes: { status: 'Ativo', id: contractId } },
      actor: { actorId },
    });

    expect(result?.success).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('uses the database contract RPC with a narrow payload and request id', async () => {
    const { client, rpc } = makeSupabase();
    const result = await executeMcpContractWriteAction({
      supabase: client,
      toolName: 'kifer_create_contract',
      arguments: {
        client_request_id: 'req-contract-1',
        contract: { codigo_contrato: 'KIF-001', status: 'Ativo', modalidade: 'Coletivo', operadora: 'Operadora', produto_plano: 'Plano', responsavel: 'Nick' },
      },
      actor: { actorId },
    });

    expect(result).toMatchObject({ success: true, contract_id: contractId });
    expect(rpc).toHaveBeenCalledWith('mcp_create_contract', {
      p_actor_user_id: actorId,
      p_client_request_id: 'req-contract-1',
      p_payload: { codigo_contrato: 'KIF-001', status: 'Ativo', modalidade: 'Coletivo', operadora: 'Operadora', produto_plano: 'Plano', responsavel: 'Nick' },
    });
  });

  it('forwards bundle components atomically through one RPC', async () => {
    const { client, rpc } = makeSupabase({ contract_id: contractId, holder_id: actorId, dependent_ids: [] });
    const contract = { codigo_contrato: 'KIF-001', status: 'Ativo', modalidade: 'Coletivo', operadora: 'Operadora', produto_plano: 'Plano', responsavel: 'Nick' };
    const holder = { nome_completo: 'Titular Teste', cpf: '000', data_nascimento: '1980-01-01', telefone: '000' };
    const result = await executeMcpContractWriteAction({
      supabase: client,
      toolName: 'kifer_create_contract_bundle',
      arguments: { client_request_id: 'req-bundle-1', contract, holder, dependents: [] },
      actor: { actorId },
    });

    expect(result?.success).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('mcp_create_contract_bundle', {
      p_actor_user_id: actorId,
      p_client_request_id: 'req-bundle-1',
      p_contract: contract,
      p_holder: holder,
      p_dependents: [],
    });
  });
});
