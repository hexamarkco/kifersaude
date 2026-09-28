import assert from 'node:assert/strict';
import { act, type SetStateAction } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../../domain/types';
import { useInboxMessageStatusRefresh } from '../useInboxMessageStatusRefresh';

type MockFunction = ((...args: unknown[]) => unknown) & {
  mockReset: () => MockFunction;
  mockResolvedValue: (value: unknown) => MockFunction;
  mockReturnValueOnce: (value: unknown) => MockFunction;
  mock: { calls: unknown[][] };
};

const mocks = vi.hoisted(() => ({
  refreshStatuses: vi.fn() as unknown as MockFunction,
}));

vi.mock('../../data', () => ({
  whatsappMessagesRepository: { refreshStatuses: mocks.refreshStatuses },
}));

type StatusRefresh = ReturnType<typeof useInboxMessageStatusRefresh>;
type StatusRefreshOptions = Parameters<typeof useInboxMessageStatusRefresh>[0];

const Harness = ({ options, capture }: {
  options: StatusRefreshOptions;
  capture: (controller: StatusRefresh) => void;
}) => {
  capture(useInboxMessageStatusRefresh(options));
  return null;
};

const createChat = (): CommWhatsAppChat => ({
  id: 'chat-1',
  channel_id: 'channel-1',
  external_chat_id: 'contact-1@s.whatsapp.net',
  is_group: false,
  phone_number: '+55 11 99999-9999',
  phone_digits: '5511999999999',
  display_name: 'Contato',
  merged_into_chat_id: null,
  lead_link_source: null,
  lead_linked_at: null,
  lead_linked_by: null,
  auto_link_blocked: false,
  identity_conflict: false,
  is_archived: false,
  is_muted: false,
  is_pinned: false,
  manual_unread: false,
  last_message_direction: 'outbound',
  unread_count: 0,
  status: 'open',
  autonomous_attendance_status: 'inactive',
  created_at: '2026-09-28T12:00:00.000Z',
  updated_at: '2026-09-28T12:00:00.000Z',
});

const createMessage = (id: string, externalMessageId: string, status = 'sent'): CommWhatsAppMessage => ({
  id,
  chat_id: 'chat-1',
  channel_id: 'channel-1',
  direction: 'outbound',
  message_type: 'text',
  delivery_status: status,
  message_at: '2026-09-28T12:00:00.000Z',
  external_message_id: externalMessageId,
  media_url: null,
  metadata: {},
  created_at: '2026-09-28T12:00:00.000Z',
});

const applyStateUpdate = <Value,>(update: SetStateAction<Value>, previous: Value) => (
  typeof update === 'function' ? (update as (value: Value) => Value)(previous) : update
);

const createOptions = () => {
  const chat = createChat();
  const localMessage = createMessage('local-1', 'external-1');
  const state = {
    localMessages: [localMessage],
    chatReloads: 0,
    messageReloads: [] as Array<{ chat: CommWhatsAppChat | null; reason: string | undefined }>,
  };
  const refs: StatusRefreshOptions['refs'] = {
    latestMessagesRef: { current: [] },
    loadChatsRef: { current: () => { state.chatReloads += 1; } },
    loadMessagesRef: { current: (selectedChat, reason) => { state.messageReloads.push({ chat: selectedChat, reason }); } },
  };
  const options: StatusRefreshOptions = {
    refs,
    pollingEnabled: false,
    selectedChatId: null,
    selectedChat: null,
    visibleMessages: [],
    refreshableOutboundStatuses: new Set(['pending', 'queued', 'sending', 'sent', 'delivered']),
    setLocalOutgoingMessages: (update) => {
      state.localMessages = applyStateUpdate(update, state.localMessages);
    },
  };

  return { options, refs, state, chat, localMessage };
};

const runWithFakeTimers = async (action: (context: ReturnType<typeof createOptions>, controller: StatusRefresh) => Promise<void>) => {
  vi.useFakeTimers();
  mocks.refreshStatuses.mockReset();
  const context = createOptions();
  let controller!: StatusRefresh;
  const view = render(<Harness options={context.options} capture={(value) => { controller = value; }} />);

  try {
    await action(context, controller);
  } finally {
    view.unmount();
    vi.clearAllTimers();
    vi.restoreAllMocks();
    vi.useRealTimers();
  }
};

