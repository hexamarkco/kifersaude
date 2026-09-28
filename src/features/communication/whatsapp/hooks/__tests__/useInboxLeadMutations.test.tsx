import assert from 'node:assert/strict';
import { act } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppChat } from '../../domain/types';
import { KeyedActionLock } from '../../components/keyedActionLock';
import { useInboxLeadMutations } from '../useInboxLeadMutations';

type MockFunction = ((...args: unknown[]) => unknown) & {
  mockReset: () => MockFunction;
  mockResolvedValue: (value: unknown) => MockFunction;
  mock: { calls: unknown[][] };
};

const mocks = vi.hoisted(() => {
  const createMock = () => vi.fn() as unknown as MockFunction;
  return {
    linkLead: createMock(),
    unlinkLead: createMock(),
    updateLeadStatus: createMock(),
    updateLeadResponsible: createMock(),
    clearAgenda: createMock(),
    toastSuccess: createMock(),
    toastError: createMock(),
  };
});

vi.mock('../../data', () => ({
  whatsappContactsRepository: {
    linkLead: mocks.linkLead,
    unlinkLead: mocks.unlinkLead,
    updateLeadStatus: mocks.updateLeadStatus,
    updateLeadResponsible: mocks.updateLeadResponsible,
  },
  clearInboxLeadAgenda: mocks.clearAgenda,
}));

vi.mock('../../../../../lib/toast', () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

type Mutations = ReturnType<typeof useInboxLeadMutations>;
type MutationOptions = Parameters<typeof useInboxLeadMutations>[0];

const Harness = ({ options, capture }: { options: MutationOptions; capture: (mutations: Mutations) => void }) => {
  capture(useInboxLeadMutations(options));
  return null;
};

const createChat = (): CommWhatsAppChat => ({
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
  last_message_direction: 'system',
  unread_count: 0,
  status: 'open',
  autonomous_attendance_status: 'inactive',
  created_at: '2026-09-28T12:00:00.000Z',
  updated_at: '2026-09-28T12:00:00.000Z',
});

const createOptions = () => {
  const chat = createChat();
  const leadPanel = {
    id: 'lead-1',
    nome_completo: 'Ana',
    telefone: '5511999999999',
    responsavel_value: 'agent-1',
  };
  const selectedChatIdRef = { current: chat.id as string | null };
  const leadMutationRequestIdRef = { current: 0 };
  const leadMutationLockRef = { current: new KeyedActionLock() };
  const calls: string[] = [];
  const reminders: unknown[] = [];
  const agendaSummaries: unknown[] = [];
  let mutationLoadingChatId: string | null = null;
  const options: MutationOptions = {
    selectedChat: chat,
    selectedChatIdRef,
    leadPanel,
    leadContracts: [],
    createLeadChatId: null,
    leadMutationLockRef,
    leadMutationRequestIdRef,
    setLeadMutationLoadingChatId: (updater) => {
      mutationLoadingChatId = typeof updater === 'function' ? updater(mutationLoadingChatId) : updater;
    },
    setLinkLoadingLeadId: () => undefined,
    closeCreateLeadDraft: () => calls.push('close-create-lead'),
    setSelectedChatId: (chatId) => calls.push(`select:${chatId}`),
    setLeadPanel: (lead) => calls.push(`lead:${lead?.id ?? 'none'}`),
    setLeadContracts: (contracts) => calls.push(`contracts:${contracts.length}`),
    setLeadContractsError: (message) => calls.push(`contracts-error:${message ?? 'none'}`),
    setLeadSearchQuery: (query) => calls.push(`lead-search:${query}`),
    setStatusReminderLead: (lead) => { reminders.push(lead); },
    setStatusReminderPromptMessage: (message) => calls.push(`reminder-prompt:${message}`),
    setChatAgendaSummary: (summary) => { agendaSummaries.push(summary); },
    upsertChatLocally: (updatedChat) => calls.push(`upsert:${updatedChat.id}`),
    loadLeadPanel: async () => { calls.push('reload-lead'); },
    loadChats: async () => { calls.push('reload-chats'); },
    loadChatAgendaSummary: async () => { calls.push('reload-agenda'); },
    isChatSendActive: () => false,
  };
  return { options, calls, reminders, agendaSummaries, selectedChatIdRef, leadMutationRequestIdRef, leadMutationLockRef, mutationLoadingChatId };
};

const resetMocks = () => {
  mocks.linkLead.mockReset();
  mocks.unlinkLead.mockReset();
  mocks.updateLeadStatus.mockReset();
  mocks.updateLeadResponsible.mockReset();
  mocks.clearAgenda.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.toastError.mockReset();
};

test('status de proposta solicita o primeiro lembrete e atualiza o contexto do lead', async () => {
  resetMocks();
  mocks.updateLeadStatus.mockResolvedValue(undefined);
  const state = createOptions();
  let mutations: Mutations | null = null;
  const view = render(<Harness options={state.options} capture={(value) => { mutations = value; }} />);

  try {
    assert.ok(mutations);
    await act(async () => { await mutations?.handleLeadStatusChange('lead-1', 'Proposta enviada'); });

    assert.deepEqual(mocks.updateLeadStatus.mock.calls[0]?.slice(0, 2), ['chat-1', 'Proposta enviada']);
    assert.deepEqual(state.reminders, [{
      id: 'lead-1',
      nome_completo: 'Ana',
      telefone: '5511999999999',
      responsavel: 'agent-1',
    }]);
    assert.ok(state.calls.some((call) => call.startsWith('reminder-prompt:')));
    assert.ok(state.calls.includes('reload-lead'));
    assert.ok(state.calls.includes('reload-chats'));
  } finally {
    view.unmount();
  }
});

test('status perdido limpa a agenda do lead e zera o resumo local', async () => {
  resetMocks();
  mocks.updateLeadStatus.mockResolvedValue(undefined);
  mocks.clearAgenda.mockResolvedValue(undefined);
  const state = createOptions();
  let mutations: Mutations | null = null;
  const view = render(<Harness options={state.options} capture={(value) => { mutations = value; }} />);

  try {
    assert.ok(mutations);
    await act(async () => { await mutations?.handleLeadStatusChange('lead-1', 'Perdido'); });

    assert.equal(mocks.clearAgenda.mock.calls[0]?.[0], 'lead-1');
    assert.deepEqual(state.agendaSummaries[0], { pendingCount: 0, nextReminder: null });
    assert.ok(state.calls.includes('reload-agenda'));
  } finally {
    view.unmount();
  }
});

test('não recarrega a lista de chats enquanto há envio ativo na conversa', async () => {
  resetMocks();
  mocks.updateLeadStatus.mockResolvedValue(undefined);
  const state = createOptions();
  state.options.isChatSendActive = () => true;
  let mutations: Mutations | null = null;
  const view = render(<Harness options={state.options} capture={(value) => { mutations = value; }} />);

  try {
    assert.ok(mutations);
    await act(async () => { await mutations?.handleLeadStatusChange('lead-1', 'Qualificado'); });

    assert.ok(state.calls.includes('reload-lead'));
    assert.ok(state.calls.includes('reload-agenda'));
    assert.equal(state.calls.includes('reload-chats'), false);
  } finally {
    view.unmount();
  }
});
