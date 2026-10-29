import assert from 'node:assert/strict';
import { act, type ComponentProps } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import WhatsAppLeadDrawer from '../WhatsAppLeadDrawer';

const createProps = (onClose: () => void): ComponentProps<typeof WhatsAppLeadDrawer> => ({
  isOpen: true,
  presentation: 'sidebar',
  onClose,
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
    assert.match(panel.textContent ?? '', /Contato de demonstração/);
    assert.match(panel.textContent ?? '', /\+55 \(11\) 99999-9999/);
    assert.equal(document.querySelector('[role="dialog"]'), null);

    const closeButton = panel.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]');
    assert.ok(closeButton);
    act(() => closeButton.click());
    assert.equal(closeCalls.count, 1);
  } finally {
    view.unmount();
  }
});
