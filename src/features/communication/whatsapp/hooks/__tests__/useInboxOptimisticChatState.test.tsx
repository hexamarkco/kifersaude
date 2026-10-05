import assert from 'node:assert/strict';
import { act, useCallback, useRef, useState } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppChat } from '../../domain/types';
import type { PendingChatInboxStatePatch } from '../../pendingChatInboxState';
import { useInboxOptimisticChatState } from '../useInboxOptimisticChatState';

type MockFunction = ((...args: unknown[]) => unknown) & {
  mockReset: () => MockFunction;
  mockImplementation: (implementation: (...args: unknown[]) => unknown) => MockFunction;
  mockRejectedValue: (value: unknown) => MockFunction;
};

const mocks = vi.hoisted(() => ({ markRead: vi.fn() as unknown as MockFunction }));

vi.mock('../../data', () => ({
  whatsappConversationsRepository: { markRead: mocks.markRead },
}));

type Controller = ReturnType<typeof useInboxOptimisticChatState> & {
  chats: CommWhatsAppChat[];
  pendingStateByChatId: Map<string, PendingChatInboxStatePatch>;
  readMutationVersionByChatId: Map<string, number>;
};

const createChat = (overrides: Partial<CommWhatsAppChat> = {}): CommWhatsAppChat => ({
  id: 'chat-1',
  channel_id: 'channel-1',
  external_chat_id: '5511999999999@s.whatsapp.net',
  is_group: false,
  phone_number: '5511999999999',
  phone_digits: '5511999999999',
  display_name: 'Contato',
  merged_into_chat_id: null,
  lead_link_source: null,
  lead_linked_at: null,
  lead_linked_by: null,
  auto_link_blocked: false,
  identity_conflict: false,
  is_archived: false,
  archived_at: null,
  is_muted: false,
  muted_at: null,
  is_pinned: false,
  pinned_at: null,
  manual_unread: true,
  manual_unread_at: '2026-09-28T11:00:00.000Z',
  last_message_text: 'Mensagem anterior',
  last_message_direction: 'inbound',
  last_message_at: '2026-09-28T12:00:00.000Z',
  last_message_delivery_status: 'received',
  unread_count: 2,
  status: 'open',
  autonomous_attendance_status: 'inactive',
  last_read_at: '2026-09-28T11:00:00.000Z',
  created_at: '2026-09-28T10:00:00.000Z',
  updated_at: '2026-09-28T12:00:00.000Z',
  ...overrides,
});

const signatureFor = (chats: CommWhatsAppChat[]) => chats.map((chat) => (
  `${chat.id}:${chat.last_message_at}:${chat.last_message_delivery_status}`
)).join('|');

const Harness = ({
  initialChat,
  initialPendingState,
  capture,
}: {
  initialChat: CommWhatsAppChat;
  initialPendingState?: PendingChatInboxStatePatch;
  capture: (controller: Controller) => void;
}) => {
  const [chats, setChats] = useState([initialChat]);
  const pendingChatInboxStateRef = useRef(new Map<string, PendingChatInboxStatePatch>(
    initialPendingState ? [[initialChat.id, initialPendingState]] : [],
  ));
  const chatReadMutationVersionByChatIdRef = useRef(new Map<string, number>());
  const chatsSignatureRef = useRef(signatureFor([initialChat]));
  const buildChatsSignature = useCallback(signatureFor, []);
  const upsertChatLocally = useCallback((nextChat: CommWhatsAppChat) => {
    setChats((current) => {
      const exists = current.some((chat) => chat.id === nextChat.id);
      const next = exists
        ? current.map((chat) => chat.id === nextChat.id ? { ...chat, ...nextChat } : chat)
        : [nextChat, ...current];
      chatsSignatureRef.current = buildChatsSignature(next);
      return next;
    });
  }, [buildChatsSignature]);
  const actions = useInboxOptimisticChatState({
    refs: { pendingChatInboxStateRef, chatReadMutationVersionByChatIdRef, chatsSignatureRef },
    setChats,
    upsertChatLocally,
    buildChatsSignature,
  });

  capture({
    ...actions,
    chats,
    pendingStateByChatId: pendingChatInboxStateRef.current,
    readMutationVersionByChatId: chatReadMutationVersionByChatIdRef.current,
  });
  return null;
};

const mountController = (initialChat = createChat(), initialPendingState?: PendingChatInboxStatePatch) => {
  let controller!: Controller;
  const view = render(
    <Harness
      initialChat={initialChat}
      initialPendingState={initialPendingState}
      capture={(nextController) => { controller = nextController; }}
    />,
  );
  return { view, get controller() { return controller; } };
};

