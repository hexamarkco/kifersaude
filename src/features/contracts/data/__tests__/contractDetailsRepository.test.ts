import assert from 'node:assert/strict';
import { test, vi } from 'vitest';

type QueryResult = {
  data: unknown[] | null;
  error: Error | null;
};

type MockFunction<Args extends unknown[], Result> = {
  (...args: Args): Result;
  mock: { calls: Args[] };
  mockReturnValue(value: Result): MockFunction<Args, Result>;
  mockImplementation(implementation: (...args: Args) => Result): MockFunction<Args, Result>;
};

type Query = {
  select: MockFunction<[string], Query>;
  eq: MockFunction<[string, unknown], Query>;
  order: MockFunction<[string], Query>;
  in: MockFunction<[string, string[]], Promise<QueryResult>>;
  overrideTypes: MockFunction<[], Promise<QueryResult>>;
};

const mocks = vi.hoisted(() => {
  const createMock = <Args extends unknown[], Result>() => (
    vi.fn() as unknown as MockFunction<Args, Result>
  );
  const query = {} as Query;
  const results: QueryResult[] = [];
  let documentsResult: QueryResult = { data: [], error: null };

  query.select = createMock<[string], Query>();
  query.eq = createMock<[string, unknown], Query>();
  query.order = createMock<[string], Query>();
  query.in = createMock<[string, string[]], Promise<QueryResult>>();
  query.overrideTypes = createMock<[], Promise<QueryResult>>();
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.overrideTypes.mockImplementation(async () => (
    results.shift() ?? { data: [], error: null }
  ));
  query.in.mockImplementation(async () => documentsResult);

  return {
    from: createMock<[string], Query>(),
    query,
    results,
    setDocumentsResult: (result: QueryResult) => {
      documentsResult = result;
    },
  };
});

mocks.from.mockReturnValue(mocks.query);

vi.mock('../../../../infrastructure/supabase', () => ({
  databaseClient: {
    from: mocks.from,
  },
}));

import { getContractDetailsSnapshot } from '../contractDetailsRepository';

test('propaga falhas dos dados principais do contrato em vez de tratá-las como listas vazias', async () => {
  const error = new Error('falha ao carregar titulares');
  mocks.results.push(
    { data: null, error },
    { data: [], error: null },
    { data: [], error: null },
    { data: [], error: null },
  );

  await assert.rejects(
    getContractDetailsSnapshot('contract-1'),
    (receivedError: unknown) => receivedError === error,
  );
});

test('mantém a falha de documentos identificada para a tela exibir retry', async () => {
  const error = new Error('falha ao carregar documentos');
  mocks.results.push(
    { data: [{ id: 'holder-1' }], error: null },
    { data: [], error: null },
    { data: [], error: null },
    { data: [], error: null },
  );
  mocks.setDocumentsResult({ data: null, error });

  const snapshot = await getContractDetailsSnapshot('contract-1');

  assert.equal(snapshot.documentsError, error);
  assert.deepEqual(snapshot.documents, []);
});
