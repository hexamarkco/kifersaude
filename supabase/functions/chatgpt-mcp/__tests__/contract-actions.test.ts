import { describe, expect, it, vi } from 'vitest';
import { executeMcpContractWriteAction, MCP_CONTRACT_TOOLS } from '../contract-actions';

const actorId = '7b09577d-49ec-4f00-a54a-56bf370e5179';
const contractId = '42c47f2e-c306-493f-8d7d-c08495017974';
const updatedAt = '2026-09-15T12:00:00.000Z';

const makeSupabase = (response: unknown = { contract_id: contractId, updated_at: updatedAt }, error: unknown = null) => {
  const rpc = vi.fn().mockResolvedValue({ data: response, error });
  return { client: { rpc } as never, rpc };
};

describe('MCP contract actions', () => {
  it('declares the contract, holder, dependent, bundle, commission and adjustment tools once', () => {
    const names = MCP_CONTRACT_TOOLS.map(({ name }) => name);
    expect(names).toHaveLength(12);
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

  it('limits commission changes to modeled commission fields and uses optimistic concurrency', async () => {
    const { client, rpc } = makeSupabase();
    const result = await executeMcpContractWriteAction({
      supabase: client,
      toolName: 'kifer_update_contract_commission',
      arguments: {
        contract_id: contractId,
        expected_updated_at: updatedAt,
        changes: { comissao_prevista: 1250, comissao_recebimento_adiantado: false },
      },
      actor: { actorId },
    });
    expect(result?.success).toBe(true);
    expect(rpc).toHaveBeenCalledWith('mcp_update_contract', {
      p_actor_user_id: actorId,
      p_contract_id: contractId,
      p_expected_updated_at: updatedAt,
      p_patch: { comissao_prevista: 1250, comissao_recebimento_adiantado: false },
    });
  });

  it('rejects non-commission fields from the commission-specific action', async () => {
    const { client, rpc } = makeSupabase();
    const result = await executeMcpContractWriteAction({
      supabase: client,
      toolName: 'kifer_update_contract_commission',
      arguments: {
        contract_id: contractId,
        expected_updated_at: updatedAt,
        changes: { status: 'Ativo' },
      },
      actor: { actorId },
    });
    expect(result).toMatchObject({ success: false, error_code: 'INVALID_INPUT' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns a safe structured conflict when contract, holder, or dependent updates are stale', async () => {
    const cases = [
      {
        toolName: 'kifer_update_contract',
        arguments: { contract_id: contractId, expected_updated_at: updatedAt, changes: { status: 'Ativo' } },
        rpcName: 'mcp_update_contract',
      },
      {
        toolName: 'kifer_update_contract_holder',
        arguments: { holder_id: actorId, expected_updated_at: updatedAt, changes: { nome_completo: 'Titular atualizado' } },
        rpcName: 'mcp_update_contract_holder',
      },
      {
        toolName: 'kifer_update_dependent',
        arguments: { dependent_id: actorId, expected_updated_at: updatedAt, changes: { nome_completo: 'Dependente atualizado' } },
        rpcName: 'mcp_update_contract_dependent',
      },
    ] as const;
    const expected = {
      success: false,
      error_code: 'CONFLICT',
      message: 'O registro foi alterado desde a última leitura. Recarregue os dados e tente novamente.',
    };

    for (const { toolName, arguments: args, rpcName } of cases) {
      const { client, rpc } = makeSupabase(null, { code: '40001', message: 'MCP_CONCURRENT_UPDATE' });
      const result = await executeMcpContractWriteAction({
        supabase: client,
        toolName,
        arguments: args,
        actor: { actorId },
      });

      expect(result).toEqual(expected);
      expect(rpc).toHaveBeenCalledWith(rpcName, expect.any(Object));
    }
  });

  it('does not misclassify a non-concurrency 40001 from contract creation as a stale write', async () => {
    const { client, rpc } = makeSupabase(null, { code: '40001', message: 'MCP_IDEMPOTENCY_RESULT_NOT_STORED' });
    const result = await executeMcpContractWriteAction({
      supabase: client,
      toolName: 'kifer_create_contract',
      arguments: {
        client_request_id: 'req-contract-1',
        contract: { codigo_contrato: 'KIF-001', status: 'Ativo', modalidade: 'Coletivo', operadora: 'Operadora', produto_plano: 'Plano', responsavel: 'Nick' },
      },
      actor: { actorId },
    });

    expect(result).toMatchObject({ success: false, error_code: 'INTERNAL_ERROR' });
    expect(rpc).toHaveBeenCalledTimes(1);
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
