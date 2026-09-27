import assert from 'node:assert/strict';
import { test, vi } from 'vitest';

type FetchPage = (
  from: number,
  to: number,
) => Promise<{ data: unknown[] | null; error: unknown | null }>;

type FetchAllPagesMock = {
  (fetchPage: FetchPage): Promise<unknown[]>;
  mockImplementation(implementation: (fetchPage: FetchPage) => Promise<unknown[]>): FetchAllPagesMock;
};

const mocks = vi.hoisted(() => ({
  fetchAllPages: vi.fn() as unknown as FetchAllPagesMock,
}));

vi.mock('../../../../infrastructure/supabase', () => ({
  databaseClient: {},
  fetchAllPages: mocks.fetchAllPages,
}));

import { listContractsSearchSnapshot } from '../contractsRepository';

test('preserva contratos quando uma fonte complementar falha', async () => {
  let calls = 0;
  mocks.fetchAllPages.mockImplementation(async () => {
    calls += 1;
    if (calls === 2) {
      throw new Error('titulares indisponíveis');
    }
    if (calls === 1) {
      return [{ id: 'contract-1', codigo_contrato: 'CON-001' }];
    }
    return [{ id: 'dependent-1', contract_id: 'contract-1' }];
  });

  const snapshot = await listContractsSearchSnapshot();

  assert.deepEqual(snapshot.contracts, [{ id: 'contract-1', codigo_contrato: 'CON-001' }]);
  assert.deepEqual(snapshot.holdersByContractId, {});
  assert.deepEqual(snapshot.dependentsByContractId, {
    'contract-1': [{ id: 'dependent-1', contract_id: 'contract-1' }],
  });
  assert.deepEqual(snapshot.failedSources, ['holders']);
});
