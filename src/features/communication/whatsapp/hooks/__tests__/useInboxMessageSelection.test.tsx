import assert from 'node:assert/strict';
import { type SetStateAction } from 'react';
import { test } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../../domain/types';
import { useInboxMessageSelection } from '../useInboxMessageSelection';

type Selection = Parameters<typeof useInboxMessageSelection>[0];

const Harness = ({ options }: { options: Selection }) => {
  useInboxMessageSelection(options);
  return null;
};

const createMessage = (id: string): CommWhatsAppMessage => ({
  id,
  chat_id: 'chat-1',
  channel_id: 'channel-1',
  direction: 'inbound',
  message_type: 'text',
  delivery_status: 'received',
  message_at: '2026-09-28T12:00:00.000Z',
  external_message_id: null,
  media_url: null,
  metadata: {},
  created_at: '2026-09-28T12:00:00.000Z',
});

const applyStateUpdate = <Value,>(update: SetStateAction<Value>, previous: Value) => (
  typeof update === 'function' ? (update as (value: Value) => Value)(previous) : update
);

const createOptions = (selectedChatId: string | null = 'chat-1') => {
  const state = {
    messages: [createMessage('existing')],
    messageLoadError: 'previous error' as string | null,
    loadingMessages: true,
    threadReconcileChatId: 'previous-chat' as string | null,
    loadingOlderMessages: true,
    hasOlderMessages: true,
    replyTargetMessage: createMessage('reply-target') as CommWhatsAppMessage | null,
  };
  const cachedMessages = new Map<string, { messages: CommWhatsAppMessage[]; signature: string; hasOlderMessages: boolean }>();
  const snapshotLookups: Array<string | null> = [];
  const loadRequests: Array<{ chat: CommWhatsAppChat | null; reason: 'initial' }> = [];
  const voiceCancelCalls: number[] = [];
  const refs: Selection['refs'] = {
    pendingScrollModeRef: { current: 'preserve' },
    pendingScrollTopRef: { current: 120 },
    pendingScrollHeightRef: { current: 400 },
    isNearBottomRef: { current: false },
    messagesSignatureRef: { current: 'existing-signature' },
    messagesCacheByChatIdRef: { current: cachedMessages },
    pendingMessageSearchChatIdRef: { current: null },
    lastSelectedChatPreviewRefreshKeyRef: { current: 'previous-preview' },
    cancelVoiceRecordingRef: { current: () => { voiceCancelCalls.push(1); } },
  };

  const options: Selection = {
    selectedChatId,
    refs,
    getSelectedChatSnapshot: (chatId) => {
      snapshotLookups.push(chatId);
      return null;
    },
    loadMessages: (chat, reason) => {
      loadRequests.push({ chat, reason });
    },
    setMessages: (messages) => {
      state.messages = applyStateUpdate(messages, state.messages);
    },
    setMessageLoadError: (error) => {
      state.messageLoadError = applyStateUpdate(error, state.messageLoadError);
    },
    setLoadingMessages: (loading) => {
      state.loadingMessages = applyStateUpdate(loading, state.loadingMessages);
    },
    setThreadReconcileChatId: (chatId) => {
      state.threadReconcileChatId = applyStateUpdate(chatId, state.threadReconcileChatId);
    },
    setLoadingOlderMessages: (loading) => {
      state.loadingOlderMessages = applyStateUpdate(loading, state.loadingOlderMessages);
    },
    setHasOlderMessages: (hasOlder) => {
      state.hasOlderMessages = applyStateUpdate(hasOlder, state.hasOlderMessages);
    },
    setReplyTargetMessage: (message) => {
      state.replyTargetMessage = applyStateUpdate(message, state.replyTargetMessage);
    },
  };

  return { options, refs, state, snapshotLookups, loadRequests, voiceCancelCalls, cachedMessages };
};

test('hidrata a conversa do cache e inicia a atualização sem bloquear a timeline', () => {
  const cachedMessage = createMessage('cached');
  const context = createOptions();
  context.cachedMessages.set('chat-1', {
    messages: [cachedMessage],
    signature: 'cached-signature',
    hasOlderMessages: true,
  });

  render(<Harness options={context.options} />);

  assert.deepEqual(context.state.messages, [cachedMessage]);
  assert.equal(context.state.loadingMessages, false);
  assert.equal(context.state.hasOlderMessages, true);
  assert.equal(context.refs.messagesSignatureRef.current, 'cached-signature');
  assert.equal(context.refs.pendingScrollModeRef.current, 'bottom');
  assert.equal(context.refs.pendingScrollTopRef.current, null);
  assert.equal(context.refs.pendingScrollHeightRef.current, null);
  assert.equal(context.refs.isNearBottomRef.current, true);
  assert.equal(context.state.messageLoadError, null);
  assert.equal(context.state.loadingOlderMessages, false);
  assert.equal(context.state.threadReconcileChatId, null);
  assert.equal(context.state.replyTargetMessage, null);
  assert.deepEqual(context.snapshotLookups, ['chat-1']);
  assert.deepEqual(context.loadRequests, [{ chat: null, reason: 'initial' }]);
  assert.deepEqual(context.voiceCancelCalls, [1]);
});

test('limpa a busca pendente sem recarregar a conversa que está sendo aberta por busca', () => {
  const cachedMessage = createMessage('cached');
  const context = createOptions();
  context.cachedMessages.set('chat-1', {
    messages: [cachedMessage],
    signature: 'cached-signature',
    hasOlderMessages: false,
  });
  context.refs.pendingMessageSearchChatIdRef.current = 'chat-1';

  render(<Harness options={context.options} />);

  assert.deepEqual(context.state.messages, [cachedMessage]);
  assert.deepEqual(context.snapshotLookups, []);
  assert.deepEqual(context.loadRequests, []);
});

test('sem cache mostra loader bloqueante e inicia a primeira carga', () => {
  const context = createOptions();

  render(<Harness options={context.options} />);

  assert.deepEqual(context.state.messages, []);
  assert.equal(context.state.loadingMessages, true);
  assert.equal(context.state.hasOlderMessages, false);
  assert.equal(context.refs.messagesSignatureRef.current, '');
  assert.deepEqual(context.snapshotLookups, ['chat-1']);
  assert.deepEqual(context.loadRequests, [{ chat: null, reason: 'initial' }]);
});

test('ao remover a seleção limpa mensagens, busca e estados transitórios', () => {
  const context = createOptions(null);
  context.refs.pendingMessageSearchChatIdRef.current = 'chat-1';

  render(<Harness options={context.options} />);

  assert.deepEqual(context.state.messages, []);
  assert.equal(context.state.messageLoadError, null);
  assert.equal(context.state.loadingMessages, false);
  assert.equal(context.state.threadReconcileChatId, null);
  assert.equal(context.state.loadingOlderMessages, false);
  assert.equal(context.state.hasOlderMessages, false);
  assert.equal(context.state.replyTargetMessage, null);
  assert.equal(context.refs.lastSelectedChatPreviewRefreshKeyRef.current, '');
  assert.equal(context.refs.messagesSignatureRef.current, '');
  assert.equal(context.refs.pendingMessageSearchChatIdRef.current, null);
  assert.deepEqual(context.snapshotLookups, []);
  assert.deepEqual(context.loadRequests, []);
  assert.deepEqual(context.voiceCancelCalls, [1]);
});
