import assert from 'node:assert/strict';
import { test, vi } from 'vitest';

type MockFunction<Args extends unknown[], Result> = {
  (...args: Args): Result;
  mock: { calls: Args[] };
  mockReturnValue(value: Result): MockFunction<Args, Result>;
};

type Subscription = {
  on: MockFunction<[string, Record<string, unknown>, () => void], Subscription>;
  subscribe: MockFunction<[], Subscription>;
};

const mocks = vi.hoisted(() => {
  const createMock = <Args extends unknown[], Result>() => (
    vi.fn() as unknown as MockFunction<Args, Result>
  );
  const subscription = {} as Subscription;
  subscription.on = createMock<[string, Record<string, unknown>, () => void], Subscription>();
  subscription.subscribe = createMock<[], Subscription>();
  subscription.on.mockReturnValue(subscription);
  subscription.subscribe.mockReturnValue(subscription);

  return {
    channel: createMock<[string], Subscription>(),
    removeChannel: createMock<[Subscription], void>(),
    subscription,
  };
});

mocks.channel.mockReturnValue(mocks.subscription);

vi.mock('../../../../../infrastructure/supabase', () => ({
  databaseClient: {
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
  },
  fetchAllPages: vi.fn(),
}));

import { subscribeToInboxReminders } from '../inboxRepository';

const resetMocks = () => {
  mocks.channel.mock.calls.length = 0;
  mocks.removeChannel.mock.calls.length = 0;
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

test('não cria assinatura quando o chat não tem lead nem contrato', () => {
  resetMocks();
  const unsubscribe = subscribeToInboxReminders(' ', [], vi.fn());

  assert.equal(mocks.channel.mock.calls.length, 0);
  unsubscribe();
  assert.equal(mocks.removeChannel.mock.calls.length, 0);
});
