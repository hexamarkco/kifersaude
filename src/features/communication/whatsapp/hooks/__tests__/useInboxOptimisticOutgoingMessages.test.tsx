import assert from 'node:assert/strict';
import { act } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../../domain/types';
import type { LocalOutgoingRetryPayload } from '../../domain/outgoingMessageTypes';
import { useInboxOptimisticOutgoingMessages } from '../useInboxOptimisticOutgoingMessages';

type MockFunction = ((...args: unknown[]) => unknown) & {
  mockReset: () => MockFunction;
  mock: { calls: unknown[][] };
};

const mocks = vi.hoisted(() => ({
  rememberLocalPreview: vi.fn() as unknown as MockFunction,
}));

vi.mock('../../data', () => ({
  whatsappMediaRepository: { rememberLocalPreview: mocks.rememberLocalPreview },
}));

type OutgoingState = ReturnType<typeof useInboxOptimisticOutgoingMessages>;
type OutgoingStateOptions = Parameters<typeof useInboxOptimisticOutgoingMessages>[0];

const Harness = ({ options, capture }: { options: OutgoingStateOptions; capture: (state: OutgoingState) => void }) => {
  capture(useInboxOptimisticOutgoingMessages(options));
  return null;
};

const createChat = (id = 'chat-1'): CommWhatsAppChat => ({
  id,
  channel_id: 'channel-1',
  external_chat_id: `${id}@s.whatsapp.net`,
  is_group: false,
  phone_number: '+55 11 99999-9999',
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
  last_message_direction: 'outbound',
  unread_count: 0,
  status: 'open',
  autonomous_attendance_status: 'inactive',
  created_at: '2026-09-28T12:00:00.000Z',
  updated_at: '2026-09-28T12:00:00.000Z',
});

const createMessage = (
  id: string,
  chatId = 'chat-1',
  overrides: Partial<CommWhatsAppMessage> = {},
): CommWhatsAppMessage => ({
  id,
  chat_id: chatId,
  channel_id: 'channel-1',
  direction: 'outbound',
  message_type: 'image',
  delivery_status: 'pending',
  message_at: '2026-09-28T12:00:00.000Z',
  external_message_id: null,
  media_url: null,
  metadata: {},
  created_at: '2026-09-28T12:00:00.000Z',
  ...overrides,
});

const createOptions = (selectedChatId = 'chat-1') => {
  const refs: OutgoingStateOptions = {
    selectedChatIdRef: { current: selectedChatId },
    pendingScrollModeRef: { current: null },
    pendingScrollTopRef: { current: 137 },
    pendingScrollHeightRef: { current: 512 },
  };
  return refs;
};

const renderOutgoingState = (options = createOptions()) => {
  let outgoingState!: OutgoingState;
  const view = render(<Harness options={options} capture={(state) => { outgoingState = state; }} />);
  return { view, get outgoingState() { return outgoingState; }, options };
};

test('cria e enfileira mensagem otimista com metadados de ordenação e snapshot de retry', () => {
  const options = createOptions();
  const mounted = renderOutgoingState(options);
  const chat = createChat();
  const retryPayload: LocalOutgoingRetryPayload = { kind: 'text', text: 'Olá', clientRequestId: 'request-1' };
  const message = mounted.outgoingState.buildOptimisticOutgoingMessage({
    chat,
    messageType: 'text',
    textContent: 'Olá',
    messageAt: '2026-09-28T12:05:00.000Z',
    clientRequestId: 'request-1',
  });

  act(() => mounted.outgoingState.appendLocalOutgoingMessage(message, retryPayload));

  assert.deepEqual(mounted.outgoingState.localOutgoingMessages, [message]);
  assert.equal(message.source, 'local');
  assert.equal(message.delivery_status, 'pending');
  assert.equal(message.metadata.client_order_at, message.message_at);
  assert.equal(message.metadata.client_request_id, 'request-1');
  assert.deepEqual(mounted.outgoingState.localOutgoingRetryPayloadRef.current.get(message.id), retryPayload);
  assert.equal(options.pendingScrollModeRef.current, 'bottom');
  assert.equal(options.pendingScrollTopRef.current, null);
  assert.equal(options.pendingScrollHeightRef.current, null);

  const confirmed = createMessage('server-1', chat.id, {
    external_message_id: 'external-1',
    metadata: { client_request_id: 'request-1' },
  });
  assert.equal(mounted.outgoingState.applyOutgoingOrderToServerMessage(confirmed).metadata.client_order_at, message.message_at);
});

