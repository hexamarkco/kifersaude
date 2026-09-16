import assert from 'node:assert/strict';
import { test, vi } from 'vitest';

type MockFunction = {
  (...args: unknown[]): unknown;
  mock: { calls: unknown[][] };
  mockResolvedValue(value: unknown): MockFunction;
  mockReturnValue(value: unknown): MockFunction;
};

const supabase = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('../../../../infrastructure/supabase', () => ({
  databaseClient: supabase,
}));

import { createContractRecordsBulk } from '../contractJsonImportRepository';

const from = supabase.from as unknown as MockFunction;

test('bulk contract repository performs one insert and applies form-compatible defaults', async () => {
  const insert = vi.fn() as unknown as MockFunction;
  insert.mockResolvedValue({ error: null });
  from.mockReturnValue({ insert });

  await createContractRecordsBulk([{
    codigo_contrato: 'CTR-100',
    status: 'Ativo',
    modalidade: 'PME',
    operadora: 'Operadora Exemplo',
    produto_plano: 'Plano Executivo',
    data_renovacao: '2027-02',
    mensalidade_total: 1250.5,
    mes_reajuste: 2,
    responsavel: 'Equipe Comercial',
  }]);

  const latestFromCall = from.mock.calls[from.mock.calls.length - 1];
  assert.equal(latestFromCall?.[0], 'contracts');
  assert.equal(insert.mock.calls.length, 1, 'contracts were split into multiple writes');
  const insertedRows = insert.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
  assert.equal(insertedRows.length, 1);
  assert.equal(insertedRows[0]?.data_renovacao, '2027-02-01');
  assert.equal(insertedRows[0]?.mensalidade_total, 1250.5);
  assert.equal(insertedRows[0]?.comissao_prevista, 3501.4);
  assert.equal(insertedRows[0]?.lead_id, null);
  assert.equal(insertedRows[0]?.comissao_multiplicador, 2.8);
  assert.equal(insertedRows[0]?.comissao_recebimento_adiantado, true);
  assert.deepEqual(insertedRows[0]?.comissao_parcelas, []);
});
