import assert from 'node:assert/strict';
import { act, type SetStateAction } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppChat, CommWhatsAppMessage, CommWhatsAppPresence } from '../../domain/types';
import { buildPendingChatInboxStatePatch, type PendingChatInboxStatePatch } from '../../pendingChatInboxState';
import { useInboxRealtimeUpdates } from '../useInboxRealtimeUpdates';

type MockFunction = ((...args: unknown[]) => unknown) & {
  mockReset: () => MockFunction;
  mock: { calls: unknown[][] };
};

const mocks = vi.hoisted(() => ({
  loadChats: vi.fn() as unknown as MockFunction,
}));

const resetMocks = () => Object.values(mocks).forEach((mock) => mock.mockReset());

type RealtimeUpdates = ReturnType<typeof useInboxRealtimeUpdates>;
type RealtimeUpdatesOptions = Parameters<typeof useInboxRealtimeUpdates>[0];

const Harness = ({ options, capture }: { options: RealtimeUpdatesOptions; capture: (updates: RealtimeUpdates) => void }) => {
  capture(useInboxRealtimeUpdates(options));
  return null;
};

const createChat = (id: string, overrides: Partial<CommWhatsAppChat> = {}): CommWhatsAppChat => ({
  id,
  channel_id: 'channel-1',
  external_chat_id: `${id}@s.whatsapp.net`,
  is_group: false,
  phone_number: '+55 11 99999-9999',
  phone_digits: '5511999999999',
  display_name: id,
  saved_contact_name: null,
  push_name: null,
  lead_id: null,
  lead_name: null,
  lead_status: null,
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
  last_message_text: 'Oi',
  last_message_direction: 'inbound',
  last_message_at: '2026-09-28T12:00:00.000Z',
  last_message_delivery_status: 'received',
  unread_count: 0,
  status: 'open',
  autonomous_attendance_status: 'inactive',
  created_at: '2026-09-28T11:00:00.000Z',
  updated_at: '2026-09-28T12:00:00.000Z',
  ...overrides,
});

const createMessage = (
  id: string,
  chatId = 'chat-1',
  metadata: Record<string, unknown> = {},
  overrides: Partial<CommWhatsAppMessage> = {},
): CommWhatsAppMessage => ({
  id,
  chat_id: chatId,
  channel_id: 'channel-1',
  direction: 'outbound',
  message_type: 'text',
  text_content: 'Olá',
  delivery_status: 'sent',
  message_at: '2026-09-28T12:01:00.000Z',
  external_message_id: null,
  media_url: null,
  metadata,
  created_at: '2026-09-28T12:01:00.000Z',
  ...overrides,
});

const applyStateUpdate = <Value,>(update: SetStateAction<Value>, previous: Value) => (
  typeof update === 'function' ? (update as (value: Value) => Value)(previous) : update
);

const createOptions = (initialChats: CommWhatsAppChat[] = [], selectedChatId: string | null = null) => {
  const initialMessages: CommWhatsAppMessage[] = [];
  const state = {
    chats: initialChats,
    messages: initialMessages,
    selectedChatId,
  };
  const outgoingReconciliations: Array<{ chatId: string; messages: CommWhatsAppMessage[] }> = [];
  const refs: RealtimeUpdatesOptions['refs'] = {
    chatPollBackoffRef: { current: 3 },
    chatPollIdleCyclesRef: { current: 4 },
    selectedChatIdRef: { current: selectedChatId },
    archivedSectionOpenRef: { current: false },
    latestChatsRef: { current: initialChats },
    chatIdFromUrlRef: { current: null },
    savedContactNameOverrideByPhoneRef: { current: new Map() },
    savedContactNameByPhoneRef: { current: new Map() },
    pendingChatInboxStateRef: { current: new Map<string, PendingChatInboxStatePatch>() },
    chatsSignatureRef: { current: '' },
    messagesSignatureRef: { current: '' },
    isNearBottomRef: { current: false },
    pendingScrollModeRef: { current: null },
    pendingScrollTopRef: { current: null },
    pendingScrollHeightRef: { current: null },
    messagesContainerRef: { current: { scrollTop: 137 } as HTMLDivElement },
    loadChatsRef: { current: () => mocks.loadChats() as Promise<void> },
  };
  const options: RealtimeUpdatesOptions = {
    refs,
    setSelectedChatId: (next) => {
      state.selectedChatId = applyStateUpdate(next, state.selectedChatId);
      refs.selectedChatIdRef.current = state.selectedChatId;
    },
    setChats: (next) => {
      state.chats = applyStateUpdate(next, state.chats);
    },
    setMessages: (next) => {
      state.messages = applyStateUpdate(next, state.messages);
    },
    buildChatsSignature: (chats) => JSON.stringify(chats.map((chat) => [chat.id, chat.is_archived, chat.display_name, chat.presence_status])),
    buildMessagesSignature: (messages) => JSON.stringify(messages.map((message) => [message.id, message.delivery_status])),
    chatMatchesActiveFilters: () => true,
    applyFrontendSavedContactNames: (chats) => chats,
    applyPrefetchedLeadNames: (chats) => chats,
    applyOutgoingOrderToServerMessage: (message) => message,
    reconcileLocalOutgoingMessages: (chatId, messages) => outgoingReconciliations.push({ chatId, messages }),
  };
  refs.chatsSignatureRef.current = options.buildChatsSignature(initialChats);
  refs.messagesSignatureRef.current = options.buildMessagesSignature(initialMessages);

  return { options, refs, state, outgoingReconciliations };
};

