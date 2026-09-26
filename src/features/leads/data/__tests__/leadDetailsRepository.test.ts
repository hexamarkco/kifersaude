import assert from 'node:assert/strict';
import { test, vi } from 'vitest';

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
  const createMock = <Args extends unknown[], Result>() => (
    vi.fn() as unknown as MockFunction<Args, Result>
  );
  const query = {} as Query;
  query.select = createMock<[string], Query>();
  query.eq = createMock<[string, unknown], Query>();
  query.order = createMock<[string, { ascending: boolean }], Query>();
  query.overrideTypes = createMock<[], Promise<{ data: unknown[]; error: null }>>();
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.overrideTypes.mockReturnValue(Promise.resolve({ data: [], error: null }));

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

import { getLeadTimeline } from '../leadDetailsRepository';

test('carrega somente os campos exibidos no histórico do lead', async () => {
  await getLeadTimeline('lead-1');

  assert.deepEqual(mocks.query.select.mock.calls, [
    ['id, tipo, descricao, responsavel, data_interacao'],
    ['id, status_anterior, status_novo, responsavel, observacao, created_at'],
    ['id, titulo, descricao, data_lembrete, lido'],
  ]);
});
