import assert from 'node:assert/strict';
import { act, createRef, type ComponentProps } from 'react';
import { test } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppChat } from '../../domain/types';
import { WhatsAppThreadHeader } from '../WhatsAppThreadHeader';

const noop = () => undefined;

const createProps = (): ComponentProps<typeof WhatsAppThreadHeader> => ({
  selectedChat: {
    is_group: false,
    lead_id: 'lead-1',
    autonomous_attendance_status: 'active',
  } as CommWhatsAppChat,
  selectedChatDisplayName: 'Gisele Goulart (cliente)',
  leadStatus: 'Reativação',
  leadStatusOptions: [
    { value: 'Reativação', label: 'Reativação', color: 'var(--accent-gold)' },
    { value: 'Proposta Enviada', label: 'Proposta Enviada', color: 'var(--brand-primary)' },
  ],
  leadStatusUpdating: false,
  leadStatusDisabled: false,
  onLeadStatusChange: noop,
  copyingTranscript: false,
  threadActionsMenuOpen: false,
  contactContextPanelOpen: false,
  threadActionsMenuTriggerRef: createRef<HTMLButtonElement>(),
  chatAgendaSummary: {
    pendingCount: 1,
    nextReminder: { data_lembrete: '2026-10-30T14:30:00-03:00' },
  },
  nextChatReminderSummary: 'Próximo lembrete: conferir retorno sobre proposta · 30/10/2026 às 14:30',
  chatAgendaSummaryError: null,
  onBack: noop,
  onCopyTranscript: noop,
  onToggleContactContextPanel: noop,
  onToggleThreadActionsMenu: noop,
});

test('mostra o status ao lado do nome, o lembrete abaixo e dois atalhos para chats individuais', () => {
  let copyCalls = 0;
  const view = render(<WhatsAppThreadHeader {...createProps()} onCopyTranscript={() => { copyCalls += 1; }} />);

  try {
    const header = view.container.querySelector('.whatsapp-inbox-thread-header');
    assert.ok(header);
    assert.equal(header.querySelector('.kds-avatar'), null);
    assert.match(header.textContent ?? '', /Gisele Goulart \(cliente\)/);
    const nameRow = header.querySelector('.whatsapp-inbox-thread-name');
    assert.match(nameRow?.textContent ?? '', /Reativação/);
    assert.match(nameRow?.nextElementSibling?.textContent ?? '', /Próximo lembrete: conferir retorno sobre proposta/);
    assert.equal(header.nextElementSibling, null);
    const actions = [...header.querySelectorAll<HTMLButtonElement>('.whatsapp-inbox-thread-actions button')];
    assert.deepEqual(actions.map((button) => button.getAttribute('aria-label')), [
      'Copiar conversa formatada',
      'Abrir informações do contato',
    ]);
    act(() => actions[0].click());
    assert.equal(copyCalls, 1);
  } finally {
    view.unmount();
  }
});

test('permite alterar o status do lead ao lado do nome', () => {
  const changes: string[] = [];
  const view = render(
    <WhatsAppThreadHeader {...createProps()} onLeadStatusChange={(status) => changes.push(status)} />,
  );

  try {
    const header = view.container.querySelector('.whatsapp-inbox-thread-header');
    const name = header?.querySelector('h2');
    const nameRow = name?.parentElement;
    const trigger = nameRow?.querySelector<HTMLButtonElement>(
      '[aria-label="Alterar status do lead Gisele Goulart (cliente): Reativação"]',
    );
    assert.ok(name);
    assert.ok(trigger);

    act(() => trigger.click());
    const option = document.body.querySelector<HTMLButtonElement>(
      '[role="listbox"][aria-label="Alterar status do lead"] [role="option"]:last-child',
    );
    assert.ok(option);
    act(() => option.click());
    assert.deepEqual(changes, ['Proposta Enviada']);
  } finally {
    view.unmount();
  }
});

test('não mostra seletor para grupo ou conversa sem lead vinculado', () => {
  for (const selectedChat of [
    { ...createProps().selectedChat, lead_id: null },
    { ...createProps().selectedChat, is_group: true },
  ]) {
    const view = render(<WhatsAppThreadHeader {...createProps()} selectedChat={selectedChat} />);
    try {
      assert.equal(view.container.querySelector('[aria-label^="Alterar status do lead"]'), null);
    } finally {
      view.unmount();
    }
  }
});

test('desabilita o seletor durante o carregamento ou uma mutação', () => {
  for (const state of [{ leadStatusDisabled: true }, { leadStatusUpdating: true }]) {
    const view = render(<WhatsAppThreadHeader {...createProps()} {...state} />);
    try {
      const trigger = view.container.querySelector<HTMLButtonElement>(
        '[aria-label^="Alterar status do lead"]',
      );
      assert.ok(trigger);
      assert.equal(trigger.disabled, true);
    } finally {
      view.unmount();
    }
  }
});
