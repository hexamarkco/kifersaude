import assert from 'node:assert/strict';
import { act } from 'react';
import { test } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppChat } from '../../domain/types';
import { WhatsAppInboxLeadContextPanel } from '../WhatsAppInboxLeadContextPanel';

const createChat = (overrides: Partial<CommWhatsAppChat> = {}): CommWhatsAppChat => ({
  id: 'chat-1',
  channel_id: 'channel-1',
  external_chat_id: 'chat-1@s.whatsapp.net',
  is_group: false,
  phone_number: '5511999999999',
  phone_digits: '5511999999999',
  display_name: 'Contato de demonstração',
  lead_id: 'lead-1',
  lead_name: 'Contato de demonstração',
  lead_status: 'Atendimento',
  lead_responsavel: 'Operadora de demonstração',
  merged_into_chat_id: null,
  lead_link_source: 'manual',
  lead_linked_at: null,
  lead_linked_by: null,
  auto_link_blocked: false,
  identity_conflict: false,
  is_archived: false,
  is_muted: false,
  is_pinned: false,
  manual_unread: false,
  last_message_direction: 'inbound',
  last_message_at: '2026-10-25T12:00:00.000Z',
  unread_count: 0,
  status: 'open',
  autonomous_attendance_status: 'inactive',
  created_at: '2026-10-25T12:00:00.000Z',
  updated_at: '2026-10-25T12:00:00.000Z',
  ...overrides,
});

test('shows CRM context and opens the existing details flow', () => {
  let opened = 0;
  const view = render(
    <WhatsAppInboxLeadContextPanel
      selectedChat={createChat()}
      selectedChatDisplayName="Contato de demonstração"
      leadPanel={{
        id: 'lead-1',
        nome_completo: 'Contato de demonstração',
        telefone: '5511999999999',
        status_nome: 'Atendimento',
        responsavel_label: 'Operadora de demonstração',
      }}
      leadPanelLoading={false}
      leadPanelError={null}
      pendingReminderCount={2}
      onOpenLeadDrawer={() => { opened += 1; }}
      onOpenLeadInCrm={() => undefined}
    />,
  );

  try {
    const content = view.container.textContent ?? '';
    assert.match(content, /Atendimento/);
    assert.match(content, /Operadora de demonstração/);
    assert.match(content, /Lembretes pendentes/);

    const button = Array.from(view.container.querySelectorAll('button')).find((item) => item.textContent?.includes('Informações e agenda'));
    assert.ok(button);
    act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    assert.equal(opened, 1);
  } finally {
    view.unmount();
  }
});

test('keeps lead linking available for unlinked contacts and hides CRM actions for groups', () => {
  const opened: string[] = [];
  const unlinked = render(
    <WhatsAppInboxLeadContextPanel
      selectedChat={createChat({ lead_id: null, lead_status: null, lead_responsavel: null })}
      selectedChatDisplayName="Contato sem vínculo"
      leadPanel={null}
      leadPanelLoading={false}
      leadPanelError={null}
      pendingReminderCount={0}
      onOpenLeadDrawer={() => opened.push('link')}
    />,
  );

  try {
    const button = Array.from(unlinked.container.querySelectorAll('button')).find((item) => item.textContent?.includes('Vincular ou criar lead'));
    assert.ok(button);
    act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    assert.deepEqual(opened, ['link']);
  } finally {
    unlinked.unmount();
  }

  const group = render(
    <WhatsAppInboxLeadContextPanel
      selectedChat={createChat({ is_group: true, lead_id: null })}
      selectedChatDisplayName="Grupo de demonstração"
      leadPanel={null}
      leadPanelLoading={false}
      leadPanelError={null}
      pendingReminderCount={0}
      onOpenLeadDrawer={() => opened.push('group')}
    />,
  );

  try {
    assert.match(group.container.textContent ?? '', /Informações do grupo/);
    assert.equal(group.container.querySelector('button'), null);
  } finally {
    group.unmount();
  }
});
