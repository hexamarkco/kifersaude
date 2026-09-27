import assert from 'node:assert/strict';
import { test, vi } from 'vitest';

type MockFunction<Args extends unknown[], Result> = {
  (...args: Args): Result;
  mock: { calls: Args[] };
  mockReturnValue(value: Result): MockFunction<Args, Result>;
  mockImplementation(implementation: (...args: Args) => Result): MockFunction<Args, Result>;
};

type FetchPage = (
  from: number,
  to: number,
) => Promise<{ data: unknown[] | null; error: unknown }>;

type Query = {
  select: MockFunction<[string], Query>;
  order: MockFunction<[string, { ascending: boolean }], Query>;
  range: MockFunction<[number, number], Query>;
  overrideTypes: MockFunction<[], Promise<{ data: unknown[]; error: null }>>;
};

type Channel = {
  on: MockFunction<[string, Record<string, unknown>, (payload?: unknown) => void], Channel>;
  subscribe: MockFunction<[], Channel>;
};

const DASHBOARD_LEAD_SELECT =
  'id, nome_completo, telefone, email, cep, endereco, cidade, regiao, estado, origem_id, tipo_contratacao_id, status_id, responsavel_id, operadora_atual, status, data_criacao, ultimo_contato, proximo_retorno, observacoes, blackout_dates, daily_send_limit, skip_automation, arquivado, favorito, created_at, updated_at, canal';

const mocks = vi.hoisted(() => {
  const createMock = <Args extends unknown[], Result>() => (
    vi.fn() as unknown as MockFunction<Args, Result>
  );
  const query = {} as Query;
  query.select = createMock<[string], Query>();
  query.order = createMock<[string, { ascending: boolean }], Query>();
  query.range = createMock<[number, number], Query>();
  query.overrideTypes = createMock<[], Promise<{ data: unknown[]; error: null }>>();
  query.select.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.range.mockReturnValue(query);
  query.overrideTypes.mockImplementation(async () => ({ data: [], error: null }));

  const subscription = {} as Channel;
  subscription.on = createMock<[string, Record<string, unknown>, (payload?: unknown) => void], Channel>();
  subscription.subscribe = createMock<[], Channel>();
  subscription.on.mockReturnValue(subscription);
  subscription.subscribe.mockReturnValue(subscription);

  return {
    channel: createMock<[string], Channel>(),
    query,
    from: createMock<[string], Query>(),
    fetchAllPages: createMock<[FetchPage], Promise<unknown[]>>(),
    removeChannel: createMock<[Channel], void>(),
    subscription,
  };
});

mocks.from.mockReturnValue(mocks.query);
mocks.channel.mockReturnValue(mocks.subscription);
const defaultFetchAllPages = async (fetchPage: FetchPage) => {
  const result = await fetchPage(0, 999);
  return result.data ?? [];
};

mocks.fetchAllPages.mockImplementation(defaultFetchAllPages);

vi.mock('../../../../infrastructure/supabase', () => ({
  databaseClient: {
    channel: mocks.channel,
    from: mocks.from,
    removeChannel: mocks.removeChannel,
  },
  fetchAllPages: mocks.fetchAllPages,
}));

import {
  loadDashboardCalendarSnapshot,
  loadDashboardDecisionSnapshot,
  loadDashboardSnapshot,
  subscribeToDashboardLeads,
} from '../dashboardRepository';

test('carrega somente os campos necessários de leads no dashboard', async () => {
  await loadDashboardSnapshot();

  assert.deepEqual(mocks.query.select.mock.calls[0], [DASHBOARD_LEAD_SELECT]);
});

test('preserva indicadores complementares quando uma fonte falha', async () => {
  let calls = 0;
  mocks.fetchAllPages.mockImplementation(async () => {
    calls += 1;
    if (calls === 2) {
      throw new Error('interações indisponíveis');
    }
    return calls === 1 ? [{ id: 'reminder-1' }] : [{ id: 'history-1' }];
  });

  try {
    const snapshot = await loadDashboardDecisionSnapshot();

    assert.deepEqual(snapshot.reminders, [{ id: 'reminder-1' }]);
    assert.deepEqual(snapshot.interactions, []);
    assert.deepEqual(snapshot.statusHistory, [{ id: 'history-1' }]);
    assert.deepEqual(snapshot.failedSources, ['interactions']);
  } finally {
    mocks.fetchAllPages.mockImplementation(defaultFetchAllPages);
  }
});

test('preserva titulares quando a consulta de dependentes falha', async () => {
  let calls = 0;
  mocks.fetchAllPages.mockImplementation(async () => {
    calls += 1;
    if (calls === 2) {
      throw new Error('dependentes indisponíveis');
    }
    return [{ id: 'holder-1', contract_id: 'contract-1' }];
  });

  try {
    const snapshot = await loadDashboardCalendarSnapshot(['contract-1']);

    assert.deepEqual(snapshot.holders, [{ id: 'holder-1', contract_id: 'contract-1' }]);
    assert.deepEqual(snapshot.dependents, []);
    assert.deepEqual(snapshot.failedSources, ['dependents']);
  } finally {
    mocks.fetchAllPages.mockImplementation(defaultFetchAllPages);
  }
});

test('preserva lotes válidos do calendário quando um lote falha', async () => {
  const contractIds = Array.from({ length: 101 }, (_, index) => `contract-${index}`);
  let calls = 0;
  mocks.fetchAllPages.mockImplementation(async () => {
    calls += 1;
    if (calls === 2) {
      throw new Error('segundo lote de titulares indisponível');
    }
    if (calls === 1) {
      return [{ id: 'holder-1', contract_id: 'contract-1' }];
    }
    return [{ id: `dependent-${calls}`, contract_id: 'contract-1' }];
  });

  try {
    const snapshot = await loadDashboardCalendarSnapshot(contractIds);

    assert.deepEqual(snapshot.holders, [{ id: 'holder-1', contract_id: 'contract-1' }]);
    assert.equal(snapshot.dependents.length, 2);
    assert.deepEqual(snapshot.failedSources, ['holders']);
  } finally {
    mocks.fetchAllPages.mockImplementation(defaultFetchAllPages);
  }
});

test('ignora eventos tardios de leads do dashboard depois do unsubscribe', () => {
  mocks.subscription.on.mock.calls.splice(0);
  let changes = 0;
  const unsubscribe = subscribeToDashboardLeads(() => {
    changes += 1;
  });
  const callback = mocks.subscription.on.mock.calls[0]?.[2];
  const payload = {
    eventType: 'UPDATE',
    new: { id: 'lead-1' },
    old: {},
  };

  callback?.(payload);
  assert.equal(changes, 1);

  unsubscribe();
  callback?.(payload);
  assert.equal(changes, 1);
  assert.equal(mocks.removeChannel.mock.calls.length, 1);
});
