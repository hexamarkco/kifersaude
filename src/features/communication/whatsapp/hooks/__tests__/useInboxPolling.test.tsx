import assert from 'node:assert/strict';
import { act } from 'react';
import { test } from 'vitest';

import { render } from '../../../../../testing-library/react';
import { useInboxPolling } from '../useInboxPolling';

type PollingOptions = Parameters<typeof useInboxPolling>[0];

const createOptions = (overrides: Partial<PollingOptions> = {}) => {
  const refs = {
    chatPollBackoff: { current: 0 },
    chatPollIdleCycles: { current: 0 },
    isChannelConnected: { current: true },
    isMessageRealtimeHealthy: { current: false },
    latestChatsLoadedAt: { current: 0 },
    selectedChatId: { current: 'chat-1' },
  };
  const calls = {
    chats: 0,
    archivedCount: 0,
    operationalState: 0,
    messages: [] as Array<'poll'>,
  };
  const options = {
    pollingEnabled: true,
    loading: false,
    selectedChatId: 'chat-1',
    loadingOlderMessages: false,
    chatPollBackoffRef: refs.chatPollBackoff,
    chatPollIdleCyclesRef: refs.chatPollIdleCycles,
    isChannelConnectedRef: refs.isChannelConnected,
    isMessageRealtimeHealthyRef: refs.isMessageRealtimeHealthy,
    latestChatsLoadedAtRef: refs.latestChatsLoadedAt,
    selectedChatIdRef: refs.selectedChatId,
    loadChats: async () => { calls.chats += 1; },
    refreshArchivedChatsCount: async () => { calls.archivedCount += 1; },
    loadOperationalState: async () => { calls.operationalState += 1; },
    getSelectedChatSnapshot: () => null,
    loadMessages: async (_target: Parameters<PollingOptions['loadMessages']>[0], reason: 'poll') => { calls.messages.push(reason); },
    ...overrides,
  };

  return { options, calls, refs };
};

test('poll de mensagens usa fallback rápido e depois intervalo de segurança', () => {
  const timers = installFakeTimers();
  const { options, calls, refs } = createOptions();
  const view = render(<PollingHarness options={options} />);

  try {
    act(() => timers.advanceBy(5000));
    assert.deepEqual(calls.messages, ['poll']);

    refs.isMessageRealtimeHealthy.current = true;
    act(() => timers.advanceBy(4999));
    assert.equal(calls.messages.length, 1);
    act(() => timers.advanceBy(1));
    assert.equal(calls.messages.length, 2);

    act(() => timers.advanceBy(19_999));
    assert.equal(calls.messages.length, 2);
    act(() => timers.advanceBy(1));
    assert.equal(calls.messages.length, 3);
  } finally {
    view.unmount();
    timers.restore();
  }
});

test('backoff de chats é relido a cada ciclo e respeita o limite de 60 segundos', () => {
  const timers = installFakeTimers();
  const { options, calls, refs } = createOptions({ selectedChatId: null });
  const view = render(<PollingHarness options={options} />);

  try {
    refs.chatPollBackoff.current = 10;
    act(() => timers.advanceBy(8000));
    assert.equal(calls.chats, 1);

    act(() => timers.advanceBy(59_999));
    assert.equal(calls.chats, 1);
    act(() => timers.advanceBy(1));
    assert.equal(calls.chats, 2);
  } finally {
    view.unmount();
    timers.restore();
  }
});

test('polling desativado não agenda consultas e desmontar cancela os timers ativos', () => {
  const pausedTimers = installFakeTimers();
  const paused = createOptions({ pollingEnabled: false });
  const pausedView = render(<PollingHarness options={paused.options} />);

  try {
    act(() => pausedTimers.advanceBy(60_000));
    assert.equal(paused.calls.chats, 0);
    assert.equal(paused.calls.messages.length, 0);
    assert.equal(pausedTimers.pendingCount(), 0);
  } finally {
    pausedView.unmount();
    pausedTimers.restore();
  }

  const activeTimers = installFakeTimers();
  const active = createOptions();
  const activeView = render(<PollingHarness options={active.options} />);
  activeView.unmount();
  assert.equal(activeTimers.pendingCount(), 0);
  activeTimers.restore();
});

test('refresh ao retornar à janela respeita bootstrap, throttle e paginação antiga', () => {
  const recentTimers = installFakeTimers();
  const recent = createOptions();
  recent.refs.latestChatsLoadedAt.current = Date.now() - 2_000;
  const recentView = render(<PollingHarness options={recent.options} />);

  try {
    assert.equal(recent.calls.chats, 0);
    assert.equal(recent.calls.operationalState, 0);
    assert.equal(recent.calls.messages.length, 0);
  } finally {
    recentView.unmount();
    recentTimers.restore();
  }

  const activeTimers = installFakeTimers();
  const active = createOptions({ loadingOlderMessages: true });
  active.refs.latestChatsLoadedAt.current = Date.now() - 10_000;
  const activeView = render(<PollingHarness options={active.options} />);

  try {
    assert.equal(active.calls.chats, 1);
    assert.equal(active.calls.operationalState, 1);
    assert.equal(active.calls.messages.length, 0);
  } finally {
    activeView.unmount();
    activeTimers.restore();
  }
});

const PollingHarness = ({ options }: { options: PollingOptions }) => {
  useInboxPolling(options);
  return null;
};

const installFakeTimers = () => {
  type ScheduledTimer = { dueAt: number; callback: () => void };
  const originalSetTimeout = window.setTimeout;
  const originalClearTimeout = window.clearTimeout;
  const scheduled = new Map<number, ScheduledTimer>();
  let nextId = 0;
  let now = 0;

  window.setTimeout = ((callback: TimerHandler, delay = 0) => {
    if (typeof callback !== 'function') throw new TypeError('Timer callback must be a function');
    const id = ++nextId;
    scheduled.set(id, { dueAt: now + Math.max(0, Number(delay) || 0), callback: callback as () => void });
    return id;
  }) as typeof window.setTimeout;
  window.clearTimeout = ((id?: number) => {
    if (id !== undefined) scheduled.delete(id);
  }) as typeof window.clearTimeout;

  return {
    advanceBy: (durationMs: number) => {
      const targetTime = now + durationMs;
      while (true) {
        const dueTimer = Array.from(scheduled.entries())
          .filter(([, timer]) => timer.dueAt <= targetTime)
          .sort(([, left], [, right]) => left.dueAt - right.dueAt)[0];
        if (!dueTimer) break;

        const [id, timer] = dueTimer;
        scheduled.delete(id);
        now = timer.dueAt;
        timer.callback();
      }
      now = targetTime;
    },
    pendingCount: () => scheduled.size,
    restore: () => {
      window.setTimeout = originalSetTimeout;
      window.clearTimeout = originalClearTimeout;
    },
  };
};
