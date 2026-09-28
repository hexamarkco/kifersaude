import assert from 'node:assert/strict';
import { act, type SetStateAction } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppChat } from '../../domain/types';
import type { PendingChatInboxStatePatch } from '../../pendingChatInboxState';
import { useInboxChatMutations } from '../useInboxChatMutations';

type MockFunction = ((...args: unknown[]) => unknown) & {
  mockReset: () => MockFunction;
  mockResolvedValue: (value: unknown) => MockFunction;
  mockRejectedValue: (value: unknown) => MockFunction;
  mockReturnValue: (value: unknown) => MockFunction;
  mock: { calls: unknown[][] };
};

const mocks = vi.hoisted(() => ({
  updateInboxState: vi.fn() as unknown as MockFunction,
  setAutonomousAttendanceStatus: vi.fn() as unknown as MockFunction,
  deleteChat: vi.fn() as unknown as MockFunction,
  toastSuccess: vi.fn() as unknown as MockFunction,
  toastWarning: vi.fn() as unknown as MockFunction,
  toastError: vi.fn() as unknown as MockFunction,
  loadChats: vi.fn() as unknown as MockFunction,
  refreshArchivedChatsCount: vi.fn() as unknown as MockFunction,
  upsertChatLocally: vi.fn() as unknown as MockFunction,
}));

const resetMocks = () => Object.values(mocks).forEach((mock) => mock.mockReset());

vi.mock('../../data', () => ({
  whatsappConversationsRepository: {
    updateInboxState: mocks.updateInboxState,
    setAutonomousAttendanceStatus: mocks.setAutonomousAttendanceStatus,
    delete: mocks.deleteChat,
  },
}));

vi.mock('../../../../../lib/toast', () => ({
  toast: { success: mocks.toastSuccess, warning: mocks.toastWarning, error: mocks.toastError },
}));

type ChatMutations = ReturnType<typeof useInboxChatMutations>;
type ChatMutationsOptions = Parameters<typeof useInboxChatMutations>[0];

const Harness = ({ options, capture }: { options: ChatMutationsOptions; capture: (mutations: ChatMutations) => void }) => {
  capture(useInboxChatMutations(options));
  return null;
};

const createChat = (id: string, overrides: Partial<CommWhatsAppChat> = {}): CommWhatsAppChat => ({
  id,
  channel_id: 'channel-1',
  external_chat_id: `${id}@s.whatsapp.net`,
  is_group: false,
  phone_number: '5511999999999',
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
  archived_at: null,
  is_muted: false,
  muted_at: null,
  is_pinned: false,
  pinned_at: null,
  manual_unread: false,
  manual_unread_at: null,
  last_message_text: 'Oi',
  last_message_direction: 'inbound',
  last_message_at: '2026-09-28T12:00:00.000Z',
  last_message_delivery_status: 'received',
  unread_count: 0,
  status: 'open',
  last_read_at: null,
  deleted_at: null,
  autonomous_attendance_status: 'inactive',
  created_at: '2026-09-28T11:00:00.000Z',
  updated_at: '2026-09-28T12:00:00.000Z',
  ...overrides,
});
const createOptions = (params: {
  chats?: CommWhatsAppChat[];
  selectedChatId?: string | null;
  archivedSectionOpen?: boolean;
} = {}) => {
  const initialChats = params.chats ?? [];
  const state = {
    chats: initialChats,
    selectedChatId: params.selectedChatId ?? null,
    archivedSectionOpen: params.archivedSectionOpen ?? false,
    updatingChatStateId: null as string | null,
    assumingControlChatId: null as string | null,
    deletingChatId: null as string | null,
    chatsSignature: 'initial',
  };
  const pendingChatInboxState = new Map<string, PendingChatInboxStatePatch>();
  const options: ChatMutationsOptions = {
    assumingControlChatId: state.assumingControlChatId,
    deletingChatId: state.deletingChatId,
    refs: {
      pendingChatInboxStateRef: { current: pendingChatInboxState },
      manualUnreadSkipReadChatIdRef: { current: null },
      chatReadMutationVersionByChatIdRef: { current: new Map() },
      archivedSectionOpenRef: { current: state.archivedSectionOpen },
      latestChatsRef: { current: initialChats },
      selectedChatIdRef: { current: state.selectedChatId },
      chatsSignatureRef: { current: state.chatsSignature },
    },
    setUpdatingChatStateId: (next) => {
      state.updatingChatStateId = applyStateUpdate(next, state.updatingChatStateId);
    },
    setAssumingControlChatId: (next) => {
      state.assumingControlChatId = applyStateUpdate(next, state.assumingControlChatId);
    },
    setDeletingChatId: (next) => {
      state.deletingChatId = applyStateUpdate(next, state.deletingChatId);
    },
    setArchivedSectionOpen: (next) => {
      state.archivedSectionOpen = applyStateUpdate(next, state.archivedSectionOpen);
    },
    setSelectedChatId: (next) => {
      state.selectedChatId = applyStateUpdate(next, state.selectedChatId);
    },
    setChats: (next) => {
      state.chats = applyStateUpdate(next, state.chats);
    },
    upsertChatLocally: (chat) => mocks.upsertChatLocally(chat),
    loadChats: async (...args) => {
      await mocks.loadChats(...args);
    },
    refreshArchivedChatsCount: async () => {
      await mocks.refreshArchivedChatsCount();
    },
    buildChatsSignature: (chats) => chats.map((chat) => chat.id).join(','),
  };

  return { options, state, pendingChatInboxState };
};

