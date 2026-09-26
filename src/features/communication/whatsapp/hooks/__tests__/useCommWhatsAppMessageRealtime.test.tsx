import assert from 'node:assert/strict';
import { act } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import { useCommWhatsAppMessageRealtime } from '../useCommWhatsAppMessageRealtime';

type MockFunction = {
  (...args: unknown[]): unknown;
  mock: { calls: unknown[][] };
  mockClear: () => void;
  mockReturnValue: (value: unknown) => MockFunction;
};

const mocks = vi.hoisted(() => {
  const createMock = () => vi.fn() as unknown as MockFunction;
  const subscription = {
    on: createMock(),
    subscribe: createMock(),
  };
  subscription.on.mockReturnValue(subscription);
  subscription.subscribe.mockReturnValue(subscription);

  return {
    channel: createMock(),
    removeChannel: createMock(),
    subscription,
  };
});
mocks.channel.mockReturnValue(mocks.subscription);

vi.mock('../../../../../infrastructure/supabase', () => ({
  databaseClient: {
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
  },
}));

const noopMessageChange = vi.fn();

const RealtimeHarness = () => {
  const state = useCommWhatsAppMessageRealtime('chat-1', noopMessageChange);

  return (
    <div>
      <output data-testid="ready-chat-id">{state.readyChatId ?? ''}</output>
      <output data-testid="healthy">{String(state.isRealtimeHealthy)}</output>
    </div>
  );
};

test('deduplica falhas do realtime, recupera após reconexão e ignora callbacks encerrados', () => {
  mocks.channel.mockClear();
  mocks.removeChannel.mockClear();
  mocks.subscription.on.mockClear();
  mocks.subscription.subscribe.mockClear();

  const warnings: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };
  const view = render(<RealtimeHarness />);
  const statusCallback = mocks.subscription.subscribe.mock.calls[0]?.[0] as ((status: string) => void) | undefined;

  assert.equal(typeof statusCallback, 'function');

  act(() => {
    statusCallback?.('CLOSED');
    statusCallback?.('TIMED_OUT');
  });

  assert.equal(view.container.querySelector('[data-testid="ready-chat-id"]')?.textContent, 'chat-1');
  assert.equal(view.container.querySelector('[data-testid="healthy"]')?.textContent, 'false');
  assert.equal(warnings.length, 1);

  act(() => {
    statusCallback?.('SUBSCRIBED');
    statusCallback?.('CHANNEL_ERROR');
    statusCallback?.('CLOSED');
  });

  assert.equal(view.container.querySelector('[data-testid="healthy"]')?.textContent, 'false');
  assert.equal(warnings.length, 2);

  view.unmount();
  act(() => {
    statusCallback?.('TIMED_OUT');
  });

  assert.equal(warnings.length, 2);
  console.warn = originalWarn;
});
