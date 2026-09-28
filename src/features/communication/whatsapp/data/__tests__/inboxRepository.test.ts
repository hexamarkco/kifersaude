import assert from 'node:assert/strict';
import { test, vi } from 'vitest';

type MockFunction<Args extends unknown[], Result> = {
  (...args: Args): Result;
  mock: { calls: Args[] };
  mockImplementation(implementation: (...args: Args) => Result): MockFunction<Args, Result>;
  mockReturnValue(value: Result): MockFunction<Args, Result>;
};

type Subscription = {
  on: MockFunction<[string, Record<string, unknown>, (payload?: unknown) => void], Subscription>;
  subscribe: MockFunction<[callback?: (status: string) => void], Subscription>;
};

type QueryResult = { data: unknown; error: unknown | null };

type Query = PromiseLike<QueryResult> & {
  delete: MockFunction<[], Query>;
  update: MockFunction<[Record<string, unknown>], Query>;
  insert: MockFunction<[unknown[]], Query>;
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
  subscription.on = createMock<[string, Record<string, unknown>, (payload?: unknown) => void], Subscription>();
  subscription.subscribe = createMock<[callback?: (status: string) => void], Subscription>();
  subscription.on.mockReturnValue(subscription);
  subscription.subscribe.mockReturnValue(subscription);

  const query = {} as Query;
  const queryResult = { current: { data: null, error: null } as QueryResult };
  const rpcResult = { current: { data: null, error: null } as QueryResult };
  query.delete = createMock<[], Query>();
  query.update = createMock<[Record<string, unknown>], Query>();
  query.insert = createMock<[unknown[]], Query>();
  query.select = createMock<[string], Query>();
  query.eq = createMock<[string, unknown], Query>();
  query.in = createMock<[string, string[]], Query>();
  query.order = createMock<[string, { ascending: boolean }], Query>();
  query.range = createMock<[number, number], Query>();
  query.overrideTypes = createMock<[], Promise<{ data: unknown[]; error: null }>>();
  query.select.mockReturnValue(query);
  query.delete.mockReturnValue(query);
  query.update.mockReturnValue(query);
  query.insert.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.range.mockReturnValue(query);
  query.overrideTypes.mockReturnValue(Promise.resolve({ data: [], error: null }));
  query.then = (onfulfilled, onrejected) => Promise.resolve(queryResult.current).then(onfulfilled, onrejected);

  const fetchAllPages = createMock<[FetchPage], Promise<unknown[]>>();
  const rpc = createMock<[string, Record<string, unknown>], Promise<QueryResult>>();
  rpc.mockImplementation(async () => rpcResult.current);

  return {
    channel: createMock<[string], Subscription>(),
    fetchAllPages,
    from: createMock<[string], Query>(),
    rpc,
    removeChannel: createMock<[Subscription], void>(),
    query,
    queryResult,
    rpcResult,
    subscription,
  };
});

mocks.channel.mockReturnValue(mocks.subscription);
mocks.from.mockReturnValue(mocks.query);

const defaultFetchAllPages = async (fetchPage: FetchPage) => {
  const page = await fetchPage(0, 999);
  return page.data ?? [];
};

mocks.fetchAllPages.mockImplementation(defaultFetchAllPages);

vi.mock('../../../../../infrastructure/supabase', () => ({
  databaseClient: {
    channel: mocks.channel,
    from: mocks.from,
    rpc: mocks.rpc,
    removeChannel: mocks.removeChannel,
  },
  fetchAllPages: mocks.fetchAllPages,
}));

import {
  listInboxAgendaReminders,
  subscribeToInboxLead,
  subscribeToInboxChats,
  subscribeToInboxPresences,
  subscribeToInboxReminders,
  clearInboxLeadAgenda,
  scheduleInboxFollowUp,
  markInboxRemindersRead,
  approveInboxFollowUpSchedule,
  updateInboxFollowUpSentAudits,
  updateInboxFollowUpSentAudit,
  insertInboxLegacyFollowUpAudits,
} from '../inboxRepository';

