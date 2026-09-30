import assert from 'node:assert/strict';
import { test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  type TestMock<Args extends unknown[], Result> = ((...args: Args) => Result) & {
    mock: { calls: Args[] };
    mockImplementation: (implementation: (...args: Args) => Result) => TestMock<Args, Result>;
    mockReturnValue: (value: Result) => TestMock<Args, Result>;
    mockResolvedValue: (value: Awaited<Result>) => TestMock<Args, Result>;
  };
  type Query = {
    select: TestMock<[string], Query>;
    eq: TestMock<[string, unknown], Query>;
    in: TestMock<[string, string[]], Query>;
    order: TestMock<[string, { ascending: boolean }], Query>;
    limit: TestMock<[number], Query>;
    range: TestMock<[number, number], Promise<{ data: unknown[]; error: unknown | null }>>;
    overrideTypes: TestMock<[], Promise<{ data: unknown[]; error: unknown | null }>>;
    maybeSingle: TestMock<[], Promise<{ data: unknown; error: unknown | null }>>;
  };

  const createMock = <Args extends unknown[], Result>() => vi.fn() as unknown as TestMock<Args, Result>;
  const query: Query = {
    select: createMock<[string], Query>(),
    eq: createMock<[string, unknown], Query>(),
    in: createMock<[string, string[]], Query>(),
    order: createMock<[string, { ascending: boolean }], Query>(),
    limit: createMock<[number], Query>(),
    range: createMock<[number, number], Promise<{ data: unknown[]; error: unknown | null }>>(),
    overrideTypes: createMock<[], Promise<{ data: unknown[]; error: unknown | null }>>(),
    maybeSingle: createMock<[], Promise<{ data: unknown; error: unknown | null }>>(),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.range.mockResolvedValue({ data: [], error: null });
  query.maybeSingle.mockResolvedValue({ data: null, error: null });

  const groupQuery: Query = {
    select: createMock<[string], Query>(),
    eq: createMock<[string, unknown], Query>(),
    in: createMock<[string, string[]], Query>(),
    order: createMock<[string, { ascending: boolean }], Query>(),
    limit: createMock<[number], Query>(),
    range: createMock<[number, number], Promise<{ data: unknown[]; error: unknown | null }>>(),
    overrideTypes: createMock<[], Promise<{ data: unknown[]; error: unknown | null }>>(),
    maybeSingle: createMock<[], Promise<{ data: unknown; error: unknown | null }>>(),
  };
  groupQuery.select.mockReturnValue(groupQuery);
  groupQuery.eq.mockReturnValue(groupQuery);
  groupQuery.in.mockReturnValue(groupQuery);
  groupQuery.order.mockReturnValue(groupQuery);
  groupQuery.limit.mockReturnValue(groupQuery);
  groupQuery.range.mockResolvedValue({ data: [], error: null });
  groupQuery.overrideTypes.mockResolvedValue({ data: [], error: null });
  groupQuery.maybeSingle.mockResolvedValue({ data: null, error: null });

  const from = createMock<[string], Query>();
  const rpc = createMock<
    [string, Record<string, unknown>],
    Promise<{ data: unknown; error: unknown | null }>
  >();
  const invoke = createMock<[
    string,
    { body: Record<string, unknown> },
  ], Promise<{ data: unknown; error: unknown; response: Response | null }>>();
  const getSupabaseErrorMessage = createMock<[unknown, string], Promise<string>>();
  const isSupabaseFunctionFetchError = createMock<[unknown], boolean>();
  const waitForSupabaseSession = createMock<[{ errorMessage: string }], Promise<void>>();
  const getSession = createMock<[], Promise<{ data: { session: { access_token: string } | null }; error: unknown | null }>>();

  from.mockImplementation((table) => table === 'comm_whatsapp_groups' ? groupQuery : query);
  rpc.mockResolvedValue({ data: [], error: null });
  getSupabaseErrorMessage.mockImplementation(async (_error, fallback) => fallback);
  isSupabaseFunctionFetchError.mockReturnValue(false);
  waitForSupabaseSession.mockResolvedValue(undefined);
  getSession.mockResolvedValue({ data: { session: { access_token: 'test-token' } }, error: null });

  return {
    from,
    groupQuery,
    getSupabaseErrorMessage,
    getSession,
    invoke,
    isSupabaseFunctionFetchError,
    query,
    rpc,
    waitForSupabaseSession,
  };
});

