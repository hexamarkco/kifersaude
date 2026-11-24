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
  scheduledMessagesPanelOpen: false,
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
  onOpenScheduledMessages: noop,
  onToggleContactContextPanel: noop,
  onToggleThreadActionsMenu: noop,
});

test('organiza o nome no cabeçalho e o status e o lembrete na faixa de contexto', () => {
  const view = render(<WhatsAppThreadHeader {...createProps()} />);

  try {
    const header = view.container.querySelector('.whatsapp-inbox-thread-header');
    assert.ok(header);
    assert.equal(header.querySelector('.kds-avatar'), null);
    assert.match(header.textContent ?? '', /Gisele Goulart \(cliente\)/);
    const context = view.container.querySelector('[aria-label="Contexto da conversa"]');
    assert.ok(context);
    assert.match(context.textContent ?? '', /Reativação/);
    assert.match(context.textContent ?? '', /Próximo lembrete: conferir retorno sobre proposta/);
    assert.equal(header.textContent?.includes('Renomear contato'), false);
    assert.equal(header.textContent?.includes('IA atendendo'), false);
    assert.equal(header.textContent?.includes('Responsável:'), false);
  } finally {
    view.unmount();
  }
});

test('permite alterar o status do lead na faixa de contexto', () => {
  const changes: string[] = [];
  const view = render(
    <WhatsAppThreadHeader {...createProps()} onLeadStatusChange={(status) => changes.push(status)} />,
  );

  try {
    const header = view.container.querySelector('.whatsapp-inbox-thread-header');
    const name = header?.querySelector('h2');
    const context = view.container.querySelector('[aria-label="Contexto da conversa"]');
    const trigger = context?.querySelector<HTMLButtonElement>(
      '[aria-label="Alterar status do lead Gisele Goulart (cliente): Reativação"]',
    );
    assert.ok(name);
    assert.ok(trigger);
    assert.equal(header?.nextElementSibling, context);

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