const resetMocks = () => {
  mocks.channel.mock.calls.length = 0;
  mocks.fetchAllPages.mock.calls.length = 0;
  mocks.from.mock.calls.length = 0;
  mocks.rpc.mock.calls.length = 0;
  mocks.removeChannel.mock.calls.length = 0;
  mocks.query.delete.mock.calls.length = 0;
  mocks.query.update.mock.calls.length = 0;
  mocks.query.insert.mock.calls.length = 0;
  mocks.query.select.mock.calls.length = 0;
  mocks.query.eq.mock.calls.length = 0;
  mocks.query.in.mock.calls.length = 0;
  mocks.query.order.mock.calls.length = 0;
  mocks.query.range.mock.calls.length = 0;
  mocks.query.overrideTypes.mock.calls.length = 0;
  mocks.queryResult.current = { data: null, error: null };
  mocks.rpcResult.current = { data: null, error: null };
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

test('trata um canal fechado como indisponível e ignora eventos depois do unsubscribe', () => {
  resetMocks();
  const statuses: Array<'connected' | 'unavailable'> = [];
  const onStatus = (status: 'connected' | 'unavailable') => statuses.push(status);
  const unsubscribe = subscribeToInboxChats('channel-1', vi.fn(), onStatus);
  const statusCallback = mocks.subscription.subscribe.mock.calls[0]?.[0];

  assert.equal(typeof statusCallback, 'function');
  statusCallback?.('CLOSED');
  statusCallback?.('TIMED_OUT');
  assert.deepEqual(statuses, ['unavailable']);

  unsubscribe();
  statusCallback?.('CHANNEL_ERROR');
  assert.deepEqual(statuses, ['unavailable']);
});

test('ignora eventos tardios de chats, presenças e lead depois do unsubscribe', () => {
  resetMocks();
  let leadChanges = 0;
  let chatChanges = 0;
  let presenceChanges = 0;

  const unsubscribeLead = subscribeToInboxLead('lead-1', () => {
    leadChanges += 1;
  });
  const unsubscribeChats = subscribeToInboxChats('channel-1', () => {
    chatChanges += 1;
  });
  const unsubscribePresences = subscribeToInboxPresences('channel-1', () => {
    presenceChanges += 1;
  });
  const callbacks = mocks.subscription.on.mock.calls.map(([, , callback]) => callback);

  callbacks[0]?.({ new: { id: 'lead-1' } });
  callbacks[1]?.({});
  callbacks[2]?.({});
  assert.deepEqual([leadChanges, chatChanges, presenceChanges], [1, 1, 1]);

  unsubscribeLead();
  unsubscribeChats();
  unsubscribePresences();

  callbacks[0]?.({ new: { id: 'lead-1' } });
  callbacks[1]?.({});
  callbacks[2]?.({});
  assert.deepEqual([leadChanges, chatChanges, presenceChanges], [1, 1, 1]);
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

test('preserva lembretes do lead quando a consulta de contratos falha', async () => {
  resetMocks();
  let calls = 0;
  mocks.fetchAllPages.mockImplementation(async () => {
    calls += 1;
    if (calls === 2) {
      throw new Error('lembretes de contratos indisponíveis');
    }
    return [{
      id: 'reminder-lead-1',
      tipo: 'Outro',
      titulo: 'Retornar contato',
      data_lembrete: '2026-09-27T12:00:00.000Z',
      lido: false,
    }];
  });

  try {
    const reminders = await listInboxAgendaReminders('lead-1', ['contract-1']);

    assert.deepEqual(reminders, [{
      id: 'reminder-lead-1',
      tipo: 'Outro',
      titulo: 'Retornar contato',
      data_lembrete: '2026-09-27T12:00:00.000Z',
      lido: false,
    }]);
  } finally {
    mocks.fetchAllPages.mockImplementation(defaultFetchAllPages);
  }
});

test('limpa os lembretes do lead antes de zerar a data do próximo retorno', async () => {
  resetMocks();

  await clearInboxLeadAgenda('lead-1');

  assert.deepEqual(mocks.from.mock.calls, [['reminders'], ['leads']]);
  assert.equal(mocks.query.delete.mock.calls.length, 1);
  assert.deepEqual(mocks.query.eq.mock.calls, [['lead_id', 'lead-1'], ['id', 'lead-1']]);
  assert.deepEqual(mocks.query.update.mock.calls, [[{ proximo_retorno: null }]]);
});

test('interrompe a limpeza da agenda quando a exclusão dos lembretes falha', async () => {
  resetMocks();
  const error = new Error('falha ao excluir lembretes');
  mocks.queryResult.current = { data: null, error };

  await assert.rejects(clearInboxLeadAgenda('lead-1'), error);

  assert.deepEqual(mocks.from.mock.calls, [['reminders']]);
  assert.equal(mocks.query.update.mock.calls.length, 0);
});

test('agenda follow-up pelo RPC legado e pela versão com geração', async () => {
  resetMocks();
  mocks.rpcResult.current = { data: [{ inserted: true, reminder_id: 'reminder-1' }], error: null };
  const baseInput = {
    leadId: 'lead-1',
    title: 'Retomar contato: Ana',
    description: 'Confirmar o horário',
    dueAt: '2026-10-01T12:00:00.000Z',
    priority: 'normal',
  };

  assert.deepEqual(await scheduleInboxFollowUp(baseInput), { inserted: true, reminderId: 'reminder-1' });
  assert.deepEqual(mocks.rpc.mock.calls[0], ['schedule_follow_up_reminder', {
    p_lead_id: 'lead-1',
    p_title: 'Follow-up: Ana',
    p_description: 'Confirmar o horário',
    p_due_at: '2026-10-01T12:00:00.000Z',
    p_priority: 'normal',
  }]);

  mocks.rpcResult.current = { data: { inserted: false, reminder_id: null }, error: null };
  assert.deepEqual(await scheduleInboxFollowUp({
    ...baseInput,
    generationId: 'generation-1',
  }), { inserted: false, reminderId: null });
  assert.deepEqual(mocks.rpc.mock.calls[1], ['schedule_follow_up_reminder_v2', {
    p_lead_id: 'lead-1',
    p_title: 'Follow-up: Ana',
    p_description: 'Confirmar o horário',
    p_due_at: '2026-10-01T12:00:00.000Z',
    p_priority: 'normal',
    p_generation_id: 'generation-1',
    p_origin: 'follow_up_v2_batch',
  }]);
});

test('propaga erro do RPC de follow-up', async () => {
  resetMocks();
  const error = new Error('RPC indisponível');
  mocks.rpcResult.current = { data: null, error };

  await assert.rejects(scheduleInboxFollowUp({
    leadId: 'lead-1',
    title: 'Retorno',
    description: null,
    dueAt: '2026-10-01T12:00:00.000Z',
    priority: 'normal',
  }), error);
});

test('ignora lista vazia ao marcar lembretes e atualiza somente os IDs informados', async () => {
  resetMocks();
  await markInboxRemindersRead([]);
  assert.equal(mocks.from.mock.calls.length, 0);

  await markInboxRemindersRead(['reminder-1', 'reminder-2']);

  assert.deepEqual(mocks.from.mock.calls, [['reminders']]);
  assert.deepEqual(mocks.query.update.mock.calls, [[{ lido: true }]]);
  assert.deepEqual(mocks.query.in.mock.calls, [['id', ['reminder-1', 'reminder-2']]]);
});

test('aprova o agendamento da geração com os dados do lembrete criado', async () => {
  resetMocks();

  await approveInboxFollowUpSchedule({
    generationId: 'generation-1',
    dueAt: '2026-10-01T12:00:00.000Z',
    reminderId: 'reminder-1',
  });

  const [patch] = mocks.query.update.mock.calls[0] ?? [];
  assert.deepEqual({
    schedule_approved: patch?.schedule_approved,
    approved_schedule_date: patch?.approved_schedule_date,
    created_reminder_id: patch?.created_reminder_id,
  }, {
    schedule_approved: true,
    approved_schedule_date: '2026-10-01T12:00:00.000Z',
    created_reminder_id: 'reminder-1',
  });
  assert.equal(Number.isNaN(Date.parse(String(patch?.schedule_approved_at))), false);
  assert.deepEqual(mocks.query.eq.mock.calls, [['id', 'generation-1']]);
});

test('atualiza auditorias de follow-up em lote e propaga falha de gravação', async () => {
  resetMocks();
  await updateInboxFollowUpSentAudits([
    { id: 'generation-1', sentText: 'Mensagem 1' },
    { id: 'generation-2', sentText: 'Mensagem 2' },
  ], '2026-10-01T12:00:00.000Z');

  assert.deepEqual(mocks.query.update.mock.calls, [
    [{ sent_text: 'Mensagem 1', sent_at_actual: '2026-10-01T12:00:00.000Z' }],
    [{ sent_text: 'Mensagem 2', sent_at_actual: '2026-10-01T12:00:00.000Z' }],
  ]);
  assert.deepEqual(mocks.query.eq.mock.calls, [['id', 'generation-1'], ['id', 'generation-2']]);

  const error = new Error('falha de auditoria');
  mocks.queryResult.current = { data: null, error };
  await assert.rejects(
    updateInboxFollowUpSentAudits([{ id: 'generation-1', sentText: 'Mensagem 1' }], '2026-10-01T12:00:00.000Z'),
    error,
  );
});

test('atualiza uma auditoria de follow-up individual com o horário de envio', async () => {
  resetMocks();

  await updateInboxFollowUpSentAudit('generation-1', 'Mensagem enviada');

  const patch = mocks.query.update.mock.calls[0]?.[0];
  assert.deepEqual(patch?.sent_text, 'Mensagem enviada');
  assert.equal(Number.isNaN(Date.parse(String(patch?.sent_at_actual))), false);
  assert.deepEqual(mocks.query.eq.mock.calls, [['id', 'generation-1']]);
});

test('não insere auditorias antigas vazias e propaga erro ao inserir registros', async () => {
  resetMocks();
  await insertInboxLegacyFollowUpAudits([]);
  assert.equal(mocks.from.mock.calls.length, 0);

  const entries = [{ chat_id: 'chat-1', sent_text: 'Mensagem histórica' }];
  await insertInboxLegacyFollowUpAudits(entries);
  assert.deepEqual(mocks.from.mock.calls, [['comm_follow_up_audit_log']]);
  assert.deepEqual(mocks.query.insert.mock.calls, [[entries]]);

  const error = new Error('falha ao inserir auditoria');
  mocks.queryResult.current = { data: null, error };
  await assert.rejects(insertInboxLegacyFollowUpAudits(entries), error);
});
