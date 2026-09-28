import assert from 'node:assert/strict';
import { act } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../../domain/types';
import { useInboxMarkChatRead } from '../useInboxMarkChatRead';

type MockFunction = ((...args: unknown[]) => unknown) & {
  mockReset: () => MockFunction;
  mockResolvedValue: (value: unknown) => MockFunction;
  mockRejectedValue: (value: unknown) => MockFunction;
  mockImplementation: (implementation: (...args: unknown[]) => unknown) => MockFunction;
  mockReturnValue: (value: unknown) => MockFunction;
  mock: { calls: unknown[][] };
};

const mocks = vi.hoisted(() => ({
  markRead: vi.fn() as unknown as MockFunction,
  toastError: vi.fn() as unknown as MockFunction,
}));

vi.mock('../../data', () => ({
  whatsappConversationsRepository: { markRead: mocks.markRead },
}));

vi.mock('../../../../../lib/toast', () => ({
  toast: { error: mocks.toastError },
}));

type MarkChatRead = ReturnType<typeof useInboxMarkChatRead>;
type MarkChatReadOptions = Parameters<typeof useInboxMarkChatRead>[0];

let markChatRead: MarkChatRead;

const Harness = ({ options }: { options: MarkChatReadOptions }) => {
  markChatRead = useInboxMarkChatRead(options);
  return null;
};

const createChat = (overrides: Partial<CommWhatsAppChat> = {}): CommWhatsAppChat => ({
  id: 'chat-1',
  channel_id: 'channel-1',
  external_chat_id: '5511999999999@s.whatsapp.net',
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
  last_message_direction: 'inbound',
  last_message_at: '2026-09-28T12:00:00.000Z',
  unread_count: 3,
  status: 'open',
  autonomous_attendance_status: 'inactive',
  created_at: '2026-09-28T11:00:00.000Z',
  updated_at: '2026-09-28T12:00:00.000Z',
  ...overrides,
});

const createMessage = (overrides: Partial<CommWhatsAppMessage> = {}): CommWhatsAppMessage => ({
  id: 'message-1',
  chat_id: 'chat-1',
  channel_id: 'channel-1',
  direction: 'inbound',
  message_type: 'text',
  delivery_status: 'received',
  message_at: '2026-09-28T12:00:00.000Z',
  metadata: {},
  created_at: '2026-09-28T12:00:00.000Z',
  ...overrides,
});

const createOptions = (chat = createChat(), messages = [createMessage()], nearBottom = true) => {
  const refs: MarkChatReadOptions['refs'] = {
    selectedChatIdRef: { current: chat.id },
    latestChatsRef: { current: [chat] },
    latestMessagesRef: { current: messages },
    isNearBottomRef: { current: nearBottom },
    pendingChatInboxStateRef: { current: new Map() },
    manualUnreadSkipReadChatIdRef: { current: null },
    chatReadMutationVersionByChatIdRef: { current: new Map() },
  };
  const upsertChatLocally = vi.fn() as unknown as MockFunction;
  const loadChatsMock = vi.fn() as unknown as MockFunction;
  loadChatsMock.mockResolvedValue(undefined);
  const loadChats = () => Promise.resolve(loadChatsMock());
  const options: MarkChatReadOptions = { refs, upsertChatLocally, loadChats };
  return { options, refs, upsertChatLocally, loadChatsMock };
};

const resetMocks = () => {
  mocks.markRead.mockReset();
  mocks.toastError.mockReset();
};

test('só avança a leitura quando a conversa está no fim e a última mensagem já foi renderizada', () => {
  resetMocks();
  const olderMessage = createMessage({ message_at: '2026-09-28T11:59:00.000Z' });
  const state = createOptions(createChat(), [olderMessage]);
  const view = render(<Harness options={state.options} />);

  act(() => markChatRead.markSelectedChatReadIfEligible('auto'));
  assert.equal(mocks.markRead.mock.calls.length, 0);

  state.refs.latestMessagesRef.current = [createMessage()];
  state.refs.isNearBottomRef.current = false;
  act(() => markChatRead.markSelectedChatReadIfEligible('scroll'));
  assert.equal(mocks.markRead.mock.calls.length, 0);
  view.unmount();
});

