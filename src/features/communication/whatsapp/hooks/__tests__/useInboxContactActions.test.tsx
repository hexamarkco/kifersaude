import assert from 'node:assert/strict';
import { act, useState } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppChat } from '../../domain/types';
import { useInboxContactActions } from '../useInboxContactActions';

type MockFunction = ((...args: unknown[]) => unknown) & {
  mockReset: () => MockFunction;
  mockResolvedValue: (value: unknown) => MockFunction;
  mockResolvedValueOnce: (value: unknown) => MockFunction;
  mockRejectedValueOnce: (value: unknown) => MockFunction;
  mockReturnValueOnce: (value: unknown) => MockFunction;
  mockImplementation: (implementation: (...args: unknown[]) => unknown) => MockFunction;
  mock: { calls: unknown[][] };
};

const mocks = vi.hoisted(() => ({
  save: vi.fn() as unknown as MockFunction,
  rename: vi.fn() as unknown as MockFunction,
  refresh: vi.fn() as unknown as MockFunction,
  remember: vi.fn() as unknown as MockFunction,
  loadChats: vi.fn() as unknown as MockFunction,
  toastError: vi.fn() as unknown as MockFunction,
  toastSuccess: vi.fn() as unknown as MockFunction,
}));

vi.mock('../../data', () => ({
  whatsappContactsRepository: {
    save: mocks.save,
    rename: mocks.rename,
  },
}));