test('patch da saída otimista preserva metadados existentes e atualiza a ordenação confirmada', () => {
  const mounted = renderOutgoingState();
  const message = createMessage('local-1', 'chat-1', {
    metadata: { local_outgoing: true, client_request_id: 'request-2', retained: 'value' },
  });
  act(() => mounted.outgoingState.appendLocalOutgoingMessage(message));

  act(() => mounted.outgoingState.patchLocalOutgoingMessage(message.id, {
    external_message_id: 'external-2',
    delivery_status: 'sent',
    metadata: { provider_status: 'accepted' },
  }));

  const patched = mounted.outgoingState.localOutgoingMessages[0];
  assert.equal(patched?.delivery_status, 'sent');
  assert.deepEqual(patched?.metadata, {
    local_outgoing: true,
    client_request_id: 'request-2',
    retained: 'value',
    provider_status: 'accepted',
  });
  assert.equal(mounted.outgoingState.applyOutgoingOrderToServerMessage(createMessage('server-2', 'chat-1', {
    external_message_id: 'external-2',
  })).metadata.client_order_at, message.message_at);
});

test('reconcilia mensagens do servidor, limpa retry e transfere preview sem remover outro chat', () => {
  mocks.rememberLocalPreview.mockReset();
  const mounted = renderOutgoingState();
  const localMessage = createMessage('local-1', 'chat-1', {
    media_url: 'blob:local-preview',
    metadata: { client_request_id: 'request-3' },
  });
  const otherChatMessage = createMessage('local-2', 'chat-2');
  act(() => {
    mounted.outgoingState.appendLocalOutgoingMessage(localMessage, { kind: 'media', mediaKind: 'image', file: new File(['image'], 'image.png') });
    mounted.outgoingState.appendLocalOutgoingMessage(otherChatMessage);
  });
  const serverMessage = createMessage('server-3', 'chat-1', {
    external_message_id: 'external-3',
    metadata: { client_request_id: 'request-3' },
  });

  act(() => mounted.outgoingState.reconcileLocalOutgoingMessages('chat-1', [serverMessage]));

  assert.deepEqual(mounted.outgoingState.localOutgoingMessages, [otherChatMessage]);
  assert.equal(mounted.outgoingState.localOutgoingRetryPayloadRef.current.has(localMessage.id), false);
  assert.equal(mounted.outgoingState.localOutgoingMediaPreviewUrlsRef.current.has(localMessage.id), false);
  assert.deepEqual(mocks.rememberLocalPreview.mock.calls[0], ['external-3', 'blob:local-preview']);
  assert.equal(mounted.outgoingState.applyOutgoingOrderToServerMessage(serverMessage).metadata.client_order_at, localMessage.message_at);
});

test('remoção local libera preview temporário e snapshot de retry', () => {
  const mounted = renderOutgoingState();
  const revokedUrls: string[] = [];
  const originalRevokeObjectURL = URL.revokeObjectURL;
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: (url: string) => revokedUrls.push(url),
  });
  const message = createMessage('local-4', 'chat-1', { media_url: 'blob:remove-preview' });

  try {
    act(() => mounted.outgoingState.appendLocalOutgoingMessage(message, { kind: 'text', text: 'retry' }));
    act(() => mounted.outgoingState.removeLocalOutgoingMessage(message.id));

    assert.deepEqual(mounted.outgoingState.localOutgoingMessages, []);
    assert.equal(mounted.outgoingState.localOutgoingRetryPayloadRef.current.has(message.id), false);
    assert.equal(mounted.outgoingState.localOutgoingMediaPreviewUrlsRef.current.has(message.id), false);
    assert.deepEqual(revokedUrls, ['blob:remove-preview']);
  } finally {
    if (originalRevokeObjectURL) {
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectURL });
    } else {
      Reflect.deleteProperty(URL, 'revokeObjectURL');
    }
  }
});

test('ao desmontar transfere previews confirmados e revoga previews sem confirmação', () => {
  mocks.rememberLocalPreview.mockReset();
  const mounted = renderOutgoingState();
  const revokedUrls: string[] = [];
  const originalRevokeObjectURL = URL.revokeObjectURL;
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: (url: string) => revokedUrls.push(url),
  });
  const confirmedMessage = createMessage('local-5', 'chat-1', { media_url: 'blob:confirmed-preview' });
  const pendingMessage = createMessage('local-6', 'chat-1', { media_url: 'blob:pending-preview' });

  try {
    act(() => {
      mounted.outgoingState.appendLocalOutgoingMessage(confirmedMessage, { kind: 'text', text: 'confirmed' });
      mounted.outgoingState.appendLocalOutgoingMessage(pendingMessage, { kind: 'text', text: 'pending' });
      mounted.outgoingState.patchLocalOutgoingMessage(confirmedMessage.id, { external_message_id: 'external-5' });
    });
    mounted.view.unmount();

    assert.deepEqual(mocks.rememberLocalPreview.mock.calls[0], ['external-5', 'blob:confirmed-preview']);
    assert.deepEqual(revokedUrls, ['blob:pending-preview']);
    assert.equal(mounted.outgoingState.localOutgoingRetryPayloadRef.current.size, 0);
    assert.equal(mounted.outgoingState.localOutgoingMediaPreviewUrlsRef.current.size, 0);
    assert.deepEqual(mounted.outgoingState.localOutgoingMessagesRef.current, []);
  } finally {
    if (originalRevokeObjectURL) {
      Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: originalRevokeObjectURL });
    } else {
      Reflect.deleteProperty(URL, 'revokeObjectURL');
    }
  }
});
