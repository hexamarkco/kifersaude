import assert from 'node:assert/strict';
import { act, type ComponentProps } from 'react';
import { test, vi } from 'vitest';
import { FolderOpen } from 'lucide-react';

import { render } from '../../../../../testing-library/react';
import WhatsAppLeadDrawer from '../WhatsAppLeadDrawer';

vi.mock('../../../../leads', () => ({ LeadRelationshipsPanel: () => <div>Negociações em conjunto</div> }));

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
  conversationActions: [],
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
    assert.equal(panelHeader?.querySelector('h3')?.textContent, 'Contato de demonstração');
    assert.equal(panelHeader?.querySelector('.kds-avatar'), null);
    assert.match(panel.textContent ?? '', /Contato de demonstração/);
    assert.match(panel.textContent ?? '', /\+55 \(11\) 99999-9999/);
    assert.ok(panel.querySelector('button[aria-label="Fechar"]'));
    assert.ok(panel.querySelector('button[aria-label="Renomear contato"]'));
    assert.equal(panel.querySelector('[role="tab"]')?.textContent, 'Lead');
    assert.equal(panel.querySelectorAll('[role="tab"]').length, 2);
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
  let openFilesCalls = 0;
  props.conversationActions = [
    { label: 'Arquivos da conversa', compactLabel: 'Arquivos', icon: FolderOpen, onClick: () => { openFilesCalls += 1; } },
    { label: 'Recuperar histórico antigo', compactLabel: 'Histórico', icon: FolderOpen, disabled: true, title: 'Indisponível', onClick: () => { throw Error('Disabled action'); } },
  ];

  const view = render(<WhatsAppLeadDrawer {...props} />);

  try {
    const panel = document.querySelector('aside[aria-label="Informações do contato"]');
    assert.ok(panel);
    assert.match(panel.textContent ?? '', /\+55 \(11\) 99999-9999/);
    assert.match(panel.textContent ?? '', /SP · DDD 11/);
    assert.match(panel.textContent ?? '', /digitando…/);
    assert.match(panel.textContent ?? '', /IA atendendo/);
    const actions = panel.querySelector('[role="group"][aria-label="Ações da conversa"]');
    const filesButton = actions?.querySelector<HTMLButtonElement>('button[aria-label="Arquivos da conversa"]');
    assert.ok(filesButton);
    assert.equal(filesButton.textContent?.trim(), '');
    assert.ok(filesButton.classList.contains('kds-icon-button'));
    assert.ok(filesButton.querySelector('svg[aria-hidden="true"]'));
    const historyButton = actions?.querySelector<HTMLButtonElement>('button[aria-label="Recuperar histórico antigo"]');
    assert.ok(historyButton?.disabled);
    assert.equal(historyButton.getAttribute('aria-description'), 'Indisponível');
    assert.equal(historyButton.textContent?.trim(), '');
    act(() => historyButton.click());
    act(() => filesButton.click());
    assert.equal(openFilesCalls, 1);
    const renameButton = panel.querySelector<HTMLButtonElement>('button[aria-label="Renomear contato"]');
    assert.ok(renameButton);
    act(() => renameButton.click());
    assert.equal(saveContactNames[0], 'Contato salvo');
  } finally {
    view.unmount();
  }
});

test('coloca a agenda e seus controles em uma aba própria quando há acesso', async () => {
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

    const agendaTab = Array.from(document.querySelectorAll<HTMLButtonElement>('button[role="tab"]')).find((tab) => tab.textContent === 'Agenda');
    assert.ok(agendaTab);
    assert.equal(document.querySelector('section[aria-label="Agenda do chat"]'), null);
    act(() => agendaTab.click());
    assert.equal(agendaTab.getAttribute('aria-selected'), 'true');
    const agenda = document.querySelector('section[aria-label="Agenda do chat"]');
    assert.ok(agenda);
    assert.match(document.querySelector('.comm-whatsapp-lead-drawer-header')?.textContent ?? '', /Atendimento/);
    assert.ok(agenda.querySelector('button[aria-label="Sobre a agenda do chat"]'));
    assert.ok(agenda.querySelector('button[aria-label="Atualizar lembretes"]'));
    assert.match(agenda.textContent ?? '', /Agendar lembrete/);
  } finally {
    view.unmount();
  }
});
