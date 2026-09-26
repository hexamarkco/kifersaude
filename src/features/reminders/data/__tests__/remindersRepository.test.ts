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
  eq: MockFunction<[string, unknown], Query>;
  order: MockFunction<[string, { ascending: boolean }], Query>;
  range: MockFunction<[number, number], Query>;
  overrideTypes: MockFunction<[], Promise<{ data: unknown[]; error: null }>>;
};

type FetchPage = (
  from: number,
  to: number,
) => Promise<{ data: unknown[] | null; error: unknown }>;

type Channel = {
  on: MockFunction<[string, Record<string, unknown>, (payload?: unknown) => void], Channel>;
  subscribe: MockFunction<[], Channel>;
};

const mocks = vi.hoisted(() => {
  const createMock = <Args extends unknown[], Result>() => (
    vi.fn() as unknown as MockFunction<Args, Result>
  );
  const query = {} as Query;
  query.select = createMock<[string], Query>();
  query.in = createMock<[string, string[]], Query>();
  query.eq = createMock<[string, unknown], Query>();
  query.order = createMock<[string, { ascending: boolean }], Query>();
  query.range = createMock<[number, number], Query>();
  query.overrideTypes = createMock<[], Promise<{ data: unknown[]; error: null }>>();
  query.select.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.range.mockReturnValue(query);
  query.overrideTypes.mockReturnValue(Promise.resolve({
    data: [{
      id: 'reminder-1',
      tipo: 'retorno',
      titulo: 'Retorno agendado: cliente',
      descricao: 'Ligar para o cliente',
      data_lembrete: '2026-09-26T12:00:00Z',
      lido: false,
    }],
    error: null,
  }));

  const fetchAllPages = createMock<[FetchPage], Promise<unknown[]>>();
  fetchAllPages.mockImplementation(async (fetchPage) => {
    const page = await fetchPage(0, 999);
    return page.data ?? [];
  });

  const subscription = {} as Channel;
  subscription.on = createMock<[string, Record<string, unknown>, (payload?: unknown) => void], Channel>();
  subscription.subscribe = createMock<[], Channel>();
  subscription.on.mockReturnValue(subscription);
  subscription.subscribe.mockReturnValue(subscription);

  return {
    channel: createMock<[string], Channel>(),
    fetchAllPages,
    from: createMock<[string], Query>(),
    query,
    removeChannel: createMock<[Channel], void>(),
    subscription,
  };
});

mocks.from.mockReturnValue(mocks.query);
mocks.channel.mockReturnValue(mocks.subscription);

vi.mock('../../../../infrastructure/supabase', () => ({
  databaseClient: {
    channel: mocks.channel,
    from: mocks.from,
    removeChannel: mocks.removeChannel,
  },
  fetchAllPages: mocks.fetchAllPages,
}));

import {
  listPendingRemindersForLead,
  listReminderContracts,
  listReminderLeads,
  listReminders,
  listRemindersForLeadContext,
  subscribeToReminderChanges,
} from '../remindersRepository';

test('carrega somente lembretes pendentes do contexto e normaliza valores legados', async () => {
  const result = await listRemindersForLeadContext('lead-1', ['contract-1']);

  assert.equal(mocks.query.select.mock.calls.length, 2);
  assert.equal(
    mocks.query.select.mock.calls.every(([fields]) => fields === 'id, tipo, titulo, descricao, data_lembrete, lido'),
    true,
  );
  assert.equal(
    mocks.query.eq.mock.calls.filter(([field, value]) => field === 'lido' && value === false).length,
    2,
  );
  assert.equal(result.leadReminders[0]?.tipo, 'Follow-up');
  assert.equal(result.leadReminders[0]?.titulo, 'Follow-up: cliente');
  assert.equal(result.contractReminders[0]?.lido, false);
});

test('carrega somente os campos usados pelas listas da agenda', async () => {
  mocks.query.select.mock.calls.splice(0);

  await listReminders();

  assert.deepEqual(mocks.query.select.mock.calls[0], [
    'id, contract_id, lead_id, tipo, titulo, descricao, data_lembrete, lido, prioridade, tags, tempo_estimado_minutos',
  ]);
});

test('carrega somente id e titulo para selecionar lembretes pendentes', async () => {
  mocks.query.select.mock.calls.splice(0);

  const result = await listPendingRemindersForLead('lead-1');

  assert.deepEqual(mocks.query.select.mock.calls[0], ['id, titulo']);
  assert.deepEqual(result.map(({ id, titulo }) => ({ id, titulo })), [{
    id: 'reminder-1',
    titulo: 'Follow-up: cliente',
  }]);
});

test('carrega somente o contexto necessario dos contratos relacionados', async () => {
  mocks.query.select.mock.calls.splice(0);

  await listReminderContracts(['contract-1']);

  assert.deepEqual(mocks.query.select.mock.calls[0], ['id, lead_id, codigo_contrato']);
});

test('carrega somente o contexto necessario dos leads relacionados', async () => {
  mocks.query.select.mock.calls.splice(0);

  await listReminderLeads(['lead-1']);

  assert.deepEqual(mocks.query.select.mock.calls[0], [
    'id, nome_completo, telefone, status, responsavel_id, favorito, proximo_retorno, ultimo_contato',
  ]);
});

test('ignora eventos tardios depois do unsubscribe da agenda', () => {
  mocks.subscription.on.mock.calls.splice(0);
  let changes = 0;
  const unsubscribe = subscribeToReminderChanges(() => {
    changes += 1;
  });
  const callback = mocks.subscription.on.mock.calls[0]?.[2];
  const payload = {
    eventType: 'INSERT',
    new: { id: 'reminder-1', tipo: 'retorno', titulo: 'Retorno' },
    old: {},
  };

  callback?.(payload);
  assert.equal(changes, 1);

  unsubscribe();
  callback?.(payload);
  assert.equal(changes, 1);
  assert.equal(mocks.removeChannel.mock.calls.length, 1);
});
