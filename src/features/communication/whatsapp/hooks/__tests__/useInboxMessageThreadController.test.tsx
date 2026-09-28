import assert from 'node:assert/strict';
import { act, useCallback, useEffect, useRef, useState } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppMessageSearchResult } from '../../data';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../../domain/types';
import { INBOX_MESSAGE_PAGE_SIZE } from '../../domain/messagePagination';
import { useInboxMessageLoader } from '../useInboxMessageLoader';
import { useInboxMessageThreadController } from '../useInboxMessageThreadController';

type MockFunction = ((...args: unknown[]) => unknown) & {
  mockReset: () => MockFunction;
  mockResolvedValue: (value: unknown) => MockFunction;
  mock: { calls: unknown[][] };
};

const mocks = vi.hoisted(() => ({
  getThread: vi.fn() as unknown as MockFunction,
  listContext: vi.fn() as unknown as MockFunction,
}));

vi.mock('../../data', () => ({
  whatsappConversationsRepository: { getThread: mocks.getThread },
  whatsappMessagesRepository: {
    listContext: mocks.listContext,
    listAll: vi.fn(),
    listPage: vi.fn(),
  },
}));

type Controller = ReturnType<typeof useInboxMessageThreadController>;
type ControllerOptions = Parameters<typeof useInboxMessageThreadController>[0];

type Snapshot = {
  controller: Controller;
  selectedChatId: string | null;
  messages: CommWhatsAppMessage[];
  loadingMessages: boolean;
  highlightedMessageId: string | null;
};

const createChat = (id: string): CommWhatsAppChat => ({
  id,
  channel_id: 'channel-1',
  external_chat_id: `${id}@s.whatsapp.net`,
  is_group: false,
  phone_number: '+55 11 99999-9999',
  phone_digits: '5511999999999',
  display_name: id,
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

const createMessage = (id: string, chatId: string): CommWhatsAppMessage => ({
  id,
  chat_id: chatId,
  channel_id: 'channel-1',
  direction: 'inbound',
  message_type: 'text',
  delivery_status: 'received',
  message_at: '2026-09-28T12:00:00.000Z',
  external_message_id: null,
  media_url: null,
  metadata: {},
  created_at: '2026-09-28T12:00:00.000Z',
});

const noop = () => undefined;

const Harness = ({ capture }: { capture: (snapshot: Snapshot) => void }) => {
  const [selectedChatId, setSelectedChatId] = useState<string | null>('chat-0');
  const [messages, setMessages] = useState<CommWhatsAppMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const refsRef = useRef<ControllerOptions['refs'] | null>(null);

  if (!refsRef.current) {
    refsRef.current = {
      selectedChatIdRef: { current: selectedChatId },
      latestMessagesRef: { current: messages },
      messagesRequestIdRef: { current: 0 },
      messagesSignatureRef: { current: '' },
      messagesCacheByChatIdRef: { current: new Map() },
      pendingScrollModeRef: { current: null },
      pendingScrollTopRef: { current: null },
      pendingScrollHeightRef: { current: null },
      isNearBottomRef: { current: true },
      messagesContainerRef: { current: null },
      messageSearchSelectionRequestIdRef: { current: 0 },
      pendingMessageSearchChatIdRef: { current: null },
      quotedMessageNavigationRequestIdRef: { current: 0 },
      composerTextareaRef: { current: null },
      lastSelectedChatPreviewRefreshKeyRef: { current: '' },
      cancelVoiceRecordingRef: { current: noop },
    };
  }

  const refs = refsRef.current;
  useEffect(() => {
    refs.selectedChatIdRef.current = selectedChatId;
  }, [refs, selectedChatId]);
  useEffect(() => {
    refs.latestMessagesRef.current = messages;
  }, [messages, refs]);

  const applyOutgoingOrderToServerMessage = useCallback((message: CommWhatsAppMessage) => message, []);
  const buildMessagesSignature = useCallback(
    (items: CommWhatsAppMessage[]) => items.map((message) => message.id).join('|'),
    [],
  );
  const getSelectedChatSnapshot = useCallback(
    (chatId: string | null) => (chatId ? createChat(chatId) : null),
    [],
  );
  const { loadMessages } = useInboxMessageLoader({
    selectedChatIdRef: refs.selectedChatIdRef,
    messagesRequestIdRef: refs.messagesRequestIdRef,
    latestMessagesRef: refs.latestMessagesRef,
    messagesSignatureRef: refs.messagesSignatureRef,
    messagesCacheByChatIdRef: refs.messagesCacheByChatIdRef,
    pendingScrollModeRef: refs.pendingScrollModeRef,
    pendingScrollTopRef: refs.pendingScrollTopRef,
    pendingScrollHeightRef: refs.pendingScrollHeightRef,
    isNearBottomRef: refs.isNearBottomRef,
    messagesContainerRef: refs.messagesContainerRef,
    setMessages,
    setMessageLoadError: noop,
    setLoadingMessages,
    setThreadReconcileChatId: noop,
    setHasOlderMessages: noop,
    setLeadPanel: noop,
    applyOutgoingOrderToServerMessage,
    buildMessagesSignature,
    reconcileLocalOutgoingMessages: noop,
    upsertChatLocally: noop,
  });

  const controller = useInboxMessageThreadController({
    selectedChatId,
    selectedChat: selectedChatId ? createChat(selectedChatId) : null,
    getSelectedChatSnapshot,
    loadMessages,
    refs,
    state: {
      loadingOlderMessages: false,
      hasOlderMessages: false,
      setMessages,
      setMessageLoadError: noop,
      setLoadingMessages,
      setThreadReconcileChatId: noop,
      setHasOlderMessages: noop,
      setLoadingOlderMessages: noop,
      setReplyTargetMessage: noop,
      setSelectedChatId,
      setHighlightedMessageId,
      setChatMenuPointerAnchor: noop,
      setOpenChatMenuChatId: noop,
    },
    buildMessagesSignature,
    upsertChatLocally: noop,
  });

  capture({ controller, selectedChatId, messages, loadingMessages, highlightedMessageId });
  return null;
};

test('a busca global abre a thread encontrada sem disparar uma segunda carga inicial', async () => {
  mocks.getThread.mockReset();
  mocks.listContext.mockReset();
  mocks.getThread.mockResolvedValue({ messages: [], hasMore: false, chat: createChat('chat-0'), lead: null });
  const targetChat = createChat('chat-1');
  const targetMessage = createMessage('message-1', targetChat.id);
  mocks.listContext.mockResolvedValue([targetMessage]);

  let snapshot!: Snapshot;
  const view = render(<Harness capture={(value) => { snapshot = value; }} />);

  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });

  assert.deepEqual(mocks.getThread.mock.calls, [['chat-0', { limit: INBOX_MESSAGE_PAGE_SIZE }]]);
  const result: CommWhatsAppMessageSearchResult = { chat: targetChat, message: targetMessage };
  await act(async () => {
    snapshot.controller.handleSelectMessageSearchResult(result);
    await Promise.resolve();
  });

  assert.equal(snapshot.selectedChatId, 'chat-1');
  assert.deepEqual(snapshot.messages.map((message) => message.id), [targetMessage.id]);
  assert.equal(snapshot.highlightedMessageId, targetMessage.id);
  assert.equal(snapshot.loadingMessages, false);
  assert.deepEqual(mocks.listContext.mock.calls, [['chat-1', targetMessage.id]]);
  assert.deepEqual(mocks.getThread.mock.calls, [['chat-0', { limit: INBOX_MESSAGE_PAGE_SIZE }]]);
  view.unmount();
});