test('deduplica IDs, limita lote a 20 e reconcilia status local após a primeira espera', async () => {
  await runWithFakeTimers(async (context, controller) => {
    mocks.refreshStatuses.mockResolvedValue({
      refreshed: [{ external_message_id: 'external-1', delivery_status: 'delivered' }],
      updated: 1,
    });
    const messageIds = Array.from({ length: 22 }, (_, index) => `external-${index}`);

    act(() => {
      controller.scheduleMessageStatusRefresh({
        chat: context.chat,
        externalMessageIds: [' external-1 ', '', 'external-1', ...messageIds],
      });
    });
    assert.equal(mocks.refreshStatuses.mock.calls.length, 0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    assert.deepEqual(mocks.refreshStatuses.mock.calls[0], [{
      chatId: 'contact-1@s.whatsapp.net',
      externalMessageIds: ['external-1', ...messageIds.filter((id) => id !== 'external-1').slice(0, 19)],
      limit: 20,
    }]);
    assert.equal(context.state.localMessages[0]?.delivery_status, 'delivered');
    assert.deepEqual(context.state.messageReloads, [{ chat: context.chat, reason: 'send' }]);
    assert.equal(context.state.chatReloads, 1);
  });
});

test('pula a consulta se realtime já resolveu a mensagem antes do primeiro tick', async () => {
  await runWithFakeTimers(async (context, controller) => {
    context.refs.latestMessagesRef.current = [createMessage('server-1', 'external-1', 'read')];
    mocks.refreshStatuses.mockResolvedValue({ refreshed: [], updated: 0 });

    act(() => {
      controller.scheduleMessageStatusRefresh({ chat: context.chat, externalMessageIds: ['external-1'] });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300_000);
    });

    assert.equal(mocks.refreshStatuses.mock.calls.length, 0);
  });
});

test('não sobrepõe tentativas e volta a tentar após falha da tentativa anterior', async () => {
  await runWithFakeTimers(async (context, controller) => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let rejectFirst!: (error: Error) => void;
    const failedRequest = new Promise<never>((_resolve, reject) => {
      rejectFirst = reject;
    });
    mocks.refreshStatuses
      .mockReturnValueOnce(failedRequest)
      .mockResolvedValue({ refreshed: [], updated: 0 });

    act(() => {
      controller.scheduleMessageStatusRefresh({ chat: context.chat, externalMessageIds: ['external-1'] });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    assert.equal(mocks.refreshStatuses.mock.calls.length, 1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    assert.equal(mocks.refreshStatuses.mock.calls.length, 1);

    rejectFirst(new Error('offline'));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    assert.equal(mocks.refreshStatuses.mock.calls.length, 2);
    assert.equal(errorSpy.mock.calls.length, 1);
  });
});

test('descobre status pendentes no chat visível e agenda somente os 10 mais recentes', async () => {
  vi.useFakeTimers();
  mocks.refreshStatuses.mockReset().mockResolvedValue({ refreshed: [], updated: 0 });
  const context = createOptions();
  context.options.pollingEnabled = true;
  context.options.selectedChatId = context.chat.id;
  context.options.selectedChat = context.chat;
  context.options.visibleMessages = Array.from({ length: 12 }, (_, index) => (
    createMessage(`server-${index}`, `external-${index}`)
  ));

  let controller!: StatusRefresh;
  const view = render(<Harness options={context.options} capture={(value) => { controller = value; }} />);

  try {
    assert.equal(vi.getTimerCount(), 8);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    assert.deepEqual(mocks.refreshStatuses.mock.calls[0], [{
      chatId: context.chat.external_chat_id,
      externalMessageIds: Array.from({ length: 10 }, (_, index) => `external-${index + 2}`),
      limit: 10,
    }]);
    assert.equal(typeof controller.scheduleMessageStatusRefresh, 'function');
  } finally {
    view.unmount();
    vi.clearAllTimers();
    vi.restoreAllMocks();
    vi.useRealTimers();
  }
});

test('cancelamento limpa a fila e invalida resposta que ainda estava em voo', async () => {
  await runWithFakeTimers(async (context, controller) => {
    let resolveRequest!: (result: { refreshed: Array<{ external_message_id: string; delivery_status: string }>; updated: number }) => void;
    const pendingRequest = new Promise<{ refreshed: Array<{ external_message_id: string; delivery_status: string }>; updated: number }>((resolve) => {
      resolveRequest = resolve;
    });
    mocks.refreshStatuses.mockReturnValueOnce(pendingRequest);

    act(() => {
      controller.scheduleMessageStatusRefresh({ chat: context.chat, externalMessageIds: ['external-1'] });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    assert.equal(mocks.refreshStatuses.mock.calls.length, 1);

    act(() => controller.clearScheduledMessageStatusRefreshes());
    resolveRequest({
      refreshed: [{ external_message_id: 'external-1', delivery_status: 'delivered' }],
      updated: 1,
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(300_000);
    });

    assert.deepEqual(context.state.localMessages, [context.localMessage]);
    assert.deepEqual(context.state.messageReloads, []);
    assert.equal(context.state.chatReloads, 0);
    assert.equal(controller.lastPendingStatusRefreshKeyRef.current, '');
    assert.equal(vi.getTimerCount(), 0);
  });
});