test('aplica prévia e leitura otimistas e ignora confirmação de leitura obsoleta', async () => {
  mocks.markRead.mockReset();
  const pendingReadResolutions: Array<() => void> = [];
  mocks.markRead.mockImplementation(() => new Promise<void>((resolve) => pendingReadResolutions.push(resolve)));
  const initialChat = createChat({ is_archived: true, archived_at: '2026-09-20T12:00:00.000Z' });
  const mounted = mountController(initialChat);

  act(() => mounted.controller.applyOptimisticChatSummary(initialChat, 'Nova mensagem', '2026-09-28T12:01:00.000Z'));
  let chat = mounted.controller.chats[0];
  assert.equal(chat?.last_message_text, 'Nova mensagem');
  assert.equal(chat?.last_message_direction, 'outbound');
  assert.equal(chat?.last_message_delivery_status, 'pending');
  assert.equal(chat?.last_message_at, '2026-09-28T12:01:00.000Z');
  assert.equal(chat?.is_archived, false);
  assert.equal(chat?.archived_at, null);
  assert.equal(chat?.unread_count, 0);
  assert.equal(chat?.manual_unread, false);
  assert.equal(mounted.controller.pendingStateByChatId.get(initialChat.id)?.last_message_delivery_status, 'pending');
  assert.equal(mounted.controller.readMutationVersionByChatId.get(initialChat.id), 1);

  act(() => mounted.controller.applyOptimisticChatSummary(initialChat, 'Mensagem seguinte', '2026-09-28T12:02:00.000Z'));
  assert.equal(mounted.controller.readMutationVersionByChatId.get(initialChat.id), 2);

  await act(async () => {
    pendingReadResolutions[0]?.();
    await Promise.resolve();
  });
  assert.equal(mounted.controller.readMutationVersionByChatId.get(initialChat.id), 2);

  await act(async () => {
    pendingReadResolutions[1]?.();
    await Promise.resolve();
  });
  assert.equal(mounted.controller.readMutationVersionByChatId.has(initialChat.id), false);
  chat = mounted.controller.chats[0];
  assert.equal(chat?.last_message_text, 'Mensagem seguinte');
  assert.equal(chat?.last_message_at, '2026-09-28T12:02:00.000Z');
  mounted.view.unmount();
});

for (const isMuted of [false, true]) {
  test(`envio desarquiva o chat e a pendência local, com is_muted=${isMuted}`, async () => {
    mocks.markRead.mockReset();
    mocks.markRead.mockImplementation(() => Promise.resolve());
    const chat = createChat({ is_archived: true, archived_at: '2026-09-20T12:00:00.000Z', is_muted: isMuted });
    const mounted = mountController(chat);

    await act(async () => mounted.controller.applyOptimisticChatSummary(chat, 'Nova mensagem', '2026-09-28T12:01:00.000Z'));
    assert.equal(mounted.controller.chats[0]?.is_archived, false);
    assert.equal(mounted.controller.chats[0]?.archived_at, null);
    assert.equal(mounted.controller.chats[0]?.is_muted, isMuted);
    assert.equal(mounted.controller.pendingStateByChatId.get(chat.id)?.is_archived, false);
    assert.equal(mounted.controller.pendingStateByChatId.get(chat.id)?.archived_at, null);
    mounted.view.unmount();
  });
}

test('atualiza o status do preview somente no timestamp correspondente e sem regressão', () => {
  mocks.markRead.mockReset();
  const chat = createChat({ last_message_delivery_status: 'delivered' });
  const pendingState: PendingChatInboxStatePatch = {
    last_message_at: chat.last_message_at,
    last_message_delivery_status: 'delivered',
  };
  const mounted = mountController(chat, pendingState);

  act(() => mounted.controller.updateOptimisticChatPreviewStatus(chat.id, chat.last_message_at ?? '', 'sent'));
  assert.equal(mounted.controller.chats[0]?.last_message_delivery_status, 'delivered');
  assert.equal(mounted.controller.pendingStateByChatId.get(chat.id)?.last_message_delivery_status, 'delivered');

  act(() => mounted.controller.updateOptimisticChatPreviewStatus(chat.id, '2026-09-28T11:59:00.000Z', 'sent'));
  assert.equal(mounted.controller.chats[0]?.last_message_delivery_status, 'delivered');
  assert.equal(mounted.controller.pendingStateByChatId.get(chat.id)?.last_message_delivery_status, 'delivered');
  mounted.view.unmount();
});

test('falha apenas registra erro e libera a versão de leitura atual', async () => {
  mocks.markRead.mockReset();
  mocks.markRead.mockRejectedValue(new Error('offline'));
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const chat = createChat();
  const mounted = mountController(chat);

  try {
    act(() => mounted.controller.applyOptimisticChatSummary(chat, 'Nova mensagem', '2026-09-28T12:01:00.000Z'));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    assert.equal(mounted.controller.readMutationVersionByChatId.has(chat.id), false);
    assert.equal(errorSpy.mock.calls.length, 1);
  } finally {
    mounted.view.unmount();
    vi.restoreAllMocks();
  }
});
