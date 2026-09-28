import assert from 'node:assert/strict';
import { act, type SetStateAction } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppMessageSearchResult } from '../../data';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../../domain/types';
import { useInboxMessageNavigation } from '../useInboxMessageNavigation';

type MockFunction = ((...args: unknown[]) => unknown) & {
  mockReset: () => MockFunction;
  mockResolvedValue: (value: unknown) => MockFunction;
  mockReturnValue: (value: unknown) => MockFunction;
  mock: { calls: unknown[][] };
};

const mocks = vi.hoisted(() => ({
  listContext: vi.fn() as unknown as MockFunction,
  listAll: vi.fn() as unknown as MockFunction,
  toastError: vi.fn() as unknown as MockFunction,
  toastInfo: vi.fn() as unknown as MockFunction,
  loadMessages: vi.fn() as unknown as MockFunction,
  upsertChatLocally: vi.fn() as unknown as MockFunction,
}));

const resetMocks = () => Object.values(mocks).forEach((mock) => mock.mockReset());

vi.mock('../../data', () => ({
  whatsappMessagesRepository: {
    listContext: mocks.listContext,
    listAll: mocks.listAll,
  },
}));

vi.mock('../../../../../lib/toast', () => ({
  toast: { error: mocks.toastError, info: mocks.toastInfo },
}));

type Navigation = ReturnType<typeof useInboxMessageNavigation>;
type NavigationOptions = Parameters<typeof useInboxMessageNavigation>[0];

