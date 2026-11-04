import assert from 'node:assert/strict';
import { act } from 'react';
import { test } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppChat } from '../../domain/types';
import { InboxChatListItem } from '../WhatsAppInboxList';

const createChat = (overrides: Partial<CommWhatsAppChat> = {}): CommWhatsAppChat => ({
  id: 'chat-1',
  channel_id: 'channel-1',
  external_chat_id: 'chat-1@s.whatsapp.net',
  is_group: false,
  phone_number: '5511999999999',
  phone_digits: '5511999999999',
  display_name: 'Contato de demonstração',
  lead_id: null,
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
  created_at: '2026-10-28T12:00:00.000Z',
  updated_at: '2026-10-28T12:00:00.000Z',
  ...overrides,
});

test('renders chat identity with initials and preserves independent selection and menu actions', () => {
  const selectedChatIds: string[] = [];
  const openedMenuChatIds: string[] = [];
  const view = render(
    <InboxChatListItem
      chat={createChat({ last_message_text: 'Olá', last_message_at: '2026-10-28T12:00:00.000Z', unread_count: 3 })}
      selected
      connectedUserName={null}
      draftPreview=""
      onSelect={(chatId) => selectedChatIds.push(chatId)}
      menuOpen={false}
      menuBusy={false}
      onToggleMenu={(chatId) => openedMenuChatIds.push(chatId)}
      onOpenContextMenu={() => undefined}
      menuTriggerRef={() => undefined}
    />,
  );

  try {
    assert.match(view.container.textContent ?? '', /Contato de demonstração/);
    assert.match(view.container.textContent ?? '', /Olá/);
    assert.equal(view.container.querySelector('.kds-avatar-initials')?.textContent, 'CD');
    assert.ok(view.container.querySelector('[aria-label="3 mensagens não lidas"]'));
    const selectButton = view.container.querySelector<HTMLButtonElement>('.whatsapp-inbox-chat-select');
    const menuButton = view.container.querySelector<HTMLButtonElement>('[aria-label="Abrir menu da conversa"]');
    assert.ok(selectButton);
    assert.ok(menuButton);
    assert.equal(selectButton.getAttribute('aria-current'), 'true');
    act(() => selectButton.click());
    act(() => menuButton.click());
    assert.deepEqual(selectedChatIds, ['chat-1']);
    assert.deepEqual(openedMenuChatIds, ['chat-1']);
  } finally {
    view.unmount();
  }
});
