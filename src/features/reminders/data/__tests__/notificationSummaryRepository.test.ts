import assert from 'node:assert/strict';
import { test, vi } from 'vitest';

type QueryResult = {
  data: unknown[] | null;
  error: unknown | null;
};

type MockFunction<Args extends unknown[], Result> = {
  (...args: Args): Result;
  mockReturnValue(value: Result): MockFunction<Args, Result>;
  mockImplementation(implementation: (...args: Args) => Result): MockFunction<Args, Result>;
};

type Query = {
  select: MockFunction<[string], Query>;
  gte: MockFunction<[string, string], Query>;
  lte: MockFunction<[string, string], Query>;
  eq: MockFunction<[string, unknown], Query>;
  order: MockFunction<[string, { ascending: boolean }], Query>;
  in: MockFunction<[string, string[]], Query>;
  overrideTypes: MockFunction<[], Promise<QueryResult>>;
};

const mocks = vi.hoisted(() => {
  const createMock = <Args extends unknown[], Result>() => (
    vi.fn() as unknown as MockFunction<Args, Result>
  );

  const createQuery = (result: QueryResult) => {
    const query = {} as Query;
    query.select = createMock<[string], Query>();
    query.gte = createMock<[string, string], Query>();
    query.lte = createMock<[string, string], Query>();
    query.eq = createMock<[string, unknown], Query>();
    query.order = createMock<[string, { ascending: boolean }], Query>();
    query.in = createMock<[string, string[]], Query>();
    query.overrideTypes = createMock<[], Promise<QueryResult>>();
    query.select.mockReturnValue(query);
    query.gte.mockReturnValue(query);
    query.lte.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.in.mockReturnValue(query);
    query.overrideTypes.mockReturnValue(Promise.resolve(result));
    return query;
  };

  const remindersQuery = createQuery({
    data: [{ id: 'reminder-1', titulo: 'Retornar contato', data_lembrete: '2026-09-27T12:00:00.000Z' }],
    error: null,
  });
  const contractsQuery = createQuery({ data: null, error: new Error('contratos indisponíveis') });
  const from = createMock<[string], Query>();
  from.mockImplementation((table) => table === 'reminders' ? remindersQuery : contractsQuery);

  return { from };
});

vi.mock('../../../../infrastructure/supabase', () => ({
  databaseClient: {
    from: mocks.from,
  },
}));

import { loadNotificationSummarySource } from '../notificationSummaryRepository';

test('preserva lembretes quando a consulta de contratos falha', async () => {
  const result = await loadNotificationSummarySource(
    '2026-09-27T00:00:00.000Z',
    '2026-09-27T23:59:59.999Z',
  );

  assert.deepEqual(result.reminders, [{
    id: 'reminder-1',
    titulo: 'Retornar contato',
    data_lembrete: '2026-09-27T12:00:00.000Z',
  }]);
  assert.deepEqual(result.contracts, []);
  assert.deepEqual(result.failedSources, ['contracts']);
});