const applyStateUpdate = <Value,>(update: SetStateAction<Value>, previous: Value) => (
  typeof update === 'function' ? (update as (value: Value) => Value)(previous) : update
);

test('arquivar selecionado aplica patch otimista, gira seleção e atualiza contagem', async () => {
  resetMocks();
  const activeChat = createChat('chat-1');
  const nextChat = createChat('chat-2');
  const { options, state, pendingChatInboxState } = createOptions({
    chats: [activeChat, nextChat],
    selectedChatId: activeChat.id,
  });
  mocks.updateInboxState.mockResolvedValue(createChat('chat-1', { is_archived: true }));
  mocks.refreshArchivedChatsCount.mockResolvedValue(undefined);
  let mutations!: ChatMutations;

  render(<Harness options={options} capture={(value) => { mutations = value; }} />);
  await act(async () => mutations.handleUpdateChatInboxState(activeChat, { isArchived: true }));

  assert.equal(state.selectedChatId, 'chat-2');
  assert.equal((mocks.upsertChatLocally.mock.calls[0]?.[0] as CommWhatsAppChat).is_archived, true);
  assert.equal((mocks.upsertChatLocally.mock.calls[1]?.[0] as CommWhatsAppChat).is_archived, true);
  assert.ok(pendingChatInboxState.has('chat-1'));
  assert.equal(mocks.refreshArchivedChatsCount.mock.calls.length, 1);
  assert.equal(state.updatingChatStateId, null);
  assert.equal(mocks.toastSuccess.mock.calls.length, 1);
});
test('desarquivar na seção arquivada volta para ativos sem perder a conversa selecionada', async () => {
  resetMocks();
  const archivedChat = createChat('chat-1', { is_archived: true });
  const { options, state } = createOptions({
    chats: [archivedChat],
    selectedChatId: archivedChat.id,
    archivedSectionOpen: true,
  });
  options.refs.archivedSectionOpenRef.current = true;
  mocks.updateInboxState.mockResolvedValue(createChat('chat-1', { is_archived: false }));
  mocks.refreshArchivedChatsCount.mockResolvedValue(undefined);
  let mutations!: ChatMutations;

  render(<Harness options={options} capture={(value) => { mutations = value; }} />);
  await act(async () => mutations.handleUpdateChatInboxState(archivedChat, { isArchived: false }));

  assert.equal(state.archivedSectionOpen, false);
  assert.equal(state.selectedChatId, 'chat-1');
  assert.equal(mocks.loadChats.mock.calls.length, 1);
  assert.deepEqual(mocks.loadChats.mock.calls[0]?.[0], { sections: ['active'] });
});

