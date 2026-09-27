import assert from 'node:assert/strict';
import { act, useState } from 'react';
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

const noopMessageChange = vi.fn() as unknown as MockFunction;

const RealtimeHarness = () => {
  const state = useCommWhatsAppMessageRealtime('chat-1', noopMessageChange);

  return (
    <div>
      <output data-testid="ready-chat-id">{state.readyChatId ?? ''}</output>
      <output data-testid="healthy">{String(state.isRealtimeHealthy)}</output>
    </div>
  );
};

const firstChangingMessageChange = vi.fn() as unknown as MockFunction;
const secondChangingMessageChange = vi.fn() as unknown as MockFunction;

const HandlerChangingRealtimeHarness = () => {
  const [handlerVersion, setHandlerVersion] = useState(0);
  const onMessageChange = (payload: unknown) => {
    if (handlerVersion === 0) {
      firstChangingMessageChange(payload);
      return;
    }

    secondChangingMessageChange(payload);
  };

  useCommWhatsAppMessageRealtime('chat-1', onMessageChange);

  return <button type="button" data-testid="change-handler" onClick={() => setHandlerVersion(1)}>Trocar callback</button>;
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

test('ignora mensagem atrasada depois que a conversa é desmontada', () => {
  mocks.channel.mockClear();
  mocks.removeChannel.mockClear();
  mocks.subscription.on.mockClear();
  mocks.subscription.subscribe.mockClear();
  noopMessageChange.mockClear();

  const view = render(<RealtimeHarness />);
  const messageCallback = mocks.subscription.on.mock.calls[0]?.[2] as ((payload: unknown) => void) | undefined;
  const payload = { eventType: 'INSERT', new: { id: 'message-1' } };

  assert.equal(typeof messageCallback, 'function');
  act(() => messageCallback?.(payload));
  assert.equal(noopMessageChange.mock.calls.length, 1);

  view.unmount();
  act(() => messageCallback?.(payload));
  assert.equal(noopMessageChange.mock.calls.length, 1);
  assert.equal(mocks.removeChannel.mock.calls.length, 1);
});

test('mantém o canal ao trocar o callback durante uma renderização', () => {
  mocks.channel.mockClear();
  mocks.removeChannel.mockClear();
  mocks.subscription.on.mockClear();
  mocks.subscription.subscribe.mockClear();
  firstChangingMessageChange.mockClear();
  secondChangingMessageChange.mockClear();

  const view = render(<HandlerChangingRealtimeHarness />);
  const button = view.container.querySelector('[data-testid="change-handler"]');

  assert.equal(mocks.channel.mock.calls.length, 1);
  assert.ok(button);

  act(() => {
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  assert.equal(mocks.channel.mock.calls.length, 1);
  assert.equal(mocks.removeChannel.mock.calls.length, 0);

  const messageCallback = mocks.subscription.on.mock.calls[0]?.[2] as ((payload: unknown) => void) | undefined;
  const payload = { eventType: 'INSERT', new: { id: 'message-2' } };
  act(() => messageCallback?.(payload));

  assert.equal(firstChangingMessageChange.mock.calls.length, 0);
  assert.equal(secondChangingMessageChange.mock.calls.length, 1);
  view.unmount();
});