vi.mock('../../../../../infrastructure/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
    from: mocks.from,
    rpc: mocks.rpc,
    functions: {
      invoke: mocks.invoke,
    },
  },
  getSupabaseErrorMessage: mocks.getSupabaseErrorMessage,
  isSupabaseFunctionFetchError: mocks.isSupabaseFunctionFetchError,
  supabaseFunctionsUrl: 'https://example.test/functions/v1',
  waitForSupabaseSession: mocks.waitForSupabaseSession,
}));

import { commWhatsAppService } from '../commWhatsAppService';

const manualContact = {
  id: 'manual-row',
  channel_id: 'channel-1',
  contact_id: 'manual:5521982965495',
  phone_number: '5521982965495',
  phone_digits: '5521982965495',
  display_name: 'Mariangela',
  short_name: 'Mariangela',
  push_name: null,
  saved: true,
  manual_override: true,
  manual_override_name: 'Mariangela',
  last_synced_at: '2026-09-08T13:00:00.000Z',
  created_at: '2026-09-08T09:00:00.000Z',
  updated_at: '2026-09-08T09:00:00.000Z',
};

test('mantém o nome manual quando a Edge Function de contatos falha', async () => {
  mocks.invoke.mockResolvedValue({
    data: null,
    error: new Error('função temporariamente indisponível'),
    response: null,
  });
  mocks.query.overrideTypes.mockResolvedValue({ data: [manualContact], error: null });

  const contacts = await commWhatsAppService.lookupSavedContactsByPhones({
    phoneNumbers: ['+55 (21) 98296-5495'],
  });

  assert.equal(contacts.length, 1);
  assert.equal(contacts[0]?.display_name, 'Mariangela');
  assert.equal(contacts[0]?.manual_override, true);
  assert.equal(mocks.from.mock.calls[0]?.[0], 'comm_whatsapp_phone_contacts_cache');
});

test('preserva o erro para o retry quando a Edge Function e o cache falham', async () => {
  mocks.invoke.mockResolvedValue({
    data: null,
    error: new Error('função temporariamente indisponível'),
    response: null,
  });
  mocks.query.overrideTypes.mockResolvedValue({
    data: [],
    error: new Error('cache temporariamente indisponível'),
  });

  await assert.rejects(
    () => commWhatsAppService.lookupSavedContactsByPhones({ phoneNumbers: ['5521982965495'] }),
    /Nao foi possivel localizar contatos salvos do WhatsApp\./,
  );
});

test('nao aceita nome do provedor quando o cache canonico falha', async () => {
  mocks.invoke.mockResolvedValue({
    data: {
      contacts: [{
        ...manualContact,
        contact_id: '5521982965495',
        display_name: 'Mariangela - Cliente',
        manual_override: false,
        manual_override_name: null,
      }],
    },
    error: null,
    response: null,
  });
  mocks.query.overrideTypes.mockResolvedValue({
    data: [],
    error: new Error('cache temporariamente indisponível'),
  });

  const contacts = await commWhatsAppService.lookupSavedContactsByPhones({
    phoneNumbers: ['5521982965495'],
  });

  assert.deepEqual(contacts, []);
});

test('corrige o nome atrasado da lista de contatos com o cache canonico', async () => {
  mocks.invoke.mockResolvedValue({
    data: {
      contacts: [{
        ...manualContact,
        contact_id: '5521982965495',
        display_name: 'Mariangela - Cliente',
        manual_override: false,
        manual_override_name: null,
      }],
      total: 1,
      hasMore: false,
    },
    error: null,
    response: null,
  });
  mocks.query.overrideTypes.mockResolvedValue({ data: [manualContact], error: null });

  const page = await commWhatsAppService.listSavedContacts({ page: 1 });

  assert.equal(page.contacts[0]?.display_name, 'Mariangela');
  assert.equal(page.contacts[0]?.manual_override, true);
  assert.equal(page.contacts[0]?.manual_override_name, 'Mariangela');
});

test('nao devolve duas linhas do mesmo telefone na lista de contatos', async () => {
  mocks.invoke.mockResolvedValue({
    data: {
      contacts: [
        {
          ...manualContact,
          id: 'provider-row',
          contact_id: '5521982965495',
          display_name: 'Mariangela - Cliente',
          manual_override: false,
          manual_override_name: null,
        },
        manualContact,
      ],
      total: 2,
      hasMore: false,
    },
    error: null,
    response: null,
  });
  mocks.query.overrideTypes.mockResolvedValue({ data: [manualContact], error: null });

  const page = await commWhatsAppService.listSavedContacts({ page: 1 });

  assert.equal(page.contacts.length, 1);
  assert.equal(page.contacts[0]?.display_name, 'Mariangela');
  assert.equal(page.contacts[0]?.manual_override, true);
});

