import assert from 'node:assert/strict';
import { test, vi } from 'vitest';

type MockFunction<Args extends unknown[], Result> = {
  (...args: Args): Result;
  mock: { calls: Args[] };
  mockImplementation(implementation: (...args: Args) => Result): MockFunction<Args, Result>;
  mockReturnValue(value: Result): MockFunction<Args, Result>;
};

type Subscription = {
  on: MockFunction<[string, Record<string, unknown>, () => void], Subscription>;
  subscribe: MockFunction<[], Subscription>;
};

type Query = {
  select: MockFunction<[string], Query>;
  eq: MockFunction<[string, unknown], Query>;
  in: MockFunction<[string, string[]], Query>;
  order: MockFunction<[string, { ascending: boolean }], Query>;
  range: MockFunction<[number, number], Query>;
  overrideTypes: MockFunction<[], Promise<{ data: unknown[]; error: null }>>;
};

type FetchPage = (
  from: number,
  to: number,
) => Promise<{ data: unknown[] | null; error: unknown }>;

const mocks = vi.hoisted(() => {
  const createMock = <Args extends unknown[], Result>() => (
    vi.fn() as unknown as MockFunction<Args, Result>
  );
  const subscription = {} as Subscription;
  subscription.on = createMock<[string, Record<string, unknown>, () => void], Subscription>();
  subscription.subscribe = createMock<[], Subscription>();
  subscription.on.mockReturnValue(subscription);
  subscription.subscribe.mockReturnValue(subscription);

  const query = {} as Query;
  query.select = createMock<[string], Query>();
  query.eq = createMock<[string, unknown], Query>();
  query.in = createMock<[string, string[]], Query>();
  query.order = createMock<[string, { ascending: boolean }], Query>();
  query.range = createMock<[number, number], Query>();
  query.overrideTypes = createMock<[], Promise<{ data: unknown[]; error: null }>>();
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
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
    channel: createMock<[string], Subscription>(),
    fetchAllPages,
    from: createMock<[string], Query>(),
    removeChannel: createMock<[Subscription], void>(),
    query,
    subscription,
  };
});

mocks.channel.mockReturnValue(mocks.subscription);
mocks.from.mockReturnValue(mocks.query);

vi.mock('../../../../../infrastructure/supabase', () => ({
  databaseClient: {
    channel: mocks.channel,
    from: mocks.from,
    removeChannel: mocks.removeChannel,
  },
  fetchAllPages: mocks.fetchAllPages,
}));

import { listInboxAgendaReminders, subscribeToInboxReminders } from '../inboxRepository';

const resetMocks = () => {
  mocks.channel.mock.calls.length = 0;
  mocks.fetchAllPages.mock.calls.length = 0;
  mocks.from.mock.calls.length = 0;
  mocks.removeChannel.mock.calls.length = 0;
  mocks.query.select.mock.calls.length = 0;
  mocks.query.eq.mock.calls.length = 0;
  mocks.query.in.mock.calls.length = 0;
  mocks.query.order.mock.calls.length = 0;
  mocks.query.range.mock.calls.length = 0;
  mocks.query.overrideTypes.mock.calls.length = 0;
  mocks.subscription.on.mock.calls.length = 0;
  mocks.subscription.subscribe.mock.calls.length = 0;
};

test('assina somente os lembretes do lead e dos contratos do chat', () => {
  resetMocks();
  const unsubscribe = subscribeToInboxReminders(
    ' lead-1 ',
    ['contract-1', '', 'contract-1', ' contract-2 '],
    vi.fn(),
  );

  assert.equal(mocks.subscription.on.mock.calls.length, 2);
  assert.equal(mocks.subscription.on.mock.calls[0]?.[1]?.filter, 'lead_id=eq.lead-1');
  assert.equal(
    mocks.subscription.on.mock.calls[1]?.[1]?.filter,
    'contract_id=in.(contract-1,contract-2)',
  );
  assert.equal(mocks.subscription.subscribe.mock.calls.length, 1);

  unsubscribe();
  assert.equal(mocks.removeChannel.mock.calls.length, 1);
});

test('combina eventos sobrepostos em uma única atualização da agenda', async () => {
  resetMocks();
  let changes = 0;
  const unsubscribe = subscribeToInboxReminders('lead-1', ['contract-1'], () => {
    changes += 1;
  });

  mocks.subscription.on.mock.calls.forEach(([, , callback]) => callback());
  await Promise.resolve();

  assert.equal(changes, 1);
  unsubscribe();
});

test('não cria assinatura quando o chat não tem lead nem contrato', () => {
  resetMocks();
  const unsubscribe = subscribeToInboxReminders(' ', [], vi.fn());

  assert.equal(mocks.channel.mock.calls.length, 0);
  unsubscribe();
  assert.equal(mocks.removeChannel.mock.calls.length, 0);
});

test('carrega somente os campos usados no resumo da agenda', async () => {
  resetMocks();

  await listInboxAgendaReminders('lead-1', ['contract-1']);

  assert.equal(mocks.query.select.mock.calls.length, 2);
  assert.equal(
    mocks.query.select.mock.calls.every(([fields]) => fields === 'id, tipo, titulo, data_lembrete, lido'),
    true,
  );
  assert.equal(
    mocks.query.eq.mock.calls.filter(([field, value]) => field === 'lido' && value === false).length,
    2,
  );
});
