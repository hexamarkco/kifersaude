import assert from 'node:assert/strict';
import { act } from 'react';
import { test, vi } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../../domain/types';
import { ComposerSendLock } from '../../components/composerSendLock';
import { CommWhatsAppAmbiguousSendError } from '../../data';
import { useInboxMessageSending } from '../useInboxMessageSending';

type MockFunction = ((...args: unknown[]) => unknown) & {
  mockReset: () => MockFunction;
  mockResolvedValue: (value: unknown) => MockFunction;
  mockResolvedValueOnce: (value: unknown) => MockFunction;
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
    toastInfo: createMock(),
    toastWarning: createMock(),
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
  },
}));

vi.mock('../../../../../lib/toast', () => ({
  toast: {
    info: mocks.toastInfo,
    warning: mocks.toastWarning,
    error: mocks.toastError,
  },
}));

type MessageSending = ReturnType<typeof useInboxMessageSending>;
type MessageSendingOptions = Parameters<typeof useInboxMessageSending>[0];

const Harness = ({ options, capture }: {
  options: MessageSendingOptions;
  capture: (sending: MessageSending) => void;
}) => {
  capture(useInboxMessageSending(options));
  return null;
};

const createOptions = (overrides: Partial<MessageSendingOptions> = {}) => {
  const pendingSends: Promise<void>[] = [];
  const patches: Array<{ id: string; patch: Partial<CommWhatsAppMessage> }> = [];
  const appended: CommWhatsAppMessage[] = [];
  const clearedProgress: string[] = [];
  const drawerSendingStates: Array<Record<string, boolean>> = [];
  const statusRefreshes: Array<{ chat: CommWhatsAppChat; externalMessageIds: string[] }> = [];
  let drawerSending: Record<string, boolean> = {};
  const activeUploads = { current: new Map<string, AbortController>() };
  const retryPayloads = { current: new Map() };
  let optimisticMessageIndex = 0;

  const options: MessageSendingOptions = {
    selectedChat: createChat(),
    mediaDrawerSendDisabledReason: null,
    messageDraft: 'Legenda',
    pendingAttachments: [],
    replyTargetMessage: null,
    sendDisabledReason: null,
    composerSendLock: new ComposerSendLock(),
    mediaUploadAbortControllersRef: activeUploads,
    localOutgoingRetryPayloadRef: retryPayloads,
    refreshableOutboundStatuses: new Set(['pending', 'queued', 'sending', 'sent', 'delivered']),
    resolveComposerVariables: (value) => value,
    resetComposerAfterQueue: vi.fn(),
    setReplyTargetMessage: vi.fn(),
    setSendingDrawerMediaByChatId: (updater) => {
      drawerSending = updater(drawerSending);
      drawerSendingStates.push({ ...drawerSending });
    },
    enqueueChatSend: (_chatId, task) => {
      const pending = task();
      pendingSends.push(pending);
      return pending;
    },
    allocateOptimisticMessageTimestamps: (_chatId, count) => Array.from(
      { length: count },
      (_, index) => new Date(Date.UTC(2026, 8, 28, 12, 0, index)).toISOString(),
    ),
    appendLocalOutgoingMessage: (message) => { appended.push(message); },
    applyOptimisticChatSummary: vi.fn(),
    buildOptimisticOutgoingMessage: (params) => {
      optimisticMessageIndex += 1;
      const messageAt = params.messageAt ?? '2026-09-28T12:00:00.000Z';
      return {
        id: `local-${optimisticMessageIndex}`,
        chat_id: params.chat.id,
        channel_id: params.chat.channel_id,
        direction: 'outbound',
        message_type: params.messageType,
        delivery_status: 'pending',
        text_content: params.textContent,
        message_at: messageAt,
        media_url: params.mediaUrl ?? null,
        metadata: params.metadata ?? {},
        created_at: messageAt,
      };
    },
    patchLocalOutgoingMessage: (id, patch) => { patches.push({ id, patch }); },
    updateOptimisticChatPreviewStatus: vi.fn(),
    setMediaUploadProgress: vi.fn(),
    updateMediaUploadProgress: vi.fn(),
    clearMediaUploadProgress: (chatId) => { clearedProgress.push(chatId); },
    loadChats: async () => undefined,
    loadMessages: async () => undefined,
    scheduleMessageStatusRefresh: (params) => { statusRefreshes.push(params); },
    ...overrides,
  };

  return { options, pendingSends, patches, appended, clearedProgress, activeUploads, drawerSendingStates, statusRefreshes };
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
  last_message_direction: 'system',
  unread_count: 0,
  status: 'open',
  autonomous_attendance_status: 'inactive',
  created_at: '2026-09-28T12:00:00.000Z',
  updated_at: '2026-09-28T12:00:00.000Z',
});

