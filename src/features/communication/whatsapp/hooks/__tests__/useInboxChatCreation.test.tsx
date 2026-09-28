import assert from 'node:assert/strict';
import { act } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppChat } from '../../domain/types';
import type { CommWhatsAppLeadSearchResult } from '../../data';
import { useInboxChatCreation } from '../useInboxChatCreation';

type MockFunction = ((...args: unknown[]) => unknown) & {
  mockReset: () => MockFunction;
  mockResolvedValue: (value: unknown) => MockFunction;
  mock: { calls: unknown[][] };
};

const mocks = vi.hoisted(() => {
  const createMock = () => vi.fn() as unknown as MockFunction;
  return {
    startChat: createMock(),
    findExistingChat: createMock(),
    toastSuccess: createMock(),
    toastError: createMock(),
  };
});

vi.mock('../../data', () => ({
  whatsappContactsRepository: {
    startChat: mocks.startChat,
    findExistingChat: mocks.findExistingChat,
  },
}));

vi.mock('../../../../../lib/toast', () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

type ChatCreation = ReturnType<typeof useInboxChatCreation>;
type ChatCreationOptions = Parameters<typeof useInboxChatCreation>[0];

const Harness = ({ options, capture }: {
  options: ChatCreationOptions;
  capture: (actions: ChatCreation) => void;
}) => {
  capture(useInboxChatCreation(options));
  return null;
};

const createChat = (id = 'chat-1'): CommWhatsAppChat => ({
  id,
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
  last_message_direction: 'system',
  unread_count: 0,
  status: 'open',
  autonomous_attendance_status: 'inactive',
  created_at: '2026-09-28T12:00:00.000Z',
  updated_at: '2026-09-28T12:00:00.000Z',
});

const createOptions = (chats: CommWhatsAppChat[] = []) => {
  const actions: string[] = [];
  const localChatsRef = { current: chats };
  let startingChatKey: string | null = null;
  let sharedContactActionKey: string | null = null;
  const options: ChatCreationOptions = {
    chats,
    latestChatsRef: localChatsRef,
    startingChatKey,
    manualStartPhone: '5511888888888',
    setStartingChatKey: (updater) => {
      startingChatKey = typeof updater === 'function' ? updater(startingChatKey) : updater;
      actions.push(`starting:${startingChatKey ?? 'idle'}`);
    },
    setSharedContactActionKey: (updater) => {
      sharedContactActionKey = typeof updater === 'function' ? updater(sharedContactActionKey) : updater;
      actions.push(`shared:${sharedContactActionKey ?? 'idle'}`);
    },
    setManualStartPhone: (value) => actions.push(`phone:${value}`),
    setSelectedChatId: (chatId) => actions.push(`selected:${chatId}`),
    setStartChatModalOpen: (isOpen) => actions.push(`modal:${isOpen}`),
    setSearchDraft: (value) => actions.push(`draft:${value}`),
    setSearch: (value) => actions.push(`search:${value}`),
    upsertChatLocally: (chat) => actions.push(`upsert:${chat.id}`),
  };
  return { options, actions };
};

const resetMocks = () => {
  mocks.startChat.mockReset();
  mocks.findExistingChat.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.toastError.mockReset();
};

test('abre o chat local do lead da agenda sem criar uma conversa duplicada', async () => {
  resetMocks();
  const chat = createChat();
  const state = createOptions([chat]);
  let actions: ChatCreation | null = null;
  const view = render(<Harness options={state.options} capture={(value) => { actions = value; }} />);

  try {
    assert.ok(actions);
    await act(async () => {
      await actions?.handleOpenAgendaLeadChat({
        id: 'lead-1',
        nome_completo: 'Ana',
        telefone: '5511999999999',
      });
    });

    assert.deepEqual(state.actions, ['selected:chat-1']);
    assert.equal(mocks.findExistingChat.mock.calls.length, 0);
    assert.equal(mocks.startChat.mock.calls.length, 0);
  } finally {
    view.unmount();
  }
});

test('inicia conversa de lead usando somente a API de início de chat e seleciona o resultado', async () => {
  resetMocks();
  const chat = createChat('chat-crm');
  mocks.startChat.mockResolvedValue({ chat });
  const state = createOptions();
  let actions: ChatCreation | null = null;
  const view = render(<Harness options={state.options} capture={(value) => { actions = value; }} />);
  const lead: CommWhatsAppLeadSearchResult = {
    id: 'lead-1',
    nome_completo: 'Ana',
    telefone: '5511999999999',
  };

  try {
    assert.ok(actions);
    await act(async () => { await actions?.handleStartChatFromLead(lead); });

    assert.deepEqual(mocks.startChat.mock.calls[0]?.[0], { source: 'crm', leadId: 'lead-1' });
    assert.ok(state.actions.includes('upsert:chat-crm'));
    assert.ok(state.actions.includes('selected:chat-crm'));
    assert.ok(state.actions.includes('modal:false'));
    assert.equal(mocks.toastSuccess.mock.calls.length, 1);
  } finally {
    view.unmount();
  }
});

test('inicia chat manual sem transformar esse fluxo em envio de mensagem', async () => {
  resetMocks();
  const chat = createChat('chat-manual');
  mocks.startChat.mockResolvedValue({ chat });
  const state = createOptions();
  let actions: ChatCreation | null = null;
  const view = render(<Harness options={state.options} capture={(value) => { actions = value; }} />);

  try {
    assert.ok(actions);
    await act(async () => { await actions?.handleStartChatFromManual(); });

    assert.deepEqual(mocks.startChat.mock.calls[0]?.[0], { source: 'manual', phoneNumber: '5511888888888' });
    assert.ok(state.actions.includes('phone:'));
    assert.ok(state.actions.includes('selected:chat-manual'));
    assert.equal(mocks.toastSuccess.mock.calls.length, 1);
  } finally {
    view.unmount();
  }
});