test('lista agendamentos sem pedir colunas que nao existem no chat remoto', async () => {
  const selectCallsBefore = mocks.query.select.mock.calls.length;

  await commWhatsAppService.listScheduledMessages({ channelId: 'channel-1' });
  await commWhatsAppService.listScheduledSequences({ channelId: 'channel-1' });

  const scheduledSelects = mocks.query.select.mock.calls
    .slice(selectCallsBefore)
    .map(([fields]) => fields);

  assert.equal(scheduledSelects.length, 2);
  assert.equal(scheduledSelects.every((fields) => !fields.includes('lead_name')), true);
  assert.equal(scheduledSelects.every((fields) => fields.includes('chat:comm_whatsapp_chats!left')), true);
  assert.equal(scheduledSelects.every((fields) => fields.includes('lead_id')), true);
});

test('limita cada lote da sincronizacao geral a mensagens recentes', async () => {
  mocks.invoke.mockResolvedValue({
    data: {
      totalKnownChats: 0,
      processedChats: 0,
      discoveredChats: 0,
      importedMessages: 0,
      updatedMessages: 0,
      identityConflicts: 0,
      hasMoreChats: false,
      nextChatOffset: null,
      timeTo: 1_800_000_000,
      chats: [],
    },
    error: null,
    response: null,
  });

  await commWhatsAppService.syncAllChats();

  const calls = mocks.invoke.mock.calls;
  const [functionName, invokeOptions] = calls[calls.length - 1] ?? [];
  assert.equal(functionName, 'comm-whatsapp-sync-all-chats');
  assert.equal(invokeOptions?.body.chatCount, 4);
  assert.equal(invokeOptions?.body.pagesPerChat, 1);
  assert.equal(invokeOptions?.body.messagesPerPage, 25);
});

test('continua a sincronizacao geral por mais de 200 lotes', async () => {
  const callsBefore = mocks.invoke.mock.calls.length;
  mocks.invoke.mockImplementation(async (_functionName, invokeOptions) => {
    const chatOffset = Number(invokeOptions.body.chatOffset) || 0;
    const hasMoreChats = chatOffset < 1_600;

    return {
      data: {
        totalKnownChats: 1_601,
        processedChats: hasMoreChats ? 4 : 1,
        discoveredChats: 0,
        importedMessages: 0,
        updatedMessages: 0,
        identityConflicts: 0,
        hasMoreChats,
        nextChatOffset: hasMoreChats ? chatOffset + 4 : null,
        timeTo: 1_800_000_000,
        chats: [],
      },
      error: null,
      response: null,
    };
  });

  const result = await commWhatsAppService.syncAllChats();

  assert.equal(result.chatsProcessed, 1_601);
  assert.equal(mocks.invoke.mock.calls.length - callsBefore, 401);
});

test('mantém a agenda disponível quando a relação de chat falha no PostgREST', async () => {
  const selectCallsBefore = mocks.query.select.mock.calls.length;
  let attempts = 0;
  mocks.query.range.mockImplementation(async () => {
    attempts += 1;
    return attempts % 2 === 1
      ? { data: [], error: { status: 400, message: 'column lead_name does not exist' } }
      : { data: [], error: null };
  });

  await commWhatsAppService.listScheduledMessages({ channelId: 'channel-1' });
  await commWhatsAppService.listScheduledSequences({ channelId: 'channel-1' });

  const scheduledSelects = mocks.query.select.mock.calls
    .slice(selectCallsBefore)
    .map(([fields]) => fields);

  assert.equal(attempts, 4);
  assert.equal(scheduledSelects.length, 4);
  assert.equal(scheduledSelects[0]?.includes('chat:comm_whatsapp_chats!left'), true);
  assert.equal(scheduledSelects[1]?.includes('chat:comm_whatsapp_chats!left'), false);
  assert.equal(scheduledSelects[2]?.includes('chat:comm_whatsapp_chats!left'), true);
  assert.equal(scheduledSelects[3]?.includes('chat:comm_whatsapp_chats!left'), false);

  mocks.query.range.mockResolvedValue({ data: [], error: null });
});

