import assert from 'node:assert/strict';
import { act, createRef, type ComponentProps } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppChat } from '../../domain/types';
import { WhatsAppThreadActionsMenu } from '../WhatsAppThreadActionsMenu';

type Spy = {
  (...args: unknown[]): unknown;
  mock: { calls: unknown[][] };
};

const createSpy = (): Spy => vi.fn() as Spy;

const createChat = (overrides: Partial<CommWhatsAppChat> = {}): CommWhatsAppChat => ({
  id: 'chat-1',
  channel_id: 'channel-1',
  external_chat_id: 'chat-1@s.whatsapp.net',
  is_group: false,
  phone_number: '5511999999999',
  phone_digits: '5511999999999',
  display_name: 'Contato',
  saved_contact_name: null,
  push_name: null,
  lead_id: 'lead-1',
  lead_name: 'Lead',
  lead_status: null,
  lead_responsavel_id: null,
  lead_responsavel: null,
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
  last_message_text: null,
  last_message_direction: 'inbound',
  last_message_at: null,
  last_message_delivery_status: null,
  unread_count: 0,
  status: 'open',
  autonomous_attendance_status: 'active',
  last_read_at: null,
  deleted_at: null,
  created_at: '2026-09-28T12:00:00.000Z',
  updated_at: '2026-09-28T12:00:00.000Z',
  ...overrides,
});

const createProps = (selectedChat: CommWhatsAppChat) => {
  const spies = {
    setOpen: createSpy(),
    onToggleAutonomousAttendance: createSpy(),
    onOpenChatFiles: createSpy(),
    onToggleChatMessageSearch: createSpy(),
    onOpenScheduledMessages: createSpy(),
    onCopyTranscript: createSpy(),
    onRecoverHistory: createSpy(),
    onOpenFollowUp: createSpy(),
    onOpenLeadDrawer: createSpy(),
  };
  const props: ComponentProps<typeof WhatsAppThreadActionsMenu> = {
    menuRef: createRef<HTMLDivElement>(),
    isOpen: true,
    position: { top: 0, left: 0, width: 288, maxHeight: 400 },
    selectedChat,
    setOpen: spies.setOpen,
    assumingControlChatId: null,
    isSelectedChatWaitingForQuote: false,
    copyingTranscript: false,
    historyRecoveryDisabledReason: null,
    syncingHistoryChatId: null,
    followUpGenerationDisabledReason: null,
    generatingFollowUp: false,
    onToggleAutonomousAttendance: spies.onToggleAutonomousAttendance,
    onOpenChatFiles: spies.onOpenChatFiles,
    onToggleChatMessageSearch: spies.onToggleChatMessageSearch,
    onOpenScheduledMessages: spies.onOpenScheduledMessages,
    onCopyTranscript: spies.onCopyTranscript,
    onRecoverHistory: spies.onRecoverHistory,
    onOpenFollowUp: spies.onOpenFollowUp,
    onOpenLeadDrawer: spies.onOpenLeadDrawer,
  };
  return { props, spies };
};

const getMenu = () => {
  const menu = document.body.querySelector('[aria-label="Ações da conversa"]');
  assert.ok(menu instanceof HTMLDivElement);
  return menu;
};

const getMenuItem = (menu: HTMLDivElement, label: string) => {
  const item = Array.from(menu.querySelectorAll('button')).find((button) => button.textContent?.includes(label));
  assert.ok(item instanceof HTMLButtonElement);
  return item;
};

test('disponibiliza ações de CRM em chats individuais e fecha o menu antes de executá-las', () => {
  const { props, spies } = createProps(createChat());
  const view = render(<WhatsAppThreadActionsMenu {...props} />);

  try {
    const menu = getMenu();
    const followUpItem = getMenuItem(menu, 'Gerar follow-up com IA');
    const attendanceItem = getMenuItem(menu, 'Desativar IA neste chat');

    act(() => followUpItem.click());
    act(() => attendanceItem.click());

    assert.equal(spies.onOpenFollowUp.mock.calls.length, 1);
    assert.deepEqual(spies.onToggleAutonomousAttendance.mock.calls, [[props.selectedChat]]);
    assert.deepEqual(spies.setOpen.mock.calls, [[false], [false]]);
  } finally {
    view.unmount();
  }
});

test('oculta ações de lead e IA para conversas em grupo', () => {
  const { props } = createProps(createChat({ is_group: true, lead_id: null }));
  const view = render(<WhatsAppThreadActionsMenu {...props} />);

  try {
    const menu = getMenu();
    assert.equal(menu.textContent?.includes('Gerar follow-up com IA'), false);
    assert.equal(menu.textContent?.includes('Vincular lead do CRM'), false);
    assert.equal(menu.textContent?.includes('Ativar IA neste chat'), false);
    assert.ok(getMenuItem(menu, 'Arquivos da conversa'));
  } finally {
    view.unmount();
  }
});