test('protege não lido manual no modo automático e permite limpar ao alcançar o fim', () => {
  resetMocks();
  const chat = createChat({ unread_count: 0, manual_unread: true, manual_unread_at: '2026-09-28T11:30:00.000Z' });
  const state = createOptions(chat);
  state.refs.manualUnreadSkipReadChatIdRef.current = chat.id;
  mocks.markRead.mockResolvedValue({ id: chat.id, unreadCount: 0, lastReadAt: chat.last_message_at });
  const view = render(<Harness options={state.options} />);

  act(() => markChatRead.markSelectedChatReadIfEligible('auto'));
  assert.equal(mocks.markRead.mock.calls.length, 0);

  act(() => markChatRead.markSelectedChatReadIfEligible('scroll'));
  assert.deepEqual(mocks.markRead.mock.calls, [[chat.id, { messageAt: chat.last_message_at }]]);
  assert.equal(state.refs.manualUnreadSkipReadChatIdRef.current, null);
  assert.equal(state.upsertChatLocally.mock.calls[0]?.[0] && (state.upsertChatLocally.mock.calls[0][0] as CommWhatsAppChat).manual_unread, false);
  view.unmount();
});

test('deduplica requisições concorrentes para o mesmo cursor de leitura', async () => {
  resetMocks();
  let resolveMarkRead: (value: { id: string; unreadCount: number; lastReadAt: string }) => void = () => undefined;
  mocks.markRead.mockImplementation(() => new Promise((resolve) => {
    resolveMarkRead = resolve;
  }));
  const state = createOptions();
  const view = render(<Harness options={state.options} />);

  act(() => markChatRead.markSelectedChatReadIfEligible('auto'));
  act(() => markChatRead.markSelectedChatReadIfEligible('scroll'));
  assert.equal(mocks.markRead.mock.calls.length, 1);

  await act(async () => {
    resolveMarkRead({ id: 'chat-1', unreadCount: 0, lastReadAt: '2026-09-28T12:00:00.000Z' });
    await Promise.resolve();
  });
  assert.equal(state.refs.pendingChatInboxStateRef.current.has('chat-1'), false);
  view.unmount();
});

test('confirma o patch do servidor e preserva avisos não lidos que ainda restam', async () => {
  resetMocks();
  const chat = createChat({ manual_unread: true, manual_unread_at: '2026-09-28T11:30:00.000Z' });
  const state = createOptions(chat);
  mocks.markRead.mockResolvedValue({ id: chat.id, unreadCount: 2, lastReadAt: '2026-09-28T11:58:00.000Z' });
  const view = render(<Harness options={state.options} />);

  act(() => markChatRead.markSelectedChatReadIfEligible('auto'));
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  const confirmedChat = state.upsertChatLocally.mock.calls[1]?.[0] as CommWhatsAppChat | undefined;
  assert.equal(confirmedChat?.unread_count, 2);
  assert.equal(confirmedChat?.manual_unread, true);
  assert.equal(confirmedChat?.manual_unread_at, chat.manual_unread_at);
  assert.equal(confirmedChat?.last_read_at, '2026-09-28T11:58:00.000Z');
  assert.equal(state.refs.pendingChatInboxStateRef.current.has(chat.id), false);
  view.unmount();
});

test('em falha limpa estado pendente, avisa, recarrega e respeita o cooldown de retry', async () => {
  resetMocks();
  const state = createOptions();
  mocks.markRead.mockRejectedValue(new Error('offline'));
  const view = render(<Harness options={state.options} />);

  act(() => markChatRead.markSelectedChatReadIfEligible('auto'));
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  assert.equal(state.refs.pendingChatInboxStateRef.current.has('chat-1'), false);
  assert.equal(mocks.toastError.mock.calls.length, 1);
  assert.equal(state.loadChatsMock.mock.calls.length, 1);
  act(() => markChatRead.markSelectedChatReadIfEligible('auto'));
  assert.equal(mocks.markRead.mock.calls.length, 1);

  view.unmount();
});