test('agenda a mensagem no chat selecionado quando ele existe', async () => {
  mocks.query.maybeSingle.mockResolvedValue({ data: { id: 'chat-1', is_group: false }, error: null });
  mocks.rpc.mockResolvedValue({ data: 'scheduled-1', error: null });

  const scheduledId = await commWhatsAppService.scheduleMessage({
    channelId: 'channel-1',
    chatId: 'chat-1',
    phoneDigits: '5521999999999',
    scheduledAt: '2099-01-01T12:00:00.000Z',
    textContent: 'Olá',
  });

  assert.equal(scheduledId, 'scheduled-1');
  const rpcCall = mocks.rpc.mock.calls.find(([name]) => name === 'create_scheduled_message_for_chat');
  assert.equal(rpcCall?.[0], 'create_scheduled_message_for_chat');
  assert.equal(rpcCall?.[1]?.p_chat_id, 'chat-1');
  mocks.rpc.mockResolvedValue({ data: [], error: null });
});

test('aguarda a sessão antes de carregar listas e contagens agendadas', async () => {
  const sessionCallsBefore = mocks.waitForSupabaseSession.mock.calls.length;

  await Promise.all([
    commWhatsAppService.listScheduledMessages({ channelId: 'channel-1' }),
    commWhatsAppService.listScheduledSequences({ channelId: 'channel-1' }),
    commWhatsAppService.countScheduledMessages({ channelId: 'channel-1' }),
    commWhatsAppService.countScheduledSequences({ channelId: 'channel-1' }),
  ]);

  assert.equal(mocks.waitForSupabaseSession.mock.calls.length, sessionCallsBefore + 4);
});

test('repete uma leitura agendada após falhas transitórias até concluir', async () => {
  let attempts = 0;
  mocks.query.range.mockImplementation(async () => {
    attempts += 1;
    return attempts === 1
      ? { data: [], error: new Error('Falha de rede ao conectar com o Supabase') }
      : attempts === 2
        ? { data: [], error: new Error('Failed to fetch') }
      : { data: [], error: null };
  });

  await commWhatsAppService.listScheduledMessages({ channelId: 'channel-1' });

  assert.equal(attempts, 3);
  mocks.query.range.mockResolvedValue({ data: [], error: null });
});

test('repete uma leitura agendada quando o Supabase responde com erro temporário', async () => {
  let attempts = 0;
  mocks.query.range.mockImplementation(async () => {
    attempts += 1;
    return attempts === 1
      ? { data: [], error: { status: 503, message: 'Service Unavailable' } }
      : { data: [], error: null };
  });

  await commWhatsAppService.listScheduledMessages({ channelId: 'channel-1' });

  assert.equal(attempts, 2);
  mocks.query.range.mockResolvedValue({ data: [], error: null });
});

test('não repete falha permanente ao listar agendamentos', async () => {
  let attempts = 0;
  mocks.query.range.mockImplementation(async () => {
    attempts += 1;
    return { data: [], error: new Error('permission denied') };
  });

  await assert.rejects(
    () => commWhatsAppService.listScheduledMessages({ channelId: 'channel-1' }),
    /Nao foi possivel listar mensagens agendadas\./,
  );

  assert.equal(attempts, 1);
  mocks.query.range.mockResolvedValue({ data: [], error: null });
});

