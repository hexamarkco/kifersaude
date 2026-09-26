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
  update: MockFunction<[Record<string, unknown>], Query>;
  eq: MockFunction<[string, string], Query>;
  in: MockFunction<[string, string[]], Query>;
  insert: MockFunction<[unknown], Query>;
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
  query.update = createMock<[Record<string, unknown>], Query>();
  query.eq = createMock<[string, string], Query>();
  query.in = createMock<[string, string[]], Query>();
  query.insert = createMock<[unknown], Query>();
  query.order = createMock<[string, { ascending: boolean }], Query>();
  query.range = createMock<[number, number], Query>();
  query.overrideTypes = createMock<[], Promise<{ data: unknown[]; error: null }>>();
  query.select.mockReturnValue(query);
  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.insert.mockReturnValue(query);
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

import type { Lead } from '../../domain/types';
import {
  listLeads,
  listLeadsByStatuses,
  persistLeadStatusChange,
  updateLeadDetails,
} from '../leadsRepository';

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

test('atualiza o responsável usando a chave estrangeira atual', async () => {
  mocks.query.update.mock.calls.splice(0);
  mocks.query.in.mock.calls.splice(0);

  await updateLeadDetails(['lead-1'], {
    responsavel_id: 'owner-1',
    proximo_retorno: null,
  });

  assert.deepEqual(mocks.query.update.mock.calls[0], [
    { responsavel_id: 'owner-1', proximo_retorno: null },
  ]);
  assert.deepEqual(mocks.query.in.mock.calls[0], ['id', ['lead-1']]);
});

test('persiste o status usando também a chave do status atual', async () => {
  mocks.query.update.mock.calls.splice(0);
  mocks.query.eq.mock.calls.splice(0);
  mocks.query.insert.mock.calls.splice(0);

  await persistLeadStatusChange({
    lead: {
      id: 'lead-1',
      nome_completo: 'Lead de teste',
      telefone: '5511999999999',
      status: 'Novo',
      status_id: 'status-old',
      responsavel: 'Luiza',
      data_criacao: '2026-09-26T12:00:00.000Z',
      arquivado: false,
      created_at: '2026-09-26T12:00:00.000Z',
      updated_at: '2026-09-26T12:00:00.000Z',
    } as Lead,
    newStatus: 'Atendimento',
    newStatusId: 'status-new',
    timestamp: '2026-09-26T12:05:00.000Z',
  });

  assert.deepEqual(mocks.query.update.mock.calls[0], [
    {
      status: 'Atendimento',
      status_id: 'status-new',
      ultimo_contato: '2026-09-26T12:05:00.000Z',
    },
  ]);
});