const createAttachment = (name: string) => ({
  id: name,
  file: new File(['conteúdo'], `${name}.png`, { type: 'image/png' }),
  kind: 'image' as const,
  previewUrl: `https://example.test/${name}.png`,
});

const createInteractiveMessage = (overrides: Partial<CommWhatsAppMessage> = {}): CommWhatsAppMessage => ({
  id: 'message-1',
  chat_id: 'chat-1',
  channel_id: 'channel-1',
  external_message_id: 'external-message-1',
  direction: 'inbound',
  message_type: 'buttons',
  delivery_status: 'received',
  text_content: '[Botoes] Quer continuar?',
  sender_phone: '+55 11 98888-8888',
  message_at: '2026-09-28T12:00:00.000Z',
  metadata: {},
  created_at: '2026-09-28T12:00:00.000Z',
  ...overrides,
});

const resetMocks = () => {
  mocks.sendText.mockReset();
  mocks.sendMedia.mockReset();
  mocks.sendRemote.mockReset();
  mocks.rememberLocalPreview.mockReset();
  mocks.toastInfo.mockReset();
  mocks.toastWarning.mockReset();
  mocks.toastError.mockReset();
};

test('um timeout ambíguo de anexo não bloqueia os próximos anexos e limpa o estado de upload', async () => {
  resetMocks();
  mocks.sendMedia
    .mockRejectedValueOnce(new CommWhatsAppAmbiguousSendError('resposta perdida'))
    .mockResolvedValueOnce({ messageId: 'external-2', status: 'sent' });
  const state = createOptions({
    messageDraft: '',
    pendingAttachments: [createAttachment('arquivo-1'), createAttachment('arquivo-2')],
  });
  let sending: MessageSending | null = null;
  const view = render(<Harness options={state.options} capture={(value) => { sending = value; }} />);

  try {
    assert.ok(sending);
    act(() => sending?.handleSendMessage());
    await act(async () => { await Promise.all(state.pendingSends); });

    assert.equal(mocks.sendMedia.mock.calls.length, 2);
    assert.equal(state.patches.find(({ id }) => id === 'local-1')?.patch.delivery_status, 'sending');
    assert.equal(state.patches.find(({ id }) => id === 'local-2')?.patch.delivery_status, 'sent');
    assert.deepEqual(state.clearedProgress, ['chat-1']);
    assert.equal(state.activeUploads.current.size, 0);
    assert.equal(mocks.toastInfo.mock.calls.length, 1);
  } finally {
    view.unmount();
  }
});

test('uma falha definitiva interrompe o restante da fila de anexos', async () => {
  resetMocks();
  mocks.sendMedia.mockRejectedValueOnce(new Error('arquivo recusado'));
  const state = createOptions({
    messageDraft: '',
    pendingAttachments: [createAttachment('arquivo-1'), createAttachment('arquivo-2')],
  });
  let sending: MessageSending | null = null;
  const view = render(<Harness options={state.options} capture={(value) => { sending = value; }} />);

  try {
    assert.ok(sending);
    act(() => sending?.handleSendMessage());
    await act(async () => { await Promise.all(state.pendingSends); });

    assert.equal(mocks.sendMedia.mock.calls.length, 1);
    assert.equal(state.patches.find(({ id }) => id === 'local-1')?.patch.delivery_status, 'failed');
    assert.equal(state.patches.find(({ id }) => id === 'local-2')?.patch.delivery_status, 'failed');
    assert.match(String(state.patches.find(({ id }) => id === 'local-2')?.patch.error_message), /interrompido/);
  } finally {
    view.unmount();
  }
});

