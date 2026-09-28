import assert from 'node:assert/strict';
import { act, type SetStateAction } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../../domain/types';
import { useInboxMessageLoader } from '../useInboxMessageLoader';

type MockFunction = ((...args: unknown[]) => unknown) & {
  mockReset: () => MockFunction;
  mockResolvedValue: (value: unknown) => MockFunction;
  mockImplementationOnce: (implementation: (...args: unknown[]) => unknown) => MockFunction;
  mock: { calls: unknown[][] };
};

const mocks = vi.hoisted(() => {
  const createMock = () => vi.fn() as unknown as MockFunction;
  return {
    getThread: createMock(),
    listPage: createMock(),
    toastError: createMock(),
  };
});

vi.mock('../../data', () => ({
  whatsappConversationsRepository: { getThread: mocks.getThread },
  whatsappMessagesRepository: { listPage: mocks.listPage },
}));

vi.mock('../../../../lib/toast', () => ({
  toast: { error: mocks.toastError },
}));

type Loader = ReturnType<typeof useInboxMessageLoader>;
type LoaderOptions = Parameters<typeof useInboxMessageLoader>[0];

const Harness = ({ options, capture }: { options: LoaderOptions; capture: (loader: Loader) => void }) => {
  capture(useInboxMessageLoader(options));
  return null;
};