const chatPayload = (
  eventType: 'INSERT' | 'UPDATE' | 'DELETE',
  next: CommWhatsAppChat | null,
  previous: Partial<CommWhatsAppChat> | null,
) => ({ eventType, new: next, old: previous }) as unknown as RealtimePostgresChangesPayload<CommWhatsAppChat>;

const messagePayload = (
  eventType: 'INSERT' | 'UPDATE' | 'DELETE',
  next: CommWhatsAppMessage | null,
  previous: Partial<CommWhatsAppMessage> | null,
) => ({ eventType, new: next, old: previous }) as unknown as RealtimePostgresChangesPayload<CommWhatsAppMessage>;

test('chat realtime reaplica patch otimista e zera backoff de polling', () => {
  resetMocks();
  const chat = createChat('chat-1', { last_message_at: '2026-09-27T12:00:00.000Z' });
  const { options, refs, state } = createOptions([chat], chat.id);
  refs.pendingChatInboxStateRef.current.set(chat.id, buildPendingChatInboxStatePatch(chat, { isArchived: true }));
  let updates!: RealtimeUpdates;

  render(<Harness options={options} capture={(value) => { updates = value; }} />);
  act(() => updates.applyRealtimeChatChange(chatPayload('UPDATE', chat, chat)));

  assert.equal(state.chats[0]?.is_archived, true);
  assert.equal(refs.chatPollBackoffRef.current, 0);
  assert.equal(refs.chatPollIdleCyclesRef.current, 0);
});

test('remoção do chat selecionado escolhe substituto da mesma seção e sincroniza deep link', () => {
  resetMocks();
  const selectedChat = createChat('chat-1');
  const nextActiveChat = createChat('chat-2');
  const archivedChat = createChat('chat-3', { is_archived: true });
  const { options, refs, state } = createOptions([selectedChat, nextActiveChat, archivedChat], selectedChat.id);
  let updates!: RealtimeUpdates;

  render(<Harness options={options} capture={(value) => { updates = value; }} />);
  act(() => updates.applyRealtimeChatChange(chatPayload('DELETE', null, selectedChat)));

  assert.equal(state.selectedChatId, 'chat-2');
  assert.equal(refs.chatIdFromUrlRef.current, 'chat-2');
  assert.deepEqual(state.chats.map((chat) => chat.id), ['chat-2', 'chat-3']);
});

test('merge do chat selecionado troca a seleção e solicita refetch da lista', () => {
  resetMocks();
  const chat = createChat('chat-1', { merged_into_chat_id: 'chat-canonical' });
  const { options, refs, state } = createOptions([createChat('chat-1')], 'chat-1');
  let updates!: RealtimeUpdates;

  render(<Harness options={options} capture={(value) => { updates = value; }} />);
  act(() => updates.applyRealtimeChatChange(chatPayload('UPDATE', chat, null)));

  assert.equal(state.selectedChatId, 'chat-canonical');
  assert.equal(refs.chatPollBackoffRef.current, 0);
  assert.equal(mocks.loadChats.mock.calls.length, 1);
  assert.equal(state.chats.length, 0);
});

test('presença realtime atualiza chat e remoção limpa os campos de presença', () => {
  resetMocks();
  const chat = createChat('chat-1', {
    presence_status: 'typing',
    presence_last_seen_at: '2026-09-28T12:00:00.000Z',
    presence_updated_at: '2026-09-28T12:00:00.000Z',
  });
  const { options, state } = createOptions([chat]);
  let updates!: RealtimeUpdates;
  const deletedPresence = {
    chat_id: chat.id,
    status: 'typing',
    last_seen_at: chat.presence_last_seen_at,
    observed_at: chat.presence_updated_at,
  } as unknown as CommWhatsAppPresence;

  render(<Harness options={options} capture={(value) => { updates = value; }} />);
  act(() => updates.applyRealtimePresenceChange({
    eventType: 'DELETE',
    new: null,
    old: deletedPresence,
  } as unknown as RealtimePostgresChangesPayload<CommWhatsAppPresence>));

  assert.equal(state.chats[0]?.presence_status, null);
  assert.equal(state.chats[0]?.presence_last_seen_at, null);
  assert.equal(state.chats[0]?.presence_updated_at, null);
});

test('nova mensagem preserva posição de leitura quando operador não está no final da conversa', () => {
  resetMocks();
  const { options, refs, state } = createOptions([], 'chat-1');
  let updates!: RealtimeUpdates;
  const incomingMessage = createMessage('message-1');

  render(<Harness options={options} capture={(value) => { updates = value; }} />);
  act(() => updates.applyRealtimeMessageChange(messagePayload('INSERT', incomingMessage, null)));

  assert.equal(state.messages[0]?.id, 'message-1');
  assert.equal(refs.pendingScrollModeRef.current, 'preserve');
  assert.equal(refs.pendingScrollTopRef.current, 137);
  assert.equal(refs.pendingScrollHeightRef.current, null);
});

test('encaminha a confirmação realtime do envio ao reconciliador da fila otimista', () => {
  resetMocks();
  const serverMessage = createMessage('server-1', 'chat-1', { client_request_id: 'request-1' }, {
    external_message_id: 'external-1',
  });
  const { options, outgoingReconciliations } = createOptions([], 'chat-1');
  let updates!: RealtimeUpdates;

  render(<Harness options={options} capture={(value) => { updates = value; }} />);
  act(() => updates.applyRealtimeMessageChange(messagePayload('INSERT', serverMessage, null)));

  assert.deepEqual(outgoingReconciliations, [{ chatId: 'chat-1', messages: [serverMessage] }]);
});
