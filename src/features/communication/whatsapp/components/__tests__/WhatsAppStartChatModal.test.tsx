import assert from 'node:assert/strict';
import { act } from 'react';
import { render } from '../../../../../testing-library/react';
import { test } from 'vitest';

import WhatsAppStartChatModal from '../WhatsAppStartChatModal';
import type { CommWhatsAppPhoneContact } from '../../domain/types';
import type { CommWhatsAppLeadSearchResult } from '../../data';
import type { LeadStatusConfig } from '../../../../leads';

type StartChatModalProps = Parameters<typeof WhatsAppStartChatModal>[0];

const contact: CommWhatsAppPhoneContact = {
  id: 'contact-1',
  channel_id: 'channel-1',
  contact_id: 'provider-contact-1',
  phone_number: '+55 21 99999-1234',
  phone_digits: '5521999991234',
  display_name: 'Camila Demonstração',
  saved: true,
  last_synced_at: '2026-10-29T12:00:00Z',
  created_at: '2026-10-29T12:00:00Z',
  updated_at: '2026-10-29T12:00:00Z',
};

const lead: CommWhatsAppLeadSearchResult = {
  id: 'lead-1',
  nome_completo: 'Mateus Demonstração',
  telefone: '+55 21 98888-5678',
  status_nome: 'Contato inicial',
  responsavel_label: 'Equipe comercial',
  favorito: false,
};

const status: LeadStatusConfig = {
  id: 'status-1',
  nome: 'Contato inicial',
  cor: 'var(--brand-primary)',
  ordem: 1,
  ativo: true,
  padrao: true,
  created_at: '2026-10-29T12:00:00Z',
  updated_at: '2026-10-29T12:00:00Z',
};

const createProps = (overrides: Partial<StartChatModalProps> = {}): StartChatModalProps => ({
  isOpen: true,
  onClose: () => undefined,
  query: '',
  onQueryChange: () => undefined,
  contacts: [],
  contactsTotal: 0,
  contactsHasMore: false,
  contactsLoading: false,
  contactsLoadingMore: false,
  onLoadMoreContacts: () => undefined,
  loadError: null,
  onRetry: () => undefined,
  crmLeads: [],
  crmLoading: false,
  statusOptions: [status],
  onStartFromSavedContact: () => undefined,
  onStartFromLead: () => undefined,
  manualPhone: '',
  onManualPhoneChange: () => undefined,
  onStartFromManual: () => undefined,
  startingKey: null,
  ...overrides,
});

const buttonWithText = (text: string | RegExp): HTMLButtonElement | undefined => (
  Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find((button) => (
    typeof text === 'string' ? button.textContent?.trim() === text : text.test(button.textContent ?? '')
  ))
);

const click = (button: HTMLButtonElement | undefined) => {
  assert.ok(button, 'botão esperado não foi encontrado');
  act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
};

test('empty contact state offers the real CRM and manual-number paths', () => {
  const view = render(<WhatsAppStartChatModal {...createProps()} />);

  try {
    assert.equal(document.querySelector('[role="tablist"]')?.getAttribute('aria-label'), 'Origem do novo chat');
    assert.ok(buttonWithText('Contatos'));
    assert.ok(document.querySelector('[role="dialog"]')?.textContent?.includes('Nenhum contato salvo'));
    click(buttonWithText('Buscar no CRM'));
    assert.ok(document.querySelector('input[placeholder="Buscar em leads do crm"]'));
    click(buttonWithText('Usar número'));
    assert.ok(document.querySelector('input[placeholder="Ex.: 21999999999"]'));
  } finally {
    view.unmount();
  }
});

test('saved contact action starts the selected contact without mutating modal data', () => {
  const startedContacts: CommWhatsAppPhoneContact[] = [];
  const view = render(<WhatsAppStartChatModal {...createProps({
    contacts: [contact],
    contactsTotal: 1,
    onStartFromSavedContact: (selectedContact) => startedContacts.push(selectedContact),
  })} />);

  try {
    click(buttonWithText(/Camila Demonstração/));
    assert.deepEqual(startedContacts, [contact]);
  } finally {
    view.unmount();
  }
});

test('CRM lead action keeps its status and owner context and starts only the selected lead', () => {
  const startedLeads: CommWhatsAppLeadSearchResult[] = [];
  const view = render(<WhatsAppStartChatModal {...createProps({
    crmLeads: [lead],
    onStartFromLead: (selectedLead) => startedLeads.push(selectedLead),
  })} />);

  try {
    click(buttonWithText('CRM'));
    assert.ok(document.querySelector('[role="dialog"]')?.textContent?.includes('Contato inicial'));
    assert.ok(document.querySelector('[role="dialog"]')?.textContent?.includes('Equipe comercial'));
    click(buttonWithText(/Mateus Demonstração/));
    assert.deepEqual(startedLeads, [lead]);
  } finally {
    view.unmount();
  }
});

test('manual number flow remains actionable and delegates its phone value to the caller', () => {
  const changedPhones: string[] = [];
  let starts = 0;
  const view = render(<WhatsAppStartChatModal {...createProps({
    onManualPhoneChange: (phone) => changedPhones.push(phone),
    onStartFromManual: () => { starts++; },
  })} />);

  try {
    click(buttonWithText('Número'));
    const phoneInput = document.querySelector<HTMLInputElement>('input[placeholder="Ex.: 21999999999"]');
    assert.ok(phoneInput);
    act(() => {
      const setNativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setNativeValue?.call(phoneInput, '21999991234');
      phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    click(buttonWithText(/Iniciar chat/));

    assert.deepEqual(changedPhones, ['21999991234']);
    assert.equal(starts, 1);
  } finally {
    view.unmount();
  }
});

test('loading state is announced through the shared design-system component', () => {
  const view = render(<WhatsAppStartChatModal {...createProps({ contactsLoading: true })} />);

  try {
    assert.ok(document.querySelector('[role="status"]')?.textContent?.includes('Carregando contatos salvos'));
  } finally {
    view.unmount();
  }
});
