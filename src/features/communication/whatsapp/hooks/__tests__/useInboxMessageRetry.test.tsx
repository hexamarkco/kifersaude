import assert from 'node:assert/strict';
import { act } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../../domain/types';
import type { LocalOutgoingRetryPayload } from '../../domain/outgoingMessageTypes';
import { CommWhatsAppAmbiguousSendError } from '../../data';
import { useInboxMessageRetry } from '../useInboxMessageRetry';

type MockFunction = ((...args: unknown[]) => unknown) & {
  mockReset: () => MockFunction;
  mockResolvedValue: (value: unknown) => MockFunction;
  mockRejectedValueOnce: (value: unknown) => MockFunction;
  mock: { calls: unknown[][] };
};

const mocks = vi.hoisted(() => {
  const createMock = () => vi.fn() as unknown as MockFunction;
  return {
    sendText: createMock(),
    sendMedia: createMock(),
    sendRemote: createMock(),
    rememberLocalPreview: createMock(),
    retryMedia: createMock(),
    toastInfo: createMock(),
    toastError: createMock(),
  };
});

vi.mock('../../data', () => ({
  CommWhatsAppAmbiguousSendError: class CommWhatsAppAmbiguousSendError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'CommWhatsAppAmbiguousSendError';
    }
  },
  CommWhatsAppMediaSendTimeoutError: class CommWhatsAppMediaSendTimeoutError extends Error {
    constructor() {
      super('timeout');
      this.name = 'CommWhatsAppMediaSendTimeoutError';
    }
  },
  whatsappMessagesRepository: { sendText: mocks.sendText },
  whatsappMediaRepository: {
    send: mocks.sendMedia,
    sendRemote: mocks.sendRemote,
    rememberLocalPreview: mocks.rememberLocalPreview,
    retry: mocks.retryMedia,
  },
}));

vi.mock('../../../../../lib/toast', () => ({
  toast: {
    info: mocks.toastInfo,
    error: mocks.toastError,
  },
}));

type Retry = ReturnType<typeof useInboxMessageRetry>;
type RetryOptions = Parameters<typeof useInboxMessageRetry>[0];

const Harness = ({ options, capture }: { options: RetryOptions; capture: (retry: Retry) => void }) => {
  capture(useInboxMessageRetry(options));
  return null;
};

const createOptions = (message: CommWhatsAppMessage, payload: LocalOutgoingRetryPayload) => {
  const retryPayloads = { current: new Map([[message.id, payload]]) };
  const patches: Array<{ id: string; patch: Partial<CommWhatsAppMessage> }> = [];
  const retryingStates: Array<string | null> = [];
  let retryingMessageId: string | null = null;
  const refreshes: string[] = [];
  const options: RetryOptions = {
    selectedChat: createChat(),
    localOutgoingRetryPayloadRef: retryPayloads,
    setRetryingMessageId: (updater) => {
      retryingMessageId = typeof updater === 'function' ? updater(retryingMessageId) : updater;
      retryingStates.push(retryingMessageId);
    },
    refreshableOutboundStatuses: new Set(['pending', 'queued', 'sending', 'sent', 'delivered']),
    enqueueChatSend: async (_chatId, task) => task(),
    patchLocalOutgoingMessage: (id, patch) => { patches.push({ id, patch }); },
    removeLocalOutgoingMessage: vi.fn(),
    loadChats: async () => undefined,
    loadMessages: async () => undefined,
    scheduleMessageStatusRefresh: ({ externalMessageIds }) => refreshes.push(...externalMessageIds),
  };
  return { options, retryPayloads, patches, retryingStates, refreshes };
};

const createChat = (): CommWhatsAppChat => ({
  id: 'chat-1',
  channel_id: 'channel-1',
  external_chat_id: '5511999999999@s.whatsapp.net',
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

const createMessage = (mediaId: string | null = null): CommWhatsAppMessage => ({
  id: 'message-1',
  chat_id: 'chat-1',
  channel_id: 'channel-1',
  direction: 'outbound',
  message_type: 'text',
  delivery_status: 'failed',
  message_at: '2026-09-28T12:00:00.000Z',
  media_id: mediaId,
  metadata: {},
  created_at: '2026-09-28T12:00:00.000Z',
});

const resetMocks = () => {
  mocks.sendText.mockReset();
  mocks.sendMedia.mockReset();
  mocks.sendRemote.mockReset();
  mocks.rememberLocalPreview.mockReset();
  mocks.retryMedia.mockReset();
  mocks.toastInfo.mockReset();
  mocks.toastError.mockReset();
};

test('erro ambíguo mantém payload local e o mesmo identificador para evitar duplicidade', async () => {
  resetMocks();
  mocks.sendText.mockRejectedValueOnce(new CommWhatsAppAmbiguousSendError('resposta perdida'));
  const message = createMessage();
  const state = createOptions(message, { kind: 'text', text: 'Texto para reenviar' });
  let retry: Retry | null = null;
  const view = render(<Harness options={state.options} capture={(value) => { retry = value; }} />);

  try {
    assert.ok(retry);
    await act(async () => { await retry?.handleRetryMediaMessage(message); });

    const retainedPayload = state.retryPayloads.current.get(message.id);
    assert.equal(retainedPayload?.kind, 'text');
    assert.ok(retainedPayload?.clientRequestId);
    assert.equal(mocks.sendText.mock.calls.length, 1);
    const requestOptions = mocks.sendText.mock.calls[0]?.[2] as { clientRequestId: string };
    assert.equal(requestOptions.clientRequestId, retainedPayload.clientRequestId);
    assert.equal(state.patches[state.patches.length - 1]?.patch.delivery_status, 'sending');
    assert.deepEqual(state.retryingStates, ['message-1', null]);
    assert.equal(mocks.toastInfo.mock.calls.length, 1);
  } finally {
    view.unmount();
  }
});

test('retry persistido usa o repositório de mídia e atualiza as conversas após confirmação', async () => {
  resetMocks();
  mocks.retryMedia.mockResolvedValue(undefined);
  const message = createMessage('media-1');
  const state = createOptions(message, { kind: 'text', text: 'payload não usado' });
  state.retryPayloads.current.delete(message.id);
  let retry: Retry | null = null;
  const view = render(<Harness options={state.options} capture={(value) => { retry = value; }} />);

  try {
    assert.ok(retry);
    await act(async () => { await retry?.handleRetryMediaMessage(message); });

    assert.equal(mocks.retryMedia.mock.calls.length, 1);
    const requestOptions = mocks.retryMedia.mock.calls[0]?.[1] as { clientRequestId: string };
    assert.match(requestOptions.clientRequestId, /^client-request-/);
    assert.deepEqual(state.retryingStates, ['message-1', null]);
  } finally {
    view.unmount();
  }
});
