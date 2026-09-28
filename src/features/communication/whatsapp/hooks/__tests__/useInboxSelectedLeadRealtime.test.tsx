import assert from 'node:assert/strict';
import { act, type SetStateAction } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { Lead } from '../../../../leads';
import type { CommWhatsAppChat } from '../../domain/types';
import type { CommWhatsAppLeadPanel } from '../../data';
import { useInboxSelectedLeadRealtime } from '../useInboxSelectedLeadRealtime';

type LeadUpdate = (lead: Partial<Lead>) => void;
type SubscriptionStatus = (status: 'connected' | 'unavailable') => void;
type MockFunction = ((leadId: string, onUpdate: LeadUpdate, onStatus?: SubscriptionStatus) => () => void) & {
  mockReset: () => MockFunction;
  mockImplementationOnce: (implementation: (leadId: string, onUpdate: LeadUpdate, onStatus?: SubscriptionStatus) => () => void) => MockFunction;
  mock: { calls: unknown[][] };
};

const mocks = vi.hoisted(() => ({
  subscribeToInboxLead: vi.fn() as unknown as MockFunction,
}));

vi.mock('../../data', () => ({
  subscribeToInboxLead: mocks.subscribeToInboxLead,
}));

type SelectedLeadRealtimeOptions = Parameters<typeof useInboxSelectedLeadRealtime>[0];

const Harness = ({ options }: { options: SelectedLeadRealtimeOptions }) => {
  useInboxSelectedLeadRealtime(options);
  return null;
};

const createChat = (): CommWhatsAppChat => ({
  id: 'chat-1',
  channel_id: 'channel-1',
  external_chat_id: 'contact-1@s.whatsapp.net',
  is_group: false,
  phone_number: '+55 11 99999-9999',
  phone_digits: '5511999999999',
  display_name: 'Contato',
  lead_id: 'lead-1',
  lead_status: 'Anterior',
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
  unread_count: 0,
  status: 'open',
  autonomous_attendance_status: 'inactive',
  created_at: '2026-09-28T11:00:00.000Z',
  updated_at: '2026-09-28T12:00:00.000Z',
});

const applyStateUpdate = <Value,>(update: SetStateAction<Value>, previous: Value) => (
  typeof update === 'function' ? (update as (value: Value) => Value)(previous) : update
);

const createOptions = () => {
  const chat = createChat();
  const state = {
    leadPanel: { id: 'lead-1', nome_completo: 'Contato', telefone: '+55 11 99999-9999', status_nome: 'Anterior', status_value: 'Anterior' } as CommWhatsAppLeadPanel | null,
    panelReloads: [] as Array<CommWhatsAppChat | null>,
    chatUpdates: [] as CommWhatsAppChat[],
  };
  const options: SelectedLeadRealtimeOptions = {
    leadId: 'lead-1',
    leadStatuses: [{ id: 'status-1', nome: 'Novo' }],
    latestChatsRef: { current: [chat] },
    loadLeadPanel: async (targetChat) => { state.panelReloads.push(targetChat); },
    setLeadPanel: (update) => { state.leadPanel = applyStateUpdate(update, state.leadPanel); },
    upsertChatLocally: (updatedChat) => { state.chatUpdates.push(updatedChat); },
  };

  return { options, state, chat };
};

test('reflete status do lead no painel e na conversa, preserva aviso e limpa a assinatura realtime', () => {
  mocks.subscribeToInboxLead.mockReset();
  const context = createOptions();
  let onUpdate: LeadUpdate | null = null;
  let onStatus: SubscriptionStatus | undefined;
  let unsubscribeCalls = 0;
  const unsubscribe = () => { unsubscribeCalls += 1; };
  mocks.subscribeToInboxLead.mockImplementationOnce((_leadId, update, status) => {
    onUpdate = update;
    onStatus = status;
    return unsubscribe;
  });

  const view = render(<Harness options={context.options} />);
  assert.equal(mocks.subscribeToInboxLead.mock.calls[0]?.[0], 'lead-1');

  const originalWarn = console.warn;
  let warningCount = 0;
  console.warn = () => { warningCount += 1; };
  try {
    act(() => onUpdate?.({ id: 'lead-1', status: '  Em análise  ' }));
    assert.equal(context.state.leadPanel?.status_nome, 'Em análise');
    assert.equal(context.state.leadPanel?.status_value, 'Em análise');
    assert.equal(context.state.chatUpdates[0]?.lead_status, 'Em análise');

    act(() => onStatus?.('unavailable'));
    assert.equal(warningCount, 1);
  } finally {
    view.unmount();
    console.warn = originalWarn;
  }

  assert.equal(unsubscribeCalls, 1);
});

test('mapeia status_id ou recarrega o painel quando não há status conhecido', () => {
  mocks.subscribeToInboxLead.mockReset();
  const context = createOptions();
  let onUpdate: LeadUpdate | null = null;
  let unsubscribeCalls = 0;
  const unsubscribe = () => { unsubscribeCalls += 1; };
  mocks.subscribeToInboxLead.mockImplementationOnce((_leadId, update) => {
    onUpdate = update;
    return unsubscribe;
  });

  const view = render(<Harness options={context.options} />);
  act(() => onUpdate?.({ id: 'lead-1', status_id: 'status-1' }));
  assert.equal(context.state.leadPanel?.status_nome, 'Novo');
  assert.equal(context.state.chatUpdates[0]?.lead_status, 'Novo');

  act(() => onUpdate?.({ id: 'lead-1', status_id: 'unknown-status' }));
  assert.deepEqual(context.state.panelReloads, [context.chat]);
  view.unmount();
  assert.equal(unsubscribeCalls, 1);
});
