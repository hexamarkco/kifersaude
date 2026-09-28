import assert from 'node:assert/strict';
import { act, type SetStateAction } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppLeadContractSummary, CommWhatsAppLeadPanel } from '../../data';
import type { CommWhatsAppChat } from '../../domain/types';
import { useInboxLeadPanel } from '../useInboxLeadPanel';

type MockFunction = ((...args: unknown[]) => unknown) & {
  mockReset: () => MockFunction;
  mockResolvedValue: (value: unknown) => MockFunction;
  mockRejectedValue: (value: unknown) => MockFunction;
  mockReturnValue: (value: unknown) => MockFunction;
  mock: { calls: unknown[][] };
};

const mocks = vi.hoisted(() => ({
  getLeadPanel: vi.fn() as unknown as MockFunction,
  listLeadContracts: vi.fn() as unknown as MockFunction,
  upsertChatLocally: vi.fn() as unknown as MockFunction,
}));

const resetMocks = () => Object.values(mocks).forEach((mock) => mock.mockReset());

vi.mock('../../data', () => ({
  whatsappContactsRepository: {
    getLeadPanel: mocks.getLeadPanel,
    listLeadContracts: mocks.listLeadContracts,
  },
}));

type LeadPanelLoader = ReturnType<typeof useInboxLeadPanel>;
type LeadPanelOptions = Parameters<typeof useInboxLeadPanel>[0];

const Harness = ({ options, capture }: { options: LeadPanelOptions; capture: (loader: LeadPanelLoader) => void }) => {
  capture(useInboxLeadPanel(options));
  return null;
};

const createChat = (id = 'chat-1'): CommWhatsAppChat => ({
  id,
  channel_id: 'channel-1',
  external_chat_id: `${id}@s.whatsapp.net`,
  is_group: false,
  display_name: 'Contato',
  phone_number: '+55 11 99999-9999',
  phone_digits: '5511999999999',
  lead_id: 'lead-1',
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
  last_message_direction: 'outbound',
  unread_count: 0,
  status: 'open',
  autonomous_attendance_status: 'inactive',
  created_at: '2026-09-28T12:00:00.000Z',
  updated_at: '2026-09-28T12:00:00.000Z',
});

const createOptions = (chatId = 'chat-1') => {
  const state = {
    leadPanel: null as CommWhatsAppLeadPanel | null,
    leadPanelError: null as string | null,
    leadPanelLoading: false,
    leadContracts: [] as CommWhatsAppLeadContractSummary[],
    leadContractsError: null as string | null,
    leadContractsLoading: false,
    chats: [] as CommWhatsAppChat[],
  };
  const prefetchedNames = new Map<string, string>();
  const options: LeadPanelOptions = {
    refs: {
      leadPanelRequestIdRef: { current: 0 },
      leadContractsRequestIdRef: { current: 0 },
      selectedChatIdRef: { current: chatId },
      prefetchedLeadNameByPhoneRef: { current: prefetchedNames },
    },
    setLeadPanel: (next) => {
      state.leadPanel = applyStateUpdate(next, state.leadPanel);
    },
    setLeadPanelError: (next) => {
      state.leadPanelError = applyStateUpdate(next, state.leadPanelError);
    },
    setLeadPanelLoading: (next) => {
      state.leadPanelLoading = applyStateUpdate(next, state.leadPanelLoading);
    },
    setLeadContracts: (next) => {
      state.leadContracts = applyStateUpdate(next, state.leadContracts);
    },
    setLeadContractsError: (next) => {
      state.leadContractsError = applyStateUpdate(next, state.leadContractsError);
    },
    setLeadContractsLoading: (next) => {
      state.leadContractsLoading = applyStateUpdate(next, state.leadContractsLoading);
    },
    setChats: (next) => {
      state.chats = applyStateUpdate(next, state.chats);
    },
    applyFrontendSavedContactNames: (chats) => chats,
    applyPrefetchedLeadNames: (chats) => chats,
    upsertChatLocally: (chat) => mocks.upsertChatLocally(chat),
  };

  return { options, state, prefetchedNames };
};

