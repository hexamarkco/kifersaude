import assert from 'node:assert/strict';
import { act, type SetStateAction } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../../domain/types';
import { INBOX_MESSAGE_PAGE_SIZE } from '../../domain/messagePagination';
import { useInboxOlderMessages } from '../useInboxOlderMessages';

type MockFunction = ((...args: unknown[]) => unknown) & {
  mockReset: () => MockFunction;
  mockResolvedValue: (value: unknown) => MockFunction;
  mockRejectedValue: (value: unknown) => MockFunction;
  mockReturnValue: (value: unknown) => MockFunction;
  mockImplementationOnce: (implementation: (...args: unknown[]) => unknown) => MockFunction;
  mock: { calls: unknown[][] };
};

const mocks = vi.hoisted(() => ({
  listPage: vi.fn() as unknown as MockFunction,
  toastError: vi.fn() as unknown as MockFunction,
}));

vi.mock('../../data', () => ({
  whatsappMessagesRepository: { listPage: mocks.listPage },
}));

vi.mock('../../../../../lib/toast', () => ({
  toast: { error: mocks.toastError },
}));

type OlderMessages = ReturnType<typeof useInboxOlderMessages>;
type OlderMessagesOptions = Parameters<typeof useInboxOlderMessages>[0];

const Harness = ({ options, capture }: { options: OlderMessagesOptions; capture: (state: OlderMessages) => void }) => {
  capture(useInboxOlderMessages(options));
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

const createMessage = (id: string, messageAt: string, chatId = 'chat-1'): CommWhatsAppMessage => ({
  id,
  chat_id: chatId,
  channel_id: 'channel-1',
  direction: 'outbound',
  message_type: 'text',
  delivery_status: 'sent',
  message_at: messageAt,
  external_message_id: null,
  media_url: null,
  metadata: {},
  created_at: messageAt,
});

const applyStateUpdate = <Value,>(update: SetStateAction<Value>, previous: Value) => (
  typeof update === 'function' ? (update as (value: Value) => Value)(previous) : update
);

const resetMocks = () => {
  mocks.listPage.mockReset();
  mocks.toastError.mockReset();
};

const createOptions = (initialMessages: CommWhatsAppMessage[] = [
  createMessage('newest-loaded', '2026-09-28T12:00:00.000Z'),
]) => {
  const currentMessages = { value: initialMessages };
  const loadingStates: boolean[] = [];
  const hasOlderStates: boolean[] = [];
  const container = { scrollTop: 137, scrollHeight: 512 } as HTMLDivElement;
  const options: OlderMessagesOptions = {
    selectedChat: createChat(),
    loadingOlderMessages: false,
    hasOlderMessages: true,
    refs: {
      latestMessagesRef: { current: initialMessages },
      selectedChatIdRef: { current: 'chat-1' },
      messagesSignatureRef: { current: initialMessages.map((message) => message.id).join('|') },
      messagesContainerRef: { current: container },
      pendingScrollModeRef: { current: null },
      pendingScrollTopRef: { current: null },
      pendingScrollHeightRef: { current: null },
    },
    setLoadingOlderMessages: (loading) => {
      loadingStates.push(applyStateUpdate(loading, loadingStates[loadingStates.length - 1] ?? false));
    },
    setHasOlderMessages: (hasOlder) => {
      hasOlderStates.push(applyStateUpdate(hasOlder, hasOlderStates[hasOlderStates.length - 1] ?? false));
    },
    setMessages: (messages) => {
      currentMessages.value = applyStateUpdate(messages, currentMessages.value);
    },
    buildMessagesSignature: (messages) => messages.map((message) => message.id).join('|'),
  };

  return { options, currentMessages, loadingStates, hasOlderStates, container };
};

const renderOlderMessages = (options: OlderMessagesOptions) => {
  let state!: OlderMessages;
  const view = render(<Harness options={options} capture={(value) => { state = value; }} />);
  return { view, get state() { return state; } };
};

test('carrega a página anterior pelo cursor e preserva a âncora ao inserir mensagens', async () => {
  resetMocks();
  const olderMessage = createMessage('older', '2026-09-28T11:00:00.000Z');
  const state = createOptions();
  mocks.listPage.mockResolvedValue({ messages: [olderMessage], hasMore: true });
  const mounted = renderOlderMessages(state.options);

  await act(async () => {
    await mounted.state.handleLoadOlderMessages();
  });

  assert.deepEqual(mocks.listPage.mock.calls[0], [
    'chat-1',
    {
      limit: INBOX_MESSAGE_PAGE_SIZE,
      before: { messageAt: '2026-09-28T12:00:00.000Z', id: 'newest-loaded' },
    },
  ]);
  assert.equal(INBOX_MESSAGE_PAGE_SIZE, 50);
  assert.deepEqual(state.currentMessages.value.map((message) => message.id), ['older', 'newest-loaded']);
  assert.deepEqual(state.hasOlderStates, [true]);
  assert.deepEqual(state.loadingStates, [true, false]);
  assert.equal(state.options.refs.messagesSignatureRef.current, 'older|newest-loaded');
  assert.equal(state.options.refs.pendingScrollModeRef.current, 'prepend');
  assert.equal(state.options.refs.pendingScrollTopRef.current, 137);
  assert.equal(state.options.refs.pendingScrollHeightRef.current, 512);
});

test('atualiza hasMore mesmo quando a página não altera as mensagens', async () => {
  resetMocks();
  const state = createOptions();
  state.options.refs.pendingScrollModeRef.current = 'bottom';
  mocks.listPage.mockResolvedValue({ messages: [], hasMore: false });
  const mounted = renderOlderMessages(state.options);

  await act(async () => {
    await mounted.state.handleLoadOlderMessages();
  });

  assert.deepEqual(state.hasOlderStates, [false]);
  assert.deepEqual(state.currentMessages.value.map((message) => message.id), ['newest-loaded']);
  assert.equal(state.options.refs.pendingScrollModeRef.current, 'bottom');
  assert.equal(state.options.refs.pendingScrollTopRef.current, null);
  assert.deepEqual(state.loadingStates, [true, false]);
});

test('deduplica chamadas simultâneas do mesmo chat e libera o lock ao concluir', async () => {
  resetMocks();
  const state = createOptions();
  let resolvePage!: (page: { messages: CommWhatsAppMessage[]; hasMore: boolean }) => void;
  const pendingPage = new Promise<{ messages: CommWhatsAppMessage[]; hasMore: boolean }>((resolve) => {
    resolvePage = resolve;
  });
  const olderMessage = createMessage('older', '2026-09-28T11:00:00.000Z');
  mocks.listPage.mockReturnValue(pendingPage);
  const mounted = renderOlderMessages(state.options);
  let firstRequest!: Promise<void>;

  await act(async () => {
    firstRequest = mounted.state.handleLoadOlderMessages();
    await mounted.state.handleLoadOlderMessages();
  });
  assert.equal(mocks.listPage.mock.calls.length, 1);

  resolvePage({ messages: [olderMessage], hasMore: false });
  await act(async () => {
    await firstRequest;
  });

  await act(async () => {
    await mounted.state.handleLoadOlderMessages();
  });
  assert.equal(mocks.listPage.mock.calls.length, 2);
});

test('descarta uma página que chega depois da troca de conversa', async () => {
  resetMocks();
  const state = createOptions();
  let resolvePage!: (page: { messages: CommWhatsAppMessage[]; hasMore: boolean }) => void;
  const pendingPage = new Promise<{ messages: CommWhatsAppMessage[]; hasMore: boolean }>((resolve) => {
    resolvePage = resolve;
  });
  mocks.listPage.mockReturnValue(pendingPage);
  const mounted = renderOlderMessages(state.options);
  let request!: Promise<void>;

  await act(async () => {
    request = mounted.state.handleLoadOlderMessages();
  });
  state.options.refs.selectedChatIdRef.current = 'chat-2';
  resolvePage({ messages: [createMessage('stale-older', '2026-09-28T11:00:00.000Z')], hasMore: false });

  await act(async () => {
    await request;
  });

  assert.deepEqual(state.currentMessages.value.map((message) => message.id), ['newest-loaded']);
  assert.deepEqual(state.hasOlderStates, []);
  assert.deepEqual(state.loadingStates, [true]);
  assert.equal(state.options.refs.messagesSignatureRef.current, 'newest-loaded');
  assert.equal(state.options.refs.pendingScrollModeRef.current, null);
});

test('descarta erro de uma requisição obsoleta sem exibir toast', async () => {
  resetMocks();
  const state = createOptions();
  let rejectPage!: (error: Error) => void;
  const pendingPage = new Promise<{ messages: CommWhatsAppMessage[]; hasMore: boolean }>((_resolve, reject) => {
    rejectPage = reject;
  });
  mocks.listPage.mockReturnValue(pendingPage);
  const mounted = renderOlderMessages(state.options);
  let request!: Promise<void>;

  await act(async () => {
    request = mounted.state.handleLoadOlderMessages();
  });
  state.options.refs.selectedChatIdRef.current = 'chat-2';
  rejectPage(new Error('resposta antiga'));

  await act(async () => {
    await request;
  });

  assert.deepEqual(state.currentMessages.value.map((message) => message.id), ['newest-loaded']);
  assert.deepEqual(state.hasOlderStates, []);
  assert.deepEqual(state.loadingStates, [true]);
  assert.equal(mocks.toastError.mock.calls.length, 0);
});

test('exibe erro e libera a tentativa seguinte', async () => {
  resetMocks();
  const state = createOptions();
  const olderMessage = createMessage('older', '2026-09-28T11:00:00.000Z');
  mocks.listPage
    .mockImplementationOnce(() => Promise.reject(new Error('offline')))
    .mockResolvedValue({ messages: [olderMessage], hasMore: false });
  const mounted = renderOlderMessages(state.options);

  await act(async () => {
    await mounted.state.handleLoadOlderMessages();
  });
  await act(async () => {
    await mounted.state.handleLoadOlderMessages();
  });

  assert.deepEqual(mocks.toastError.mock.calls, [['offline']]);
  assert.equal(mocks.listPage.mock.calls.length, 2);
  assert.deepEqual(state.currentMessages.value.map((message) => message.id), ['older', 'newest-loaded']);
  assert.deepEqual(state.loadingStates, [true, false, true, false]);
});