test('não repete a busca de uma mídia ausente e permite retry explícito', async () => {
  const mediaId = 'missing-media-cache-contract';
  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  const fetchMock = vi.fn(async () => {
    fetchCalls += 1;
    return new Response(
      JSON.stringify({ error: 'specified media not found' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  });
  globalThis.fetch = fetchMock;

  try {
    await assert.rejects(
      () => commWhatsAppService.resolveMediaObjectUrl({ mediaId }),
      /specified media not found/,
    );
    await assert.rejects(
      () => commWhatsAppService.resolveMediaObjectUrl({ mediaId }),
      /specified media not found/,
    );
    assert.equal(fetchCalls, 1);

    await assert.rejects(
      () => commWhatsAppService.resolveMediaObjectUrl({ mediaId, forceRefresh: true }),
      /specified media not found/,
    );
    assert.equal(fetchCalls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('repete a lista do Inbox quando a RPC sofre timeout transitório', async () => {
  let attempts = 0;
  const rpcCallsBefore = mocks.rpc.mock.calls.length;
  const chat = { id: 'chat-1', display_name: 'Contato', is_archived: false };
  mocks.rpc.mockImplementation(async () => {
    attempts += 1;
    return attempts === 1
      ? { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } }
      : { data: [chat], error: null };
  });

  const chats = await commWhatsAppService.listChats();
  const rpcCalls = mocks.rpc.mock.calls.slice(rpcCallsBefore);

  assert.deepEqual(chats, [chat]);
  assert.equal(attempts, 2);
  assert.equal(rpcCalls[0]?.[0], 'comm_whatsapp_list_chats_with_presence');
  assert.equal(rpcCalls[1]?.[0], 'comm_whatsapp_list_chats_with_presence');
  mocks.rpc.mockResolvedValue({ data: [], error: null });
});

test('recupera o nome do cadastro do grupo quando o chat está marcado só como Grupo', async () => {
  mocks.rpc.mockResolvedValue({
    data: [
      { id: 'group-1', is_group: true, display_name: 'GRUPO' },
      { id: 'group-2', is_group: true, display_name: 'Grupo salvo no chat' },
      { id: 'chat-1', is_group: false, display_name: 'Contato' },
    ],
    error: null,
  });
  mocks.groupQuery.overrideTypes.mockResolvedValue({
    data: [
      { chat_id: 'group-1', name: 'Equipe de Atendimento' },
      { chat_id: 'group-2', name: 'GRUPO' },
    ],
    error: null,
  });

  const chats = await commWhatsAppService.listChats();

  assert.equal(chats[0]?.display_name, 'Equipe de Atendimento');
  assert.equal(chats[1]?.display_name, 'Grupo salvo no chat');
  assert.equal(chats[2]?.display_name, 'Contato');
  mocks.rpc.mockResolvedValue({ data: [], error: null });
  mocks.groupQuery.overrideTypes.mockResolvedValue({ data: [], error: null });
});

test('repete a lista do Inbox quando o fetch rejeita por timeout', async () => {
  let attempts = 0;
  const chat = { id: 'chat-fetch-retry', display_name: 'Contato', is_archived: false };
  mocks.rpc.mockImplementation(async () => {
    attempts += 1;
    if (attempts === 1) {
      throw new Error('Falha de rede ao conectar com o Supabase. Tempo limite atingido apos 8s.');
    }

    return { data: [chat], error: null };
  });

  const chats = await commWhatsAppService.listChats();

  assert.deepEqual(chats, [chat]);
  assert.equal(attempts, 2);
  mocks.rpc.mockResolvedValue({ data: [], error: null });
});

test('tenta a RPC compatível quando a RPC principal rejeita por falha de rede', async () => {
  const rpcCallsBefore = mocks.rpc.mock.calls.length;
  const chat = { id: 'chat-fallback-fetch', display_name: 'Contato', is_archived: false };
  mocks.rpc.mockImplementation(async (rpcName) => {
    if (rpcName === 'comm_whatsapp_list_chats_with_presence') {
      throw new Error('Falha de rede ao conectar com o Supabase. Tempo limite atingido apos 8s.');
    }

    return { data: [chat], error: null };
  });

  const chats = await commWhatsAppService.listChats();
  const rpcCalls = mocks.rpc.mock.calls.slice(rpcCallsBefore);

  assert.deepEqual(chats, [chat]);
  assert.equal(
    rpcCalls.filter(([rpcName]) => rpcName === 'comm_whatsapp_list_chats_with_groups').length,
    1,
  );
  mocks.rpc.mockResolvedValue({ data: [], error: null });
});

test('usa a RPC compatível quando a RPC de presença não existe', async () => {
  mocks.rpc.mockImplementation(async (rpcName) => rpcName === 'comm_whatsapp_list_chats_with_presence'
    ? { data: null, error: { code: 'PGRST202', message: 'function does not exist' } }
    : { data: [{ id: 'chat-2' }], error: null });

  const chats = await commWhatsAppService.listChats();

  assert.deepEqual(chats, [{ id: 'chat-2' }]);
  assert.equal(mocks.rpc.mock.calls.length >= 2, true);
  const lastRpcCall = mocks.rpc.mock.calls[mocks.rpc.mock.calls.length - 1];
  assert.equal(lastRpcCall?.[0], 'comm_whatsapp_list_chats_with_groups');
  mocks.rpc.mockResolvedValue({ data: [], error: null });
});
