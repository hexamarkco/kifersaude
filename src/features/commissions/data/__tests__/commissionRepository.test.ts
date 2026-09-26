import assert from "node:assert/strict";
import { test, vi } from "vitest";

type MockFunction<Args extends unknown[], Result> = {
  (...args: Args): Result;
  mock: { calls: Args[] };
  mockReturnValue(value: Result): MockFunction<Args, Result>;
};

type Query = {
  select: MockFunction<[string], Query>;
  eq: MockFunction<[string, unknown], Query>;
  order: MockFunction<[string, { ascending: boolean }], Query>;
  overrideTypes: MockFunction<[], Promise<{ data: unknown[]; error: null }>>;
};

const mocks = vi.hoisted(() => {
  const createMock = <Args extends unknown[], Result>() =>
    vi.fn() as unknown as MockFunction<Args, Result>;
  const query = {} as Query;
  query.select = createMock<[string], Query>();
  query.eq = createMock<[string, unknown], Query>();
  query.order = createMock<[string, { ascending: boolean }], Query>();
  query.overrideTypes = createMock<[], Promise<{ data: unknown[]; error: null }>>();
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.overrideTypes.mockReturnValue(Promise.resolve({
    data: [{
      id: 'contract-1',
      codigo_contrato: 'CTR-001',
      operadora: 'Operadora X',
      previsao_recebimento_comissao: '2026-09-26',
      comissao_prevista: 1000,
      comissao_recebimento_adiantado: true,
      comissao_parcelas: null,
      mensalidade_total: 500,
      previsao_pagamento_bonificacao: null,
      bonus_por_vida_aplicado: false,
      bonus_por_vida_configuracoes: null,
      bonus_por_vida_valor: 0,
      vidas: 2,
      vidas_elegiveis_bonus: null,
    }],
    error: null,
  }));

  return {
    from: createMock<[string], Query>(),
    query,
  };
});

mocks.from.mockReturnValue(mocks.query);

vi.mock('../../../../infrastructure/supabase', () => ({
  databaseClient: {
    from: mocks.from,
  },
}));

import { listActiveCommissionContracts } from '../commissionRepository';

test('busca somente contratos ativos e os campos usados no calendario financeiro', async () => {
  const result = await listActiveCommissionContracts();

  assert.equal(mocks.from.mock.calls[0]?.[0], 'contracts');
  assert.deepEqual(mocks.query.select.mock.calls[0], [
    'id, codigo_contrato, operadora, previsao_recebimento_comissao, comissao_prevista, comissao_recebimento_adiantado, comissao_parcelas, mensalidade_total, previsao_pagamento_bonificacao, bonus_por_vida_aplicado, bonus_por_vida_configuracoes, bonus_por_vida_valor, vidas, vidas_elegiveis_bonus',
  ]);
  assert.deepEqual(mocks.query.eq.mock.calls[0], ['status', 'Ativo']);
  assert.deepEqual(mocks.query.order.mock.calls[0], [
    'previsao_recebimento_comissao',
    { ascending: true },
  ]);
  assert.equal(result[0]?.id, 'contract-1');
});