const createChat = (id = 'chat-1'): CommWhatsAppChat => ({
  id,
  channel_id: 'channel-1',
  external_chat_id: `${id}@s.whatsapp.net`,
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

const createMessage = (id: string, chatId = 'chat-1'): CommWhatsAppMessage => ({
  id,
  chat_id: chatId,
  channel_id: 'channel-1',
  direction: 'outbound',
  message_type: 'image',
  delivery_status: 'sent',
  message_at: '2026-09-28T12:00:00.000Z',
  external_message_id: null,
  media_url: null,
  metadata: {},
  created_at: '2026-09-28T12:00:00.000Z',
});

const applyStateUpdate = <Value,>(update: SetStateAction<Value>, previous: Value) => (
  typeof update === 'function' ? (update as (value: Value) => Value)(previous) : update
);

const createOptions = () => {
  const currentMessages: { value: CommWhatsAppMessage[] } = { value: [] };
  const loadingStates: boolean[] = [];
  const olderMessageStates: boolean[] = [];
  const loadErrors: Array<string | null> = [];
  const reconcileChatIds: Array<string | null> = [];
  const chatUpserts: CommWhatsAppChat[] = [];
  const reconciliations: Array<{ chatId: string; messages: CommWhatsAppMessage[] }> = [];
  const cache = new Map<string, { messages: CommWhatsAppMessage[]; signature: string; hasOlderMessages: boolean }>();
  const options: LoaderOptions = {
    selectedChatIdRef: { current: 'chat-1' },
    messagesRequestIdRef: { current: 0 },
    latestMessagesRef: { current: [] },
    messagesSignatureRef: { current: '' },
    messagesCacheByChatIdRef: { current: cache },
    pendingScrollModeRef: { current: null },
    pendingScrollTopRef: { current: null },
    pendingScrollHeightRef: { current: null },
    isNearBottomRef: { current: true },
    messagesContainerRef: { current: null },
    setMessages: (next) => {
      currentMessages.value = typeof next === 'function' ? next(currentMessages.value) : next;
    },
    setMessageLoadError: (error) => {
      loadErrors.push(applyStateUpdate(error, loadErrors[loadErrors.length - 1] ?? null));
    },
    setLoadingMessages: (loading) => {
      loadingStates.push(applyStateUpdate(loading, loadingStates[loadingStates.length - 1] ?? false));
    },
    setThreadReconcileChatId: (chatId) => {
      reconcileChatIds.push(applyStateUpdate(chatId, reconcileChatIds[reconcileChatIds.length - 1] ?? null));
    },
    setHasOlderMessages: (hasOlder) => {
      olderMessageStates.push(applyStateUpdate(hasOlder, olderMessageStates[olderMessageStates.length - 1] ?? false));
    },
    setLeadPanel: (leadPanel) => { applyStateUpdate(leadPanel, null); },
    applyOutgoingOrderToServerMessage: (message) => message,
    buildMessagesSignature: (messages) => messages.map((message) => message.id).join('|'),
    reconcileLocalOutgoingMessages: (chatId, messages) => { reconciliations.push({ chatId, messages }); },
    upsertChatLocally: (chat) => { chatUpserts.push(chat); },
  };

  return {
    options,
    currentMessages,
    loadingStates,
    olderMessageStates,
    loadErrors,
    reconcileChatIds,
    chatUpserts,
    reconciliations,
    cache,
  };
};

const resetMocks = () => {
  mocks.getThread.mockReset();
  mocks.listPage.mockReset();
  mocks.toastError.mockReset();
};

test('carregamento inicial hidrata thread, indicador de paginação e cache', async () => {
  resetMocks();
  const state = createOptions();
  const chat = createChat();
  const message = createMessage('server-message');
  mocks.getThread.mockResolvedValue({ chat, lead: null, messages: [message], hasMore: true });
  let loader: Loader | null = null;
  const view = render(<Harness options={state.options} capture={(value) => { loader = value; }} />);

  try {
    assert.ok(loader);
    await act(async () => { await loader?.loadMessages(chat, 'initial'); });

    assert.equal((mocks.getThread.mock.calls[0]?.[0]), chat.id);
    assert.deepEqual(mocks.getThread.mock.calls[0]?.[1], { limit: 50 });
    assert.deepEqual(state.currentMessages.value, [message]);
    assert.deepEqual(state.olderMessageStates, [true]);
    assert.deepEqual(state.loadingStates, [true, false]);
    assert.deepEqual(state.chatUpserts, [chat]);
    assert.equal(state.cache.get(chat.id)?.signature, message.id);
    assert.deepEqual(state.cache.get(chat.id)?.messages, [message]);
  } finally {
    view.unmount();
  }
});

test('poll mescla mensagens e delega a reconciliação da fila otimista', async () => {
  resetMocks();
  const state = createOptions();
  const chat = createChat();
  const syncedMessage = createMessage('local-message-id');
  syncedMessage.external_message_id = 'provider-message-id';
  const latestInbound = { ...createMessage('inbound'), direction: 'inbound' as const };
  state.options.latestMessagesRef.current = [latestInbound];
  mocks.listPage.mockResolvedValue({ messages: [syncedMessage], hasMore: false });
  let loader: Loader | null = null;
  const view = render(<Harness options={state.options} capture={(value) => { loader = value; }} />);

  try {
    assert.ok(loader);
    await act(async () => { await loader?.loadMessages(chat, 'poll'); });

    assert.equal(mocks.listPage.mock.calls[0]?.[0], chat.id);
    assert.deepEqual(state.currentMessages.value.map(({ id }) => id), ['inbound', 'local-message-id']);
    assert.deepEqual(state.reconciliations, [{ chatId: chat.id, messages: state.currentMessages.value }]);
    assert.equal(state.cache.get(chat.id)?.hasOlderMessages, false);
  } finally {
    view.unmount();
  }
});

test('não sobrepõe polls da mesma conversa e volta a permitir polling após concluir', async () => {
  resetMocks();
  const state = createOptions();
  const chat = createChat();
  const deferredPage: { resolve?: (page: unknown) => void } = {};
  mocks.listPage.mockResolvedValue({ messages: [], hasMore: false });
  mocks.listPage.mockImplementationOnce(() => new Promise((resolve) => { deferredPage.resolve = resolve; }));
  let loader: Loader | null = null;
  const view = render(<Harness options={state.options} capture={(value) => { loader = value; }} />);

  try {
    assert.ok(loader);
    let firstPoll: Promise<unknown> | undefined;
    await act(async () => { firstPoll = loader?.loadMessages(chat, 'poll'); });
    await act(async () => { await loader?.loadMessages(chat, 'poll'); });
    await act(async () => { await Promise.resolve(); });

    assert.equal(mocks.listPage.mock.calls.length, 1);
    deferredPage.resolve?.({ messages: [], hasMore: false });
    await act(async () => { await firstPoll; });
    await act(async () => { await loader?.loadMessages(chat, 'poll'); });

    assert.equal(mocks.listPage.mock.calls.length, 2);
  } finally {
    view.unmount();
  }
});

test('resposta de uma conversa que deixou de estar selecionada não altera o estado atual', async () => {
  resetMocks();
  const state = createOptions();
  const chat = createChat();
  const deferredThread: { resolve?: (thread: unknown) => void } = {};
  mocks.getThread.mockImplementationOnce(() => new Promise((resolve) => { deferredThread.resolve = resolve; }));
  let loader: Loader | null = null;
  const view = render(<Harness options={state.options} capture={(value) => { loader = value; }} />);

  try {
    assert.ok(loader);
    let pendingLoad: Promise<unknown> | undefined;
    await act(async () => { pendingLoad = loader?.loadMessages(chat, 'initial'); });
    state.options.selectedChatIdRef.current = 'chat-2';
    deferredThread.resolve?.({ chat, lead: null, messages: [createMessage('stale')], hasMore: false });
    await act(async () => { await pendingLoad; });

    assert.deepEqual(state.currentMessages.value, []);
    assert.deepEqual(state.chatUpserts, []);
    assert.equal(state.cache.has(chat.id), false);
  } finally {
    view.unmount();
  }
});
