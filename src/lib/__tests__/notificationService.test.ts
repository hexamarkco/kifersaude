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
    on: TestMock<[], Subscription>;
    subscribe: TestMock<[], Subscription>;
  };
  type Query = {
    select: TestMock<[], Query>;
    eq: TestMock<[], Query>;
    order: TestMock<[], Promise<{ data: unknown[]; error: null }>>;
  };
  const createMock = <Args extends unknown[], Result>() => vi.fn() as unknown as TestMock<Args, Result>;

  const channelNames: string[] = [];
  const getOperationalState = createMock<[], Promise<{ channel: { id: string } } | null>>();
  const getUnreadCount = createMock<[], Promise<number>>();
  getUnreadCount.mockResolvedValue(0);
  const removeChannel = createMock<[Subscription], void>();
  const channel = createMock<[string], Subscription>();
  channel.mockImplementation((name) => {
    channelNames.push(name);
    const subscription = {} as Subscription;
    subscription.on = createMock<[], Subscription>();
    subscription.subscribe = createMock<[], Subscription>();
    subscription.on.mockReturnValue(subscription);
    subscription.subscribe.mockReturnValue(subscription);
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