test('envio bem-sucedido mantém legenda e citação somente no primeiro anexo', async () => {
  resetMocks();
  mocks.sendMedia
    .mockResolvedValueOnce({ messageId: 'media-1', status: 'sent' })
    .mockResolvedValueOnce({ messageId: 'media-2', status: 'delivered' });
  const quoteMessage = createInteractiveMessage();
  const state = createOptions({
    messageDraft: 'Legenda da conversa',
    pendingAttachments: [createAttachment('arquivo-1'), createAttachment('arquivo-2')],
    replyTargetMessage: quoteMessage,
  });
  let sending: MessageSending | null = null;
  const view = render(<Harness options={state.options} capture={(value) => { sending = value; }} />);

  try {
    assert.ok(sending);
    act(() => sending?.handleSendMessage());
    await act(async () => { await Promise.all(state.pendingSends); });

    assert.equal(mocks.sendMedia.mock.calls.length, 2);
    const firstSend = mocks.sendMedia.mock.calls[0]?.[0] as Record<string, unknown>;
    const secondSend = mocks.sendMedia.mock.calls[1]?.[0] as Record<string, unknown>;
    assert.equal(firstSend.caption, 'Legenda da conversa');
    assert.equal(firstSend.quotedMessageId, 'external-message-1');
    assert.equal(secondSend.caption, undefined);
    assert.equal(secondSend.quotedMessageId, undefined);
    assert.deepEqual(state.appended[0]?.metadata.quote, {
      external_message_id: 'external-message-1',
      author_phone: '+55 11 98888-8888',
      quoted_type: 'buttons',
      preview_text: 'Quer continuar?',
    });
    assert.deepEqual(state.appended[1]?.metadata, {});
    assert.deepEqual(state.statusRefreshes.map(({ externalMessageIds }) => externalMessageIds), [['media-1'], ['media-2']]);
    assert.deepEqual(state.clearedProgress, ['chat-1']);
    assert.equal(state.activeUploads.current.size, 0);
    assert.equal((state.options.resetComposerAfterQueue as MockFunction).mock.calls.length, 1);
    assert.deepEqual((state.options.setReplyTargetMessage as MockFunction).mock.calls[0], [null]);
  } finally {
    view.unmount();
  }
});

test('o lock impede o envio duplicado do mesmo snapshot do composer', async () => {
  resetMocks();
  mocks.sendText.mockResolvedValue({ messageId: 'external-1', status: 'sent' });
  const state = createOptions({ messageDraft: 'Olá', pendingAttachments: [] });
  let sending: MessageSending | null = null;
  const view = render(<Harness options={state.options} capture={(value) => { sending = value; }} />);

  try {
    assert.ok(sending);
    act(() => {
      sending?.handleSendMessage();
      sending?.handleSendMessage();
    });
    await act(async () => { await Promise.all(state.pendingSends); });

    assert.equal(mocks.sendText.mock.calls.length, 1);
    assert.equal(state.appended.length, 1);
  } finally {
    view.unmount();
  }
});

test('envio de mídia remota da gaveta reconcilia status e libera o indicador', async () => {
  resetMocks();
  mocks.sendRemote.mockResolvedValue({ messageId: 'remote-1', status: 'sent' });
  const state = createOptions();
  let sending: MessageSending | null = null;
  const view = render(<Harness options={state.options} capture={(value) => { sending = value; }} />);

  try {
    assert.ok(sending);
    await act(async () => {
      await sending?.handleSendDrawerMedia({
        sendKind: 'image',
        sendUrl: 'https://media.example/image.png',
        title: 'imagem.png',
        mimeType: 'image/png',
      });
    });

    assert.equal(mocks.sendRemote.mock.calls.length, 1);
    assert.deepEqual(state.patches.map(({ patch }) => patch.delivery_status), ['sent']);
    assert.deepEqual(state.statusRefreshes.map(({ externalMessageIds }) => externalMessageIds), [['remote-1']]);
    assert.deepEqual(state.drawerSendingStates, [{ 'chat-1': true }, {}]);
  } finally {
    view.unmount();
  }
});

