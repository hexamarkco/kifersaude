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
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.range.mockResolvedValue({ data: [], error: null });

  const from = createMock<[string], Query>();
  const invoke = createMock<[
    string,
    { body: { action: string; phoneNumbers: string[]; forceSync: boolean } },
  ], Promise<{ data: unknown; error: unknown; response: Response | null }>>();
  const getSupabaseErrorMessage = createMock<[unknown, string], Promise<string>>();
  const isSupabaseFunctionFetchError = createMock<[unknown], boolean>();
  const waitForSupabaseSession = createMock<[{ errorMessage: string }], Promise<void>>();

  from.mockReturnValue(query);
  getSupabaseErrorMessage.mockImplementation(async (_error, fallback) => fallback);
  isSupabaseFunctionFetchError.mockReturnValue(false);
  waitForSupabaseSession.mockResolvedValue(undefined);

  return {
    from,
    getSupabaseErrorMessage,
    invoke,
    isSupabaseFunctionFetchError,
    query,
    waitForSupabaseSession,
  };
});

vi.mock('../../../../../infrastructure/supabase', () => ({
  supabase: {
    from: mocks.from,
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
  assert.equal(scheduledSelects.every((fields) => fields.includes('lead_id')), true);
});
