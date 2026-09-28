import assert from 'node:assert/strict';
import { test, vi } from 'vitest';

type QueryResult = {
  data: unknown;
  error: unknown | null;
};

type Query = {
  update: (values: Record<string, unknown>) => Query;
  eq: (column: string, value: unknown) => Query;
  in: (column: string, values: string[]) => Query;
  then: <TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) => Promise<TResult1 | TResult2>;
};

type TestMock<Args extends unknown[], Result> = {
  (...args: Args): Result;
  mock: { calls: Args[] };
  mockImplementation(implementation: (...args: Args) => Result): TestMock<Args, Result>;
};

const mocks = vi.hoisted(() => {
  const updateResults: QueryResult[] = [];
  const query = {} as Query;
  const update = vi.fn() as unknown as TestMock<[unknown], Query>;
  update.mockImplementation((values: unknown) => {
    void values;
    return query;
  });
  const eq = vi.fn() as unknown as TestMock<[unknown, unknown], Query>;
  eq.mockImplementation((_column: unknown, _value: unknown) => query);
  const inFilter = vi.fn() as unknown as TestMock<[unknown, unknown], Query>;
  inFilter.mockImplementation((_column: unknown, _values: unknown) => query);

  query.update = (values) => {
    update(values);
    return query;
  };
  query.eq = (column, value) => {
    eq(column, value);
    return query;
  };
  query.in = (column, values) => {
    inFilter(column, values);
    return query;
  };
  query.then = (onfulfilled, onrejected) => {
    const result = updateResults.shift() ?? { data: null, error: null };
    return Promise.resolve(result).then(onfulfilled ?? undefined, onrejected ?? undefined);
  };

  const from = vi.fn() as unknown as TestMock<[unknown], Query>;
  from.mockImplementation((_table: unknown) => query);

  return { from, query, update, updateResults };
});

vi.mock('../../../infrastructure/supabase', () => ({
  supabase: {
    from: mocks.from,
  },
  getSupabaseErrorMessage: (() => {
    const mock = vi.fn() as unknown as TestMock<[unknown, unknown], Promise<string>>;
    mock.mockImplementation(async (_error: unknown, fallback: unknown) => String(fallback));
    return mock;
  })(),
}));

import { commWhatsAppCampaignService } from './commWhatsAppCampaignService';

test('pausar campanha informa falha ao liberar contatos em envio', async () => {
  mocks.updateResults.push(
    { data: null, error: null },
    { data: null, error: new Error('falha temporaria') },
  );

  await assert.rejects(
    () => commWhatsAppCampaignService.pauseCampaign('campaign-1'),
    /Disparo pausado, mas nao foi possivel liberar todos os contatos em processamento\./,
  );

  assert.equal(mocks.from.mock.calls.length, 2);
  assert.deepEqual(mocks.update.mock.calls[1]?.[0], {
    status: 'scheduled',
    locked_at: null,
    lock_token: null,
  });
});