test('falha de atualização reverte patch otimista e limpa a intenção pendente', async () => {
  resetMocks();
  const chat = createChat('chat-1');
  const { options, pendingChatInboxState } = createOptions({ chats: [chat] });
  mocks.updateInboxState.mockRejectedValue(new Error('falha de rede'));
  let mutations!: ChatMutations;

  render(<Harness options={options} capture={(value) => { mutations = value; }} />);
  await act(async () => mutations.handleUpdateChatInboxState(chat, { isMuted: true }));

  assert.equal(mocks.upsertChatLocally.mock.calls.length, 2);
  assert.equal(mocks.upsertChatLocally.mock.calls[0]?.[0] && (mocks.upsertChatLocally.mock.calls[0][0] as CommWhatsAppChat).is_muted, true);
  assert.equal(mocks.upsertChatLocally.mock.calls[1]?.[0], chat);
  assert.equal(pendingChatInboxState.has('chat-1'), false);
  assert.equal(mocks.toastError.mock.calls.length, 1);
});

test('serializa duas ações concorrentes para o mesmo chat', async () => {
  resetMocks();
  const chat = createChat('chat-1');
  const { options } = createOptions({ chats: [chat] });
  let resolveUpdate!: (updatedChat: CommWhatsAppChat) => void;
  mocks.updateInboxState.mockReturnValue(new Promise<CommWhatsAppChat>((resolve) => { resolveUpdate = resolve; }));
  let mutations!: ChatMutations;

  render(<Harness options={options} capture={(value) => { mutations = value; }} />);
  await act(async () => {
    const first = mutations.handleUpdateChatInboxState(chat, { isMuted: true });
    const duplicate = mutations.handleUpdateChatInboxState(chat, { isPinned: true });
    assert.equal(mocks.updateInboxState.mock.calls.length, 1);
    resolveUpdate(chat);
    await Promise.all([first, duplicate]);
  });

  assert.equal(mocks.updateInboxState.mock.calls.length, 1);
});

test('excluir conversa selecionada remove da lista e escolhe outra ativa', async () => {
  resetMocks();
  const chat = createChat('chat-1');
  const nextChat = createChat('chat-2');
  const { options, state } = createOptions({ chats: [chat, nextChat], selectedChatId: chat.id });
  mocks.deleteChat.mockResolvedValue(chat);
  let mutations!: ChatMutations;

  render(<Harness options={options} capture={(value) => { mutations = value; }} />);
  await act(async () => mutations.handleDeleteChat(chat));

  assert.deepEqual(state.chats.map((item) => item.id), ['chat-2']);
  assert.equal(state.selectedChatId, 'chat-2');
  assert.equal(options.refs.chatsSignatureRef.current, 'chat-2');
  assert.equal(state.deletingChatId, null);
  assert.equal(mocks.toastSuccess.mock.calls.length, 1);
});
test('ativa atendimento autônomo e atualiza a conversa local', async () => {
  resetMocks();
  const chat = createChat('chat-1');
  const updatedChat = createChat('chat-1', { autonomous_attendance_status: 'active' });
  const { options, state } = createOptions({ chats: [chat] });
  mocks.setAutonomousAttendanceStatus.mockResolvedValue(updatedChat);
  let mutations!: ChatMutations;

  render(<Harness options={options} capture={(value) => { mutations = value; }} />);
  await act(async () => mutations.handleActivateAutonomousAttendance(chat));

  assert.equal(mocks.setAutonomousAttendanceStatus.mock.calls[0]?.[1], 'active');
  assert.equal(mocks.upsertChatLocally.mock.calls[0]?.[0], updatedChat);
  assert.equal(state.assumingControlChatId, null);
  assert.equal(mocks.toastSuccess.mock.calls.length, 1);
});
