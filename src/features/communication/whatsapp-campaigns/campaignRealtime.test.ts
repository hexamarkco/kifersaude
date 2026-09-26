import assert from 'node:assert/strict';
import { test, vi } from 'vitest';

type MockFunction<Args extends unknown[], Result> = {
  (...args: Args): Result;
  mock: { calls: Args[] };
  mockReturnValue(value: Result): MockFunction<Args, Result>;
};

type Channel = {
  on: MockFunction<[string, Record<string, unknown>, (payload?: unknown) => void], Channel>;
  subscribe: MockFunction<[(status?: string) => void], Channel>;
};

const mocks = vi.hoisted(() => {
  const createMock = <Args extends unknown[], Result>() => (
    vi.fn() as unknown as MockFunction<Args, Result>
  );
  const subscription = {} as Channel;
  subscription.on = createMock<[string, Record<string, unknown>, (payload?: unknown) => void], Channel>();
  subscription.subscribe = createMock<[(status?: string) => void], Channel>();
  subscription.on.mockReturnValue(subscription);
  subscription.subscribe.mockReturnValue(subscription);

  return {
    channel: createMock<[string], Channel>(),
    removeChannel: createMock<[Channel], void>(),
    subscription,
  };
});

mocks.channel.mockReturnValue(mocks.subscription);

vi.mock('../../../infrastructure/supabase', () => ({
  databaseClient: {
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
  },
}));

import {
  subscribeToCampaignChanges,
  subscribeToCampaignListChanges,
} from './campaignRealtime';

const resetMocks = () => {
  mocks.channel.mock.calls.splice(0);
  mocks.removeChannel.mock.calls.splice(0);
  mocks.subscription.on.mock.calls.splice(0);
  mocks.subscription.subscribe.mock.calls.splice(0);
};

test('ignora eventos tardios da lista de campanhas depois do unsubscribe', () => {
  resetMocks();
  let changes = 0;
  const unsubscribe = subscribeToCampaignListChanges(() => {
    changes += 1;
  });
  const callbacks = mocks.subscription.on.mock.calls.map(([, , callback]) => callback);

  callbacks[0]?.();
  assert.equal(changes, 1);

  unsubscribe();
  callbacks[1]?.();
  assert.equal(changes, 1);
  assert.equal(mocks.removeChannel.mock.calls.length, 1);
});

test('ignora atualização e status tardios do detalhe da campanha', () => {
  resetMocks();
  let campaignChanges = 0;
  let statusChanges = 0;
  const unsubscribe = subscribeToCampaignChanges('campaign-1', {
    onCampaign: () => {
      campaignChanges += 1;
    },
    onStatus: () => {
      statusChanges += 1;
    },
  });
  const campaignCallback = mocks.subscription.on.mock.calls[0]?.[2];
  const statusCallback = mocks.subscription.subscribe.mock.calls[0]?.[0];

  statusCallback?.('SUBSCRIBED');
  campaignCallback?.({ new: { id: 'campaign-1' } });
  assert.deepEqual([campaignChanges, statusChanges], [1, 1]);

  unsubscribe();
  statusCallback?.('CLOSED');
  campaignCallback?.({ new: { id: 'campaign-1' } });
  assert.deepEqual([campaignChanges, statusChanges], [1, 1]);
});
