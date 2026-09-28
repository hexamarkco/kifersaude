import assert from 'node:assert/strict';
import { act, useState } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../../domain/types';
import { useInboxMessageForwarding } from '../useInboxMessageForwarding';

type MockFunction = ((...args: unknown[]) => unknown) & {
  mockReset: () => MockFunction;
  mockResolvedValue: (value: unknown) => MockFunction;
  mockResolvedValueOnce: (value: unknown) => MockFunction;
  mockRejectedValueOnce: (value: unknown) => MockFunction;
  mock: { calls: unknown[][] };
};

const mocks = vi.hoisted(() => ({
  forward: vi.fn() as unknown as MockFunction,
  loadChats: vi.fn() as unknown as MockFunction,
  loadMessages: vi.fn() as unknown as MockFunction,
  closeMenu: vi.fn() as unknown as MockFunction,
  toastError: vi.fn() as unknown as MockFunction,
  toastSuccess: vi.fn() as unknown as MockFunction,
}));

vi.mock('../../data', () => ({
  whatsappMessagesRepository: { forwardToChats: mocks.forward },
}));

vi.mock('../../../../../lib/toast', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

const chat = (id: string): CommWhatsAppChat => ({
  id,
  channel_id: 'channel-1',
  external_chat_id: `${id}@s.whatsapp.net`,
  is_group: false,
  phone_number: '5511999999999',
  phone_digits: '5511999999999',
  display_name: id,
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

const message = (overrides: Partial<CommWhatsAppMessage> = {}): CommWhatsAppMessage => ({
  id: 'message-1',
  chat_id: 'chat-1',
  channel_id: 'channel-1',
  external_message_id: 'external-1',
  direction: 'outbound',
  message_type: 'text',
  delivery_status: 'sent',
  text_content: 'Mensagem',
  message_at: '2026-09-28T12:00:00.000Z',
  metadata: {},
  created_at: '2026-09-28T12:00:00.000Z',
  ...overrides,
});

type ForwardingActions = ReturnType<typeof useInboxMessageForwarding>;
let actions: ForwardingActions;

const Harness = () => {
  const chats = [chat('chat-1'), chat('chat-2')];
  const selectedChatIdRef = { current: 'chat-1' };
  const latestChatsRef = { current: chats };
  const [search, setSearch] = useState('busca anterior');
  actions = useInboxMessageForwarding({
    forwardTargetChats: chats,
    selectedChatIdRef,
    latestChatsRef,
    loadChats: async () => { await Promise.resolve(mocks.loadChats()); },
    loadMessages: async (targetChat, reason) => { await Promise.resolve(mocks.loadMessages(targetChat, reason)); },
    closeMessageActionMenu: () => { mocks.closeMenu(); },
    setForwardSearch: setSearch,
  });

  return (
    <>
      <output data-testid="snapshot">{JSON.stringify({
        messageId: actions.forwardingMessage?.id ?? null,
        targetIds: actions.forwardingTargetIds,
        inProgress: actions.forwardingInProgress,
        search,
      })}</output>
      <button data-testid="open" onClick={() => actions.handleOpenForwardMessageModal(message())}>Open</button>
      <button data-testid="invalid" onClick={() => actions.handleOpenForwardMessageModal(message({
        id: 'system-message',
        direction: 'system',
      }))}>Invalid</button>
      <button data-testid="close" onClick={actions.handleCloseForwardMessageModal}>Close</button>
      <button data-testid="target-1" onClick={() => actions.handleToggleForwardTarget('chat-1')}>Target 1</button>
      <button data-testid="target-2" onClick={() => actions.handleToggleForwardTarget('chat-2')}>Target 2</button>
    </>
  );
};

const readSnapshot = (container: HTMLElement) => {
  const content = container.querySelector('[data-testid="snapshot"]')?.textContent;
  assert.ok(content);
  return JSON.parse(content) as {
    messageId: string | null;
    targetIds: string[];
    inProgress: boolean;
    search: string;
  };
};

const click = (container: HTMLElement, testId: string) => {
  const button = container.querySelector(`[data-testid="${testId}"]`);
  assert.ok(button);
  act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
};

const resetMocks = () => {
  mocks.forward.mockReset();
  mocks.loadChats.mockReset();
  mocks.loadMessages.mockReset();
  mocks.closeMenu.mockReset();
  mocks.toastError.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.forward.mockResolvedValue(['sent-1', 'sent-2']);
  mocks.loadChats.mockResolvedValue(undefined);
  mocks.loadMessages.mockResolvedValue(undefined);
};

test('valida a mensagem, limpa a busca e fecha o menu de ações ao abrir o modal', () => {
  resetMocks();
  const view = render(<Harness />);

  click(view.container, 'invalid');
  assert.equal(readSnapshot(view.container).messageId, null);
  assert.deepEqual(mocks.toastError.mock.calls[0], ['Esta mensagem não pode ser encaminhada no momento.']);

  click(view.container, 'open');
  assert.equal(readSnapshot(view.container).messageId, 'message-1');
  assert.equal(readSnapshot(view.container).search, '');
  assert.equal(mocks.closeMenu.mock.calls.length, 1);
  view.unmount();
});

test('encaminha somente para os destinos selecionados e recarrega chats e a conversa aberta', async () => {
  resetMocks();
  const view = render(<Harness />);
  click(view.container, 'open');
  click(view.container, 'target-1');
  click(view.container, 'target-2');

  await act(async () => actions.handleForwardToSelectedChats());

  assert.deepEqual(mocks.forward.mock.calls[0], ['message-1', ['chat-1@s.whatsapp.net', 'chat-2@s.whatsapp.net']]);
  assert.equal(mocks.loadChats.mock.calls.length, 1);
  assert.equal(mocks.loadMessages.mock.calls.length, 1);
  assert.equal((mocks.loadMessages.mock.calls[0]?.[0] as CommWhatsAppChat | undefined)?.id, 'chat-1');
  assert.deepEqual(mocks.loadMessages.mock.calls[0]?.[1], 'send');
  assert.deepEqual(mocks.toastSuccess.mock.calls[0], ['Mensagem encaminhada para 2 conversas.']);
  assert.equal(readSnapshot(view.container).messageId, null);
  assert.deepEqual(readSnapshot(view.container).targetIds, []);
  assert.equal(readSnapshot(view.container).inProgress, false);
  view.unmount();
});

test('exige destinos e mantém o modal recuperável quando o encaminhamento falha', async () => {
  resetMocks();
  const originalConsoleError = console.error;
  console.error = () => undefined;
  try {
    mocks.forward.mockRejectedValueOnce(new Error('WhatsApp indisponível'));
    const view = render(<Harness />);
    click(view.container, 'open');

    await act(async () => actions.handleForwardToSelectedChats());
    assert.deepEqual(mocks.toastError.mock.calls[0], ['Selecione pelo menos uma conversa para encaminhar.']);
    assert.equal(mocks.forward.mock.calls.length, 0);

    click(view.container, 'target-2');
    await act(async () => actions.handleForwardToSelectedChats());
    assert.deepEqual(mocks.forward.mock.calls[0], ['message-1', ['chat-2@s.whatsapp.net']]);
    assert.deepEqual(mocks.toastError.mock.calls[1], ['WhatsApp indisponível']);
    assert.equal(readSnapshot(view.container).messageId, 'message-1');
    assert.deepEqual(readSnapshot(view.container).targetIds, ['chat-2']);
    assert.equal(readSnapshot(view.container).inProgress, false);
    view.unmount();
  } finally {
    console.error = originalConsoleError;
  }
});