const Harness = ({ options, capture }: { options: NavigationOptions; capture: (navigation: Navigation) => void }) => {
  capture(useInboxMessageNavigation(options));
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

const createMessage = (
  id: string,
  chatId = 'chat-1',
  externalMessageId: string | null = null,
): CommWhatsAppMessage => ({
  id,
  chat_id: chatId,
  channel_id: 'channel-1',
  direction: 'outbound',
  message_type: 'image',
  delivery_status: 'sent',
  message_at: '2026-09-28T12:00:00.000Z',
  external_message_id: externalMessageId,
  media_url: null,
  metadata: {},
  created_at: '2026-09-28T12:00:00.000Z',
});

const applyStateUpdate = <Value,>(update: SetStateAction<Value>, previous: Value) => (
  typeof update === 'function' ? (update as (value: Value) => Value)(previous) : update
);

const createOptions = (selectedChatId = 'chat-1', selectedChat: CommWhatsAppChat | null = createChat()) => {
  const state = {
    messages: [] as CommWhatsAppMessage[],
    messageLoadError: null as string | null,
    loadingMessages: false,
    hasOlderMessages: false,
    threadReconcileChatId: null as string | null,
    selectedChatId: selectedChatId as string | null,
    highlightedMessageId: null as string | null,
    chatMenuPointerAnchor: { x: 2, y: 3 } as { x: number; y: number } | null,
    openChatMenuChatId: 'chat-1' as string | null,
    composerFocused: false,
  };
  const cache = new Map<string, { messages: CommWhatsAppMessage[]; signature: string; hasOlderMessages: boolean }>();
  const options: NavigationOptions = {
    selectedChat,
    refs: {
      selectedChatIdRef: { current: selectedChatId },
      latestMessagesRef: { current: [] },
      messagesRequestIdRef: { current: 0 },
      messagesSignatureRef: { current: 'old-signature' },
      messagesCacheByChatIdRef: { current: cache },
      pendingScrollModeRef: { current: 'bottom' },
      pendingScrollTopRef: { current: 120 },
      pendingScrollHeightRef: { current: 400 },
      messageSearchSelectionRequestIdRef: { current: 0 },
      pendingMessageSearchChatIdRef: { current: null },
      quotedMessageNavigationRequestIdRef: { current: 0 },
      composerTextareaRef: { current: null },
    },
    setChatMenuPointerAnchor: (next) => {
      state.chatMenuPointerAnchor = applyStateUpdate(next, state.chatMenuPointerAnchor);
    },
    setOpenChatMenuChatId: (next) => {
      state.openChatMenuChatId = applyStateUpdate(next, state.openChatMenuChatId);
    },
    setMessages: (next) => {
      state.messages = applyStateUpdate(next, state.messages);
    },
    setMessageLoadError: (next) => {
      state.messageLoadError = applyStateUpdate(next, state.messageLoadError);
    },
    setLoadingMessages: (next) => {
      state.loadingMessages = applyStateUpdate(next, state.loadingMessages);
    },
    setHasOlderMessages: (next) => {
      state.hasOlderMessages = applyStateUpdate(next, state.hasOlderMessages);
    },
    setThreadReconcileChatId: (next) => {
      state.threadReconcileChatId = applyStateUpdate(next, state.threadReconcileChatId);
    },
    setSelectedChatId: (next) => {
      state.selectedChatId = applyStateUpdate(next, state.selectedChatId);
    },
    setHighlightedMessageId: (next) => {
      state.highlightedMessageId = applyStateUpdate(next, state.highlightedMessageId);
    },
    buildMessagesSignature: (messages) => messages.map((message) => message.id).join(','),
    loadMessages: async (...args) => {
      await mocks.loadMessages(...args);
    },
    upsertChatLocally: (chat) => mocks.upsertChatLocally(chat),
  };

  return { options, state, cache };
};

test('selecionar resultado troca de conversa e carrega o contexto da mensagem', async () => {
  resetMocks();
  const { options, state } = createOptions('chat-0');
  const result: CommWhatsAppMessageSearchResult = { chat: createChat(), message: createMessage('target') };
  mocks.listContext.mockResolvedValue([]);
  let navigation!: Navigation;

  render(<Harness options={options} capture={(value) => { navigation = value; }} />);
  await act(async () => {
    navigation.handleSelectMessageSearchResult(result);
    await Promise.resolve();
  });

  assert.equal(state.selectedChatId, 'chat-1');
  assert.equal(options.refs.selectedChatIdRef.current, 'chat-1');
  assert.equal(state.messages[0]?.id, 'target');
  assert.equal(state.highlightedMessageId, 'target');
  assert.equal(state.loadingMessages, false);
  assert.equal(options.refs.pendingMessageSearchChatIdRef.current, null);
  assert.equal(options.refs.pendingScrollModeRef.current, null);
  assert.equal(state.chatMenuPointerAnchor, null);
  assert.equal(state.openChatMenuChatId, null);
});

test('resultado de busca existente só destaca a mensagem e evita consulta', () => {
  resetMocks();
  const { options, state } = createOptions();
  const message = createMessage('target');
  options.refs.latestMessagesRef.current = [message];
  let navigation!: Navigation;

  render(<Harness options={options} capture={(value) => { navigation = value; }} />);
  act(() => navigation.handleSelectMessageSearchResult({ chat: createChat(), message }));

  assert.equal(state.highlightedMessageId, 'target');
  assert.equal(state.loadingMessages, false);
  assert.equal(mocks.listContext.mock.calls.length, 0);
});

test('descarta contexto atrasado depois que uma seleção mais recente começa', async () => {
  resetMocks();
  const { options, state } = createOptions();
  let resolveContext!: (messages: CommWhatsAppMessage[]) => void;
  mocks.listContext.mockReturnValue(new Promise<CommWhatsAppMessage[]>((resolve) => { resolveContext = resolve; }));
  let navigation!: Navigation;

  render(<Harness options={options} capture={(value) => { navigation = value; }} />);
  act(() => navigation.handleSelectMessageSearchResult({ chat: createChat(), message: createMessage('stale') }));
  options.refs.messageSearchSelectionRequestIdRef.current += 1;
  await act(async () => {
    resolveContext([]);
    await Promise.resolve();
  });

  assert.deepEqual(state.messages, []);
  assert.equal(state.highlightedMessageId, null);
});

test('navegar para citação carrega histórico, atualiza cache e destaca mensagem externa', async () => {
  resetMocks();
  const { options, state, cache } = createOptions();
  const quoted = createMessage('internal-id', 'chat-1', 'external-id');
  mocks.listAll.mockResolvedValue([quoted]);
  let navigation!: Navigation;

  render(<Harness options={options} capture={(value) => { navigation = value; }} />);
  await act(async () => navigation.handleOpenQuotedMessage('external-id'));

  assert.equal(state.messages[0]?.id, 'internal-id');
  assert.equal(state.highlightedMessageId, 'internal-id');
  assert.equal(state.hasOlderMessages, false);
  assert.equal(state.loadingMessages, false);
  assert.equal(cache.get('chat-1')?.signature, 'internal-id');
});

test('avisa quando a mensagem citada não existe no histórico carregado', async () => {
  resetMocks();
  const { options, state } = createOptions();
  mocks.listAll.mockResolvedValue([createMessage('another-message')]);
  let navigation!: Navigation;

  render(<Harness options={options} capture={(value) => { navigation = value; }} />);
  await act(async () => navigation.handleOpenQuotedMessage('missing-message'));

  assert.equal(mocks.toastInfo.mock.calls.length, 1);
  assert.equal(state.messages.length, 0);
  assert.equal(state.loadingMessages, false);
});
