import assert from 'node:assert/strict';
import { test, vi } from 'vitest';

type QueryResult = {
  data: Array<Record<string, unknown>>;
  error: null;
};

const mocks = vi.hoisted(() => {
  const contractResults: Array<Promise<QueryResult>> = [];
  const reminderResults: Array<Promise<QueryResult>> = [];
  const contractQuery = {
    select: () => ({
      in: () => contractResults.shift() ?? Promise.resolve({ data: [], error: null }),
    }),
  };
  const reminderQuery = {
    select: () => ({
      in: () => ({
        eq: () => ({
          gte: () => ({
            order: () => reminderResults.shift() ?? Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    }),
  };
  const from = vi.fn() as unknown as {
    (table: string): typeof contractQuery | typeof reminderQuery;
    mockImplementation(implementation: (table: string) => typeof contractQuery | typeof reminderQuery): void;
  };
  from.mockImplementation((table: string) => table === 'contracts' ? contractQuery : reminderQuery);

  return { contractResults, reminderResults, from };
});

vi.mock('../../../../infrastructure/supabase', () => ({
  databaseClient: {
    from: mocks.from,
  },
  supabase: {
    from: mocks.from,
  },
}));

import { listContractLeadIds, listNextReminderByLeadId } from '../leadsRepository';

test('preserva contratos dos lotes válidos quando outro lote falha', async () => {
  mocks.contractResults.push(
    Promise.resolve({ data: [{ lead_id: 'lead-1' }], error: null }),
    Promise.reject(new Error('segundo lote de contratos indisponível')),
  );

  const result = await listContractLeadIds(Array.from({ length: 101 }, (_, index) => `lead-${index + 1}`));

  assert.deepEqual(result, new Set(['lead-1']));
});

test('preserva próximos retornos dos lotes válidos quando outro lote falha', async () => {
  mocks.reminderResults.push(
    Promise.resolve({ data: [{ lead_id: 'lead-1', data_lembrete: '2026-09-28T12:00:00.000Z' }], error: null }),
    Promise.reject(new Error('segundo lote de retornos indisponível')),
  );

  const result = await listNextReminderByLeadId(
    Array.from({ length: 101 }, (_, index) => `lead-${index + 1}`),
    '2026-09-27T00:00:00.000Z',
  );

  assert.deepEqual(result, new Map([['lead-1', '2026-09-28T12:00:00.000Z']]));
});