vi.mock('../../../../../lib/toast', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

const chat = (savedContactName: string | null = null): CommWhatsAppChat => ({
  id: 'chat-1',
  channel_id: 'channel-1',
  external_chat_id: '5511999999999@s.whatsapp.net',
  is_group: false,
  phone_number: '5511999999999',
  phone_digits: '5511999999999',
  display_name: 'Contato',
  saved_contact_name: savedContactName,
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
  created_at: '2026-09-28T12:00:00.000Z',
  updated_at: '2026-09-28T12:00:00.000Z',
});

type ContactActions = ReturnType<typeof useInboxContactActions>;
let actions: ContactActions;

const Harness = ({ savedContactName = null }: { savedContactName?: string | null }) => {
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(true);
  const [sharedActionKey, setSharedActionKey] = useState<string | null>(null);
  actions = useInboxContactActions({
    selectedChat: chat(),
    selectedChatForPresentation: chat(savedContactName),
    saveContactName: '  Nome atualizado  ',
    setSavingContact: setSaving,
    setSaveContactDialogOpen: setDialogOpen,
    setSharedContactActionKey: setSharedActionKey,
    startChatQuery: 'Busca',
    refreshStartChatSources: async (...args) => { mocks.refresh(...args); },
    rememberManualSavedContactName: (phone, name) => { mocks.remember(phone, name); },
    loadChats: async () => { mocks.loadChats(); },
  });

  return (
    <>
      <output data-testid="snapshot">{JSON.stringify({ saving, dialogOpen, sharedActionKey })}</output>
      <button data-testid="save-phonebook" onClick={() => void actions.handleSaveContactToPhonebook()}>Save phonebook</button>
      <button data-testid="save-shared" onClick={() => void actions.handleSaveSharedContact({
        name: '  Contato compartilhado  ',
        phoneNumber: '  +55 11 98888-7777  ',
      })}>Save shared</button>
      <button data-testid="invalid-shared" onClick={() => void actions.handleSaveSharedContact({ name: ' ', phoneNumber: null })}>Invalid</button>
    </>
  );
};

const readSnapshot = (container: HTMLElement) => {
  const content = container.querySelector('[data-testid="snapshot"]')?.textContent;
  assert.ok(content);
  return JSON.parse(content) as { saving: boolean; dialogOpen: boolean; sharedActionKey: string | null };
};

const click = (container: HTMLElement, testId: string) => {
  const button = container.querySelector(`[data-testid="${testId}"]`);
  assert.ok(button);
  act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
};

const resetMocks = () => {
  mocks.save.mockReset();
  mocks.rename.mockReset();
  mocks.refresh.mockReset();
  mocks.remember.mockReset();
  mocks.loadChats.mockReset();
  mocks.toastError.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.save.mockResolvedValue(undefined);
  mocks.rename.mockResolvedValue(undefined);
  mocks.refresh.mockResolvedValue(undefined);
  mocks.loadChats.mockResolvedValue(undefined);
};

test('valida e salva contatos compartilhados, sincronizando identidade e fontes do novo chat', async () => {
  resetMocks();
  const view = render(<Harness />);

  click(view.container, 'invalid-shared');
  assert.deepEqual(mocks.toastError.mock.calls[0], ['O contato compartilhado precisa de um nome para ser salvo.']);
  assert.equal(mocks.save.mock.calls.length, 0);

  click(view.container, 'save-shared');
  await act(async () => Promise.resolve());
  assert.deepEqual(mocks.save.mock.calls[0], [{ phoneNumber: '+55 11 98888-7777', displayName: 'Contato compartilhado' }]);
  assert.deepEqual(mocks.remember.mock.calls[0], ['+55 11 98888-7777', 'Contato compartilhado']);
  assert.deepEqual(mocks.refresh.mock.calls[0], ['Busca', 1, false]);
  assert.equal(mocks.loadChats.mock.calls.length, 1);
  assert.equal(readSnapshot(view.container).sharedActionKey, null);
  assert.equal(mocks.toastSuccess.mock.calls.length, 1);
  view.unmount();
});

test('salva ou renomeia o contato pelo estado persistido e atualiza a apresentação', async () => {
  resetMocks();
  const newContactView = render(<Harness />);
  click(newContactView.container, 'save-phonebook');
  await act(async () => Promise.resolve());
  assert.deepEqual(mocks.save.mock.calls[0], [{ phoneNumber: '5511999999999', displayName: 'Nome atualizado' }]);
  assert.deepEqual(mocks.remember.mock.calls[0], ['5511999999999', 'Nome atualizado']);
  assert.equal(readSnapshot(newContactView.container).dialogOpen, false);
  assert.equal(readSnapshot(newContactView.container).saving, false);
  newContactView.unmount();

  resetMocks();
  const renameView = render(<Harness savedContactName="Nome anterior" />);
  click(renameView.container, 'save-phonebook');
  await act(async () => Promise.resolve());
  assert.deepEqual(mocks.rename.mock.calls[0], [{ phoneNumber: '5511999999999', displayName: 'Nome atualizado' }]);
  assert.equal(mocks.save.mock.calls.length, 0);
  assert.equal(mocks.refresh.mock.calls.length, 1);
  assert.equal(mocks.loadChats.mock.calls.length, 1);
  renameView.unmount();
});

test('a trava evita duplicidade e é liberada mesmo quando a gravação falha', async () => {
  resetMocks();
  const originalConsoleError = console.error;
  console.error = () => undefined;
  try {
    let resolveSave!: () => void;
    mocks.save
      .mockReturnValueOnce(new Promise<void>((resolve) => { resolveSave = resolve; }))
      .mockRejectedValueOnce(new Error('Falha ao salvar'));
    const view = render(<Harness />);

    let firstSave!: Promise<void>;
    await act(async () => {
      firstSave = actions.handleSaveContactToPhonebook();
    });
    assert.equal(readSnapshot(view.container).saving, true);
    await act(async () => actions.handleSaveContactToPhonebook());
    assert.equal(mocks.save.mock.calls.length, 1);
    resolveSave();
    await act(async () => firstSave);

    await act(async () => actions.handleSaveContactToPhonebook());
    assert.equal(mocks.save.mock.calls.length, 2);
    assert.deepEqual(mocks.toastError.mock.calls[0], ['Falha ao salvar']);
    assert.equal(readSnapshot(view.container).saving, false);
    view.unmount();
  } finally {
    console.error = originalConsoleError;
  }
});
