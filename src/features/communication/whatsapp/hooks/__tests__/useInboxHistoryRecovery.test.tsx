import assert from 'node:assert/strict';
import { act } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppChat } from '../../domain/types';
import { useInboxHistoryRecovery } from '../useInboxHistoryRecovery';

type SyncResult = {
  imported: number;
  fetched: number;
  inserted: number;
  updated: number;
  hasMore: boolean;
  nextOffset: number | null;
  timeTo: number | null;
};

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
  sync: vi.fn() as unknown as MockFunction,
  loadChats: vi.fn() as unknown as MockFunction,
  loadMessages: vi.fn() as unknown as MockFunction,
  toastError: vi.fn() as unknown as MockFunction,
  toastInfo: vi.fn() as unknown as MockFunction,
  toastSuccess: vi.fn() as unknown as MockFunction,
}));

vi.mock('../../data', () => ({
  whatsappConversationsRepository: { syncHistory: mocks.sync },
}));

vi.mock('../../../../../lib/toast', () => ({
  toast: { error: mocks.toastError, info: mocks.toastInfo, success: mocks.toastSuccess },
}));

const chat = (externalChatId = '5511999999999@s.whatsapp.net'): CommWhatsAppChat => ({
  id: 'chat-1',
  channel_id: 'channel-1',
  external_chat_id: externalChatId,
  is_group: false,
  phone_number: '5511999999999',
  phone_digits: '5511999999999',
  display_name: 'Contato',
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

const pageResult = (overrides: Partial<SyncResult> = {}): SyncResult => ({
  imported: 1,
  fetched: 1,
  inserted: 1,
  updated: 0,
  hasMore: false,
  nextOffset: null,
  timeTo: null,
  ...overrides,
});

type RecoveryActions = ReturnType<typeof useInboxHistoryRecovery>;
let actions: RecoveryActions;

const Harness = ({ disabledReason = null, externalChatId }: {
  disabledReason?: string | null;
  externalChatId?: string;
}) => {
  const selectedChat = chat(externalChatId);
  actions = useInboxHistoryRecovery({
    selectedChat,
    sendDisabledReason: disabledReason,
    loadChats: async () => { await Promise.resolve(mocks.loadChats()); },
    loadMessages: async (targetChat, reason) => { await Promise.resolve(mocks.loadMessages(targetChat, reason)); },
  });

  return (
    <>
      <output data-testid="snapshot">{JSON.stringify({
        syncingChatId: actions.syncingChatId,
        disabledReason: actions.disabledReason,
      })}</output>
      <button data-testid="recover" onClick={() => void actions.handleRecoverHistory()}>Recover</button>
    </>
  );
};

const readSnapshot = (container: HTMLElement) => {
  const content = container.querySelector('[data-testid="snapshot"]')?.textContent;
  assert.ok(content);
  return JSON.parse(content) as { syncingChatId: string | null; disabledReason: string | null };
};

const resetMocks = () => {
  mocks.sync.mockReset();
  mocks.loadChats.mockReset();
  mocks.loadMessages.mockReset();
  mocks.toastError.mockReset();
  mocks.toastInfo.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.sync.mockResolvedValue(pageResult());
  mocks.loadChats.mockResolvedValue(undefined);
  mocks.loadMessages.mockResolvedValue(undefined);
};

test('respeita bloqueios de envio e valida o identificador externo antes de sincronizar', async () => {
  resetMocks();
  const blocked = render(<Harness disabledReason="Canal desconectado" />);
  await act(async () => actions.handleRecoverHistory());
  assert.deepEqual(mocks.toastError.mock.calls[0], ['Canal desconectado']);
  assert.equal(mocks.sync.mock.calls.length, 0);
  blocked.unmount();

  const missingExternalId = render(<Harness externalChatId="  " />);
  assert.equal(readSnapshot(missingExternalId.container).disabledReason, 'Conversa sem identificador externo para consultar na Whapi.');
  await act(async () => actions.handleRecoverHistory());
  assert.equal(mocks.sync.mock.calls.length, 0);
  missingExternalId.unmount();
});

test('limita cada execução a 10 páginas e retoma do cursor salvo', async () => {
  resetMocks();
  mocks.sync.mockImplementation((...args) => {
    const options = args[1] as { offset: number; timeTo: number };
    return Promise.resolve(pageResult({
      hasMore: true,
      nextOffset: options.offset + 100,
      timeTo: 900,
    }));
  });
  const view = render(<Harness />);

  await act(async () => actions.handleRecoverHistory());
  assert.equal(mocks.sync.mock.calls.length, 10);
  assert.equal(mocks.sync.mock.calls[0]?.[0], '5511999999999@s.whatsapp.net');
  const firstOptions = mocks.sync.mock.calls[0]?.[1] as { offset: number; count: number };
  assert.deepEqual({ offset: firstOptions.offset, count: firstOptions.count }, { offset: 0, count: 100 });
  assert.equal((mocks.sync.mock.calls[9]?.[1] as { offset: number }).offset, 900);
  assert.deepEqual(mocks.toastSuccess.mock.calls[0], [
    'Histórico sincronizado (10 mensagens). Ainda há mais mensagens; execute a recuperação novamente para continuar.',
  ]);

  mocks.sync.mockResolvedValueOnce(pageResult({ imported: 2, fetched: 2, inserted: 2, timeTo: null }));
  await act(async () => actions.handleRecoverHistory());
  assert.equal((mocks.sync.mock.calls[10]?.[1] as { offset: number }).offset, 1000);
  assert.equal((mocks.sync.mock.calls[10]?.[1] as { timeTo: number }).timeTo, 900);
  assert.deepEqual(mocks.toastSuccess.mock.calls[1], [
    'Histórico sincronizado (2 mensagens). Use "Carregar mais" para navegar nas mais antigas.',
  ]);
  assert.equal(mocks.loadMessages.mock.calls.length, 2);
  assert.equal(mocks.loadChats.mock.calls.length, 2);
  view.unmount();
});

test('preserva o cursor após uma falha intermediária e retoma sem repetir páginas', async () => {
  resetMocks();
  const originalConsoleError = console.error;
  console.error = () => undefined;
  try {
    mocks.sync
      .mockResolvedValueOnce(pageResult({ hasMore: true, nextOffset: 100, timeTo: 700 }))
      .mockRejectedValueOnce(new Error('Whapi indisponível'))
      .mockResolvedValueOnce(pageResult({ imported: 2, timeTo: null }));
    const view = render(<Harness />);

    await act(async () => actions.handleRecoverHistory());
    assert.deepEqual(mocks.toastError.mock.calls[0], ['Whapi indisponível']);
    assert.equal(mocks.loadMessages.mock.calls.length, 0);

    await act(async () => actions.handleRecoverHistory());
    assert.deepEqual(mocks.sync.mock.calls[2]?.[1], { offset: 100, count: 100, timeTo: 700 });
    assert.equal(mocks.loadMessages.mock.calls.length, 1);
    assert.equal(mocks.loadChats.mock.calls.length, 1);
    view.unmount();
  } finally {
    console.error = originalConsoleError;
  }
});

test('a trava por conversa impede sincronizações duplicadas enquanto a Whapi responde', async () => {
  resetMocks();
  let resolveSync!: (result: SyncResult) => void;
  mocks.sync.mockReturnValueOnce(new Promise<SyncResult>((resolve) => {
    resolveSync = resolve;
  }));
  const view = render(<Harness />);
  let firstRequest!: Promise<void>;
  await act(async () => {
    firstRequest = actions.handleRecoverHistory();
  });
  assert.equal(readSnapshot(view.container).syncingChatId, 'chat-1');

  await act(async () => actions.handleRecoverHistory());
  assert.equal(mocks.sync.mock.calls.length, 1);

  resolveSync(pageResult());
  await act(async () => firstRequest);
  assert.equal(readSnapshot(view.container).syncingChatId, null);
  assert.equal(mocks.loadChats.mock.calls.length, 1);
  view.unmount();
});
