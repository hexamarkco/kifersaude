import assert from 'node:assert/strict';
import { test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  type TestMock<Args extends unknown[], Result> = ((...args: Args) => Result) & {
    mock: { calls: Args[] };
    mockImplementation: (implementation: (...args: Args) => Result) => TestMock<Args, Result>;
    mockReturnValue: (value: Result) => TestMock<Args, Result>;
    mockReturnValueOnce: (value: Result) => TestMock<Args, Result>;
    mockResolvedValue: (value: Awaited<Result>) => TestMock<Args, Result>;
  };
  type Subscription = {
    on: TestMock<[string, Record<string, unknown>, (payload?: unknown) => void], Subscription>;
    subscribe: TestMock<[callback?: (status: string) => void], Subscription>;
  };
  type Query = {
    select: TestMock<[], Query>;
    eq: TestMock<[], Query>;
    order: TestMock<[], Promise<{ data: unknown[]; error: null }>>;
  };
  const createMock = <Args extends unknown[], Result>() => vi.fn() as unknown as TestMock<Args, Result>;

  const channelNames: string[] = [];
  const subscriptions: Subscription[] = [];
  const getOperationalState = createMock<[], Promise<{ channel: { id: string } } | null>>();
  const getUnreadCount = createMock<[], Promise<number>>();
  getUnreadCount.mockResolvedValue(0);
  const removeChannel = createMock<[Subscription], void>();
  const channel = createMock<[string], Subscription>();
  channel.mockImplementation((name) => {
    channelNames.push(name);
    const subscription = {} as Subscription;
    subscription.on = createMock<[string, Record<string, unknown>, (payload?: unknown) => void], Subscription>();
    subscription.subscribe = createMock<[callback?: (status: string) => void], Subscription>();
    subscription.on.mockReturnValue(subscription);
    subscription.subscribe.mockReturnValue(subscription);
    subscriptions.push(subscription);
    return subscription;
  });
  const query: Query = {
    select: createMock<[], Query>(),
    eq: createMock<[], Query>(),
    order: createMock<[], Promise<{ data: unknown[]; error: null }>>(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockResolvedValue({ data: [], error: null });

  return {
    channelNames,
    subscriptions,
    channel,
    getOperationalState,
    getUnreadCount,
    removeChannel,
    query,
  };
});

vi.mock('../../infrastructure/supabase', () => ({
  supabase: {
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
    from: vi.fn(() => mocks.query),
  },
}));

vi.mock('../../features/communication/whatsapp', () => ({
  whatsappConversationsRepository: {
    getOperationalState: mocks.getOperationalState,
    getUnreadCount: mocks.getUnreadCount,
  },
}));

import { NotificationService } from '../notificationService';

test('não cria assinatura do Inbox depois que o serviço é interrompido', async () => {
  let resolveOperationalState: (value: { channel: { id: string } }) => void = () => undefined;
  mocks.getOperationalState.mockReturnValueOnce(new Promise((resolve) => {
    resolveOperationalState = resolve;
  }));

  const service = new NotificationService();
  service.start(60_000);
  service.stop();

  resolveOperationalState({ channel: { id: 'channel-1' } });
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(mocks.channelNames.includes('comm-whatsapp-inbox-notifications'), false);
  assert.equal(mocks.removeChannel.mock.calls.length, 1);
});

test('ignora eventos de lead e inbox depois que o serviço é interrompido', async () => {
  mocks.channelNames.splice(0);
  mocks.subscriptions.splice(0);
  mocks.getOperationalState.mockResolvedValue({ channel: { id: 'channel-1' } });

  let leadNotifications = 0;
  let inboxNotifications = 0;
  const service = new NotificationService();
  const unsubscribeLead = service.subscribeToLeads(() => {
    leadNotifications += 1;
  });
  const unsubscribeInbox = service.subscribeToInboxMessages(() => {
    inboxNotifications += 1;
  });

  service.start(60_000);
  await Promise.resolve();
  await Promise.resolve();
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0));

  const leadCallback = mocks.subscriptions[0]?.on.mock.calls[0]?.[2];
  const inboxCallback = mocks.subscriptions[1]?.on.mock.calls[0]?.[2];
  assert.equal(typeof leadCallback, 'function');
  assert.equal(typeof inboxCallback, 'function');

  service.stop();
  leadCallback?.({ new: { id: 'lead-1' } });
  inboxCallback?.({
    eventType: 'INSERT',
    new: {
      id: 'chat-1',
      last_message_at: new Date().toISOString(),
      last_message_direction: 'inbound',
      last_message_text: 'Mensagem atrasada',
      unread_count: 1,
      manual_unread: false,
      deleted_at: null,
      merged_into_chat_id: null,
      is_archived: false,
      is_muted: false,
      display_name: 'Contato',
    },
    old: {},
  });

  assert.equal(leadNotifications, 0);
  assert.equal(inboxNotifications, 0);

  unsubscribeLead();
  unsubscribeInbox();
});
