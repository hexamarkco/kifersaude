import assert from 'node:assert/strict';
import { act, type ComponentProps } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import WhatsAppLeadDrawer from '../WhatsAppLeadDrawer';

vi.mock('../../../../reminders', async () => {
  const actual = await (vi as typeof vi & { importActual: <T>(path: string) => Promise<T> })
    .importActual<typeof import('../../../../reminders')>('../../../../reminders');
  return {
    ...actual,
    listRemindersForLeadContext: vi.fn(async () => ({ leadReminders: [], contractReminders: [] })),
    subscribeToReminderChanges: vi.fn(() => () => undefined),
    updateReminder: vi.fn(async () => undefined),
  };
});

const createProps = (onClose: () => void): ComponentProps<typeof WhatsAppLeadDrawer> => ({
  isOpen: true,
  presentation: 'sidebar',
  onClose,
  chat: {
    saved_contact_name: 'Contato de demonstração',
    presence_status: null,
    presence_last_seen_at: null,
    presence_updated_at: null,
    autonomous_attendance_status: 'inactive',
  },
  chatId: 'chat-1',
  chatDisplayName: 'Contato de demonstração',
  chatPhoneNumber: '5511999999999',
  linkedLead: null,
  leadPanelError: null,
  autoLinked: false,
  loading: false,
  contracts: [],
  contractsLoading: false,
  contractsError: null,
  statusOptions: [],
  responsavelOptions: [],
  leadMutationLoading: false,
  onStatusChange: vi.fn(async () => undefined),
  onResponsavelChange: vi.fn(async () => undefined),
  onRefreshContracts: vi.fn(),
  onViewLead: undefined,
  onUnlinkLead: undefined,
  searchQuery: '',
  onSearchQueryChange: vi.fn(),
  searchResults: [],
  searchError: null,
  suggestedLead: null,
  searchLoading: false,
  onRetryLeadPanel: vi.fn(),
  onRetrySearch: vi.fn(),
  onCreateLead: vi.fn(),
  onLinkLead: vi.fn(),
  linkLoadingLeadId: null,
  canViewAgenda: false,
  canEditAgenda: false,
  onSaveContact: vi.fn(),
});

test('renderiza informações do contato em uma lateral inline fechável, sem abrir um drawer modal', () => {
  const closeCalls = { count: 0 };
  const onClose = () => {
    closeCalls.count += 1;
  };
  const view = render(<WhatsAppLeadDrawer {...createProps(onClose)} />);

  try {
    const panel = document.querySelector('aside[aria-label="Informações do contato"]');
    assert.ok(panel);
    const panelHeader = panel.querySelector('.comm-whatsapp-lead-drawer-header');
    assert.equal(panelHeader?.querySelector('h2')?.textContent, 'Informações do contato');
    assert.match(panelHeader?.textContent ?? '', /Dados do contato, lead e próximos acompanhamentos/);
    assert.match(panelHeader?.textContent ?? '', /Contato do WhatsApp/);
    assert.ok(panelHeader?.querySelector('.kds-avatar.kds-avatar-md.kds-avatar-brand'));
    assert.match(panel.textContent ?? '', /Contato de demonstração/);
    assert.match(panel.textContent ?? '', /\+55 \(11\) 99999-9999/);
    assert.ok(panel.querySelector('button[aria-label="Fechar"]'));
    assert.match(panel.textContent ?? '', /Renomear contato/);
    const leadSearch = panel.querySelector<HTMLInputElement>('input[aria-label="Buscar lead por nome ou telefone"]');
    assert.equal(leadSearch?.placeholder, 'Nome ou telefone');
    assert.equal(document.querySelector('[role="dialog"]'), null);

    const closeButton = panel.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]');
    assert.ok(closeButton);
    act(() => closeButton.click());
    assert.equal(closeCalls.count, 1);
  } finally {
    view.unmount();
  }
});

test('mantém telefone, presença, renomeação e estado da IA nas informações do contato', () => {
  const props = createProps(() => undefined);
  props.chat = {
    saved_contact_name: 'Contato salvo',
    presence_status: 'typing',
    presence_last_seen_at: null,
    presence_updated_at: new Date().toISOString(),
    autonomous_attendance_status: 'active',
  };
  props.chatDisplayName = 'Nome exibido no chat';
  const saveContactNames: string[] = [];
  const onSaveContact = (name: string) => saveContactNames.push(name);
  props.onSaveContact = onSaveContact;

  const view = render(<WhatsAppLeadDrawer {...props} />);

  try {
    const panel = document.querySelector('aside[aria-label="Informações do contato"]');
    assert.ok(panel);
    assert.match(panel.textContent ?? '', /\+55 \(11\) 99999-9999/);
    assert.match(panel.textContent ?? '', /SP · DDD 11/);
    assert.match(panel.textContent ?? '', /digitando…/);
    assert.match(panel.textContent ?? '', /IA atendendo/);
    const renameButton = Array.from(panel.querySelectorAll('button')).find((button) => button.textContent?.includes('Renomear contato'));
    assert.ok(renameButton);
    act(() => renameButton.click());
    assert.equal(saveContactNames[0], 'Contato salvo');
  } finally {
    view.unmount();
  }
});

test('mantém a agenda legível na lateral estreita e coloca a explicação no ícone de informações', async () => {
  const props = createProps(() => undefined);
  props.linkedLead = {
    id: 'lead-1',
    nome_completo: 'Contato de demonstração',
    telefone: '5511999999999',
    status_nome: 'Atendimento',
  };
  props.canViewAgenda = true;
  props.canEditAgenda = true;

  const view = render(<WhatsAppLeadDrawer {...props} />);

  try {
    await act(async () => {
      await Promise.resolve();
    });

    const agendaHeading = Array.from(document.querySelectorAll('h3')).find((heading) => heading.textContent === 'Agenda do chat');
    assert.ok(agendaHeading);
    assert.match(document.querySelector('.comm-whatsapp-lead-drawer-header')?.textContent ?? '', /Atendimento/);
    const agendaHeader = agendaHeading.closest('.comm-whatsapp-chat-agenda-header');
    assert.ok(agendaHeader);
    assert.equal(agendaHeader.classList.contains('sm:flex-row'), false);
    assert.equal(agendaHeader.querySelector('button[aria-label="Sobre a agenda do chat"]') !== null, true);

    const agendaActions = agendaHeader.querySelector('.comm-whatsapp-chat-agenda-actions');
    assert.ok(agendaActions);
    assert.equal(agendaActions.classList.contains('grid-cols-2'), true);
    assert.match(agendaActions.textContent ?? '', /Agendar/);
    assert.match(agendaActions.textContent ?? '', /Atualizar/);
    assert.equal(document.body.textContent?.includes('Acompanhamento contextual'), false);
  } finally {
    view.unmount();
  }
});