const applyStateUpdate = <Value,>(update: SetStateAction<Value>, previous: Value) => (
  typeof update === 'function' ? (update as (value: Value) => Value)(previous) : update
);

test('carrega painel, hidrata o chat e atualiza os nomes de telefone em cache', async () => {
  resetMocks();
  const { options, state, prefetchedNames } = createOptions();
  const lead: CommWhatsAppLeadPanel = {
    id: 'lead-1',
    nome_completo: 'Lead Contato',
    telefone: '+55 11 99999-9999',
    status_value: 'Em atendimento',
  };
  mocks.getLeadPanel.mockResolvedValue(lead);
  mocks.listLeadContracts.mockResolvedValue([]);
  let loader!: LeadPanelLoader;

  render(<Harness options={options} capture={(value) => { loader = value; }} />);
  await act(async () => loader.loadLeadPanel(createChat()));

  assert.equal(state.leadPanel?.id, 'lead-1');
  assert.equal(state.leadPanelLoading, false);
  assert.equal(state.chats.length, 0);
  assert.equal(mocks.upsertChatLocally.mock.calls.length, 1);
  assert.equal((mocks.upsertChatLocally.mock.calls[0]?.[0] as CommWhatsAppChat).lead_name, 'Lead Contato');
  assert.ok([...prefetchedNames.values()].includes('Lead Contato'));
  assert.equal(mocks.listLeadContracts.mock.calls[0]?.[0], 'lead-1');
});

test('limpa painel e contratos para uma conversa sem lead', async () => {
  resetMocks();
  const { options, state } = createOptions();
  state.leadPanel = { id: 'old-lead', nome_completo: 'Antigo', telefone: '' };
  state.leadContractsError = 'erro anterior';
  state.leadContractsLoading = true;
  let loader!: LeadPanelLoader;

  render(<Harness options={options} capture={(value) => { loader = value; }} />);
  await act(async () => loader.loadLeadPanel({ ...createChat(), lead_id: null }));

  assert.equal(state.leadPanel, null);
  assert.equal(state.leadPanelError, null);
  assert.equal(state.leadPanelLoading, false);
  assert.deepEqual(state.leadContracts, []);
  assert.equal(state.leadContractsError, null);
  assert.equal(state.leadContractsLoading, false);
  assert.equal(mocks.getLeadPanel.mock.calls.length, 0);
});

test('exibe erro e limpa contratos se a carga do painel falhar', async () => {
  resetMocks();
  const { options, state } = createOptions();
  mocks.getLeadPanel.mockRejectedValue(new Error('falha de rede'));
  let loader!: LeadPanelLoader;

  render(<Harness options={options} capture={(value) => { loader = value; }} />);
  await act(async () => loader.loadLeadPanel(createChat()));

  assert.equal(state.leadPanel, null);
  assert.equal(state.leadPanelError, 'falha de rede');
  assert.deepEqual(state.leadContracts, []);
  assert.equal(state.leadContractsLoading, false);
  assert.equal(state.leadPanelLoading, false);
});

test('ignora resultado de contratos pertencente a uma request substituída', async () => {
  resetMocks();
  const { options, state } = createOptions();
  let resolveContracts!: (contracts: never[]) => void;
  mocks.listLeadContracts.mockReturnValue(new Promise<never[]>((resolve) => { resolveContracts = resolve; }));
  let loader!: LeadPanelLoader;

  render(<Harness options={options} capture={(value) => { loader = value; }} />);
  let request!: Promise<void>;
  act(() => { request = loader.loadLeadContracts('lead-1'); });
  options.refs.leadContractsRequestIdRef.current += 1;
  await act(async () => {
    resolveContracts([]);
    await request;
  });

  assert.equal(state.leadContractsLoading, true);
  assert.equal(state.leadContractsError, null);
});