test('bloqueia envio remoto da gaveta quando o canal está indisponível', async () => {
  resetMocks();
  const state = createOptions({ mediaDrawerSendDisabledReason: 'Canal WhatsApp desconectado.' });
  let sending: MessageSending | null = null;
  const view = render(<Harness options={state.options} capture={(value) => { sending = value; }} />);

  try {
    assert.ok(sending);
    const activeSending = sending as MessageSending;

    await act(async () => {
      await assert.rejects(() => activeSending.handleSendDrawerMedia({
        sendKind: 'image',
        sendUrl: 'https://media.example/image.png',
        title: 'imagem.png',
        mimeType: 'image/png',
      }), /Canal WhatsApp desconectado/);
    });

    assert.equal(state.pendingSends.length, 0);
    assert.equal(state.appended.length, 0);
    assert.deepEqual(mocks.toastError.mock.calls[0], ['Canal WhatsApp desconectado.']);
  } finally {
    view.unmount();
  }
});

test('resposta interativa envia o título escolhido como texto citado na mensagem original', async () => {
  resetMocks();
  mocks.sendText.mockResolvedValue({ messageId: 'reply-1', status: 'sent' });
  const state = createOptions({ messageDraft: '', pendingAttachments: [] });
  let sending: MessageSending | null = null;
  const view = render(<Harness options={state.options} capture={(value) => { sending = value; }} />);

  try {
    assert.ok(sending);
    act(() => sending?.handleSelectInteractiveReply(
      createInteractiveMessage(),
      { id: 'option-yes', title: '  Quero continuar  ' },
    ));
    await act(async () => { await Promise.all(state.pendingSends); });

    assert.equal(mocks.sendText.mock.calls.length, 1);
    assert.equal(mocks.sendText.mock.calls[0]?.[0], '5511999999999@s.whatsapp.net');
    assert.equal(mocks.sendText.mock.calls[0]?.[1], 'Quero continuar');
    const sendOptions = mocks.sendText.mock.calls[0]?.[2] as Record<string, unknown>;
    assert.equal(sendOptions.quotedMessageId, 'external-message-1');
    assert.equal(sendOptions.quotedAuthorPhone, '+55 11 98888-8888');
    assert.equal(sendOptions.quotedType, 'buttons');
    assert.equal(sendOptions.quotedPreviewText, 'Quer continuar?');
    assert.deepEqual(state.appended[0]?.metadata.quote, {
      external_message_id: 'external-message-1',
      author_phone: '+55 11 98888-8888',
      quoted_type: 'buttons',
      preview_text: 'Quer continuar?',
    });
  } finally {
    view.unmount();
  }
});

test('ignora respostas interativas que não sejam recebidas ou não tenham texto', () => {
  resetMocks();
  const state = createOptions({ messageDraft: '', pendingAttachments: [] });
  let sending: MessageSending | null = null;
  const view = render(<Harness options={state.options} capture={(value) => { sending = value; }} />);

  try {
    assert.ok(sending);
    act(() => sending?.handleSelectInteractiveReply(
      createInteractiveMessage({ direction: 'outbound' }),
      { id: 'option-yes', title: 'Sim' },
    ));
    act(() => sending?.handleSelectInteractiveReply(
      createInteractiveMessage(),
      { id: 'option-yes', title: '   ' },
    ));
    assert.equal(state.pendingSends.length, 0);
    assert.equal(mocks.sendText.mock.calls.length, 0);
  } finally {
    view.unmount();
  }
});

test('respeita o bloqueio do canal antes de enfileirar uma resposta interativa', () => {
  resetMocks();
  const state = createOptions({
    sendDisabledReason: 'Canal WhatsApp desconectado.',
    messageDraft: '',
    pendingAttachments: [],
  });
  let sending: MessageSending | null = null;
  const view = render(<Harness options={state.options} capture={(value) => { sending = value; }} />);

  try {
    assert.ok(sending);
    act(() => sending?.handleSelectInteractiveReply(
      createInteractiveMessage(),
      { id: 'option-yes', title: 'Sim' },
    ));

    assert.equal(state.pendingSends.length, 0);
    assert.deepEqual(mocks.toastError.mock.calls[0], ['Canal WhatsApp desconectado.']);
  } finally {
    view.unmount();
  }
});
