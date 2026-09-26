import assert from 'node:assert/strict';
import { test, vi } from 'vitest';

type MockFunction<Args extends unknown[], Result> = {
  (...args: Args): Result;
  mock: { calls: Args[] };
  mockReturnValue(value: Result): MockFunction<Args, Result>;
  mockImplementation(implementation: (...args: Args) => Result): MockFunction<Args, Result>;
};

type Query = {
  select: MockFunction<[string], Query>;
  in: MockFunction<[string, string[]], Query>;
  order: MockFunction<[string, { ascending: boolean }], Query>;
  range: MockFunction<[number, number], Query>;
  overrideTypes: MockFunction<[], Promise<{ data: unknown[]; error: null }>>;
};

type FetchPage = (
  from: number,
  to: number,
) => Promise<{ data: unknown[] | null; error: unknown }>;

const LEAD_LIST_SELECT =
  'id, nome_completo, telefone, email, cep, endereco, cidade, regiao, estado, origem_id, tipo_contratacao_id, status_id, responsavel_id, operadora_atual, status, data_criacao, ultimo_contato, proximo_retorno, observacoes, blackout_dates, daily_send_limit, skip_automation, arquivado, favorito, created_at, updated_at, canal';

const mocks = vi.hoisted(() => {
  const createMock = <Args extends unknown[], Result>() => (
    vi.fn() as unknown as MockFunction<Args, Result>
  );
  const query = {} as Query;
  query.select = createMock<[string], Query>();
  query.in = createMock<[string, string[]], Query>();
  query.order = createMock<[string, { ascending: boolean }], Query>();
  query.range = createMock<[number, number], Query>();
  query.overrideTypes = createMock<[], Promise<{ data: unknown[]; error: null }>>();
  query.select.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.range.mockReturnValue(query);
  query.overrideTypes.mockReturnValue(Promise.resolve({ data: [], error: null }));

  const fetchAllPages = createMock<[FetchPage], Promise<unknown[]>>();
  fetchAllPages.mockImplementation(async (fetchPage) => {
    const page = await fetchPage(0, 999);
    return page.data ?? [];
  });

  return {
    fetchAllPages,
    from: createMock<[string], Query>(),
    query,
  };
});

mocks.from.mockReturnValue(mocks.query);

vi.mock('../../../../infrastructure/supabase', () => ({
  databaseClient: {
    from: mocks.from,
  },
  fetchAllPages: mocks.fetchAllPages,
  supabase: {
    from: mocks.from,
  },
}));

import { listLeads, listLeadsByStatuses } from '../leadsRepository';

test('carrega somente os campos usados pela lista de leads', async () => {
  await listLeads();

  assert.deepEqual(mocks.query.select.mock.calls[0], [LEAD_LIST_SELECT]);
});

test('mantém o mesmo recorte de campos ao filtrar leads por status', async () => {
  mocks.query.select.mock.calls.splice(0);
  mocks.query.in.mock.calls.splice(0);

  await listLeadsByStatuses(['Novo', 'Em atendimento']);

  assert.deepEqual(mocks.query.select.mock.calls[0], [LEAD_LIST_SELECT]);
  assert.deepEqual(mocks.query.in.mock.calls[0], ['status', ['Novo', 'Em atendimento']]);
});
