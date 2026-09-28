import assert from 'node:assert/strict';
import { test } from 'vitest';

import { render } from '../../../../../testing-library/react';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../../domain/types';
import { useInboxSelectedChatPreviewRefresh } from '../useInboxSelectedChatPreviewRefresh';

type PreviewRefreshOptions = Parameters<typeof useInboxSelectedChatPreviewRefresh>[0];

const Harness = ({ options }: { options: PreviewRefreshOptions }) => {
  useInboxSelectedChatPreviewRefresh(options);
  return null;
};

const createChat = (lastMessageAt = '2026-09-28T12:00:00.000Z'): CommWhatsAppChat => ({
  id: 'chat-1',
  channel_id: 'channel-1',
  external_chat_id: 'contact-1@s.whatsapp.net',
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
  last_message_at: lastMessageAt,
  last_message_text: 'Mensagem nova',
  last_message_direction: 'inbound',
  unread_count: 0,
  status: 'open',
  autonomous_attendance_status: 'inactive',
  created_at: '2026-09-28T11:00:00.000Z',
  updated_at: '2026-09-28T12:00:00.000Z',
});

const createMessage = (messageAt: string, chatId = 'chat-1'): CommWhatsAppMessage => ({
  id: 'message-1',
  chat_id: chatId,
  channel_id: 'channel-1',
  direction: 'inbound',
  message_type: 'text',
  delivery_status: 'received',
  message_at: messageAt,
  external_message_id: 'external-1',
  media_url: null,
  metadata: {},
  created_at: messageAt,
});

const createOptions = (latestMessageAt = '2026-09-28T11:00:00.000Z') => {
  const selectedChat = createChat();
  const refs = {
    latestMessagesRef: { current: [createMessage(latestMessageAt)] },
    messagesSignatureRef: { current: 'loaded-signature' },
    lastSelectedChatPreviewRefreshKeyRef: { current: '' },
  };
  const calls: Array<{ chat: CommWhatsAppChat | null; reason: 'poll' }> = [];
  const options: PreviewRefreshOptions = {
    selectedChat,
    loadingOlderMessages: false,
    refs,
    getSelectedChatSnapshot: (chatId) => chatId === selectedChat.id ? selectedChat : null,
    loadMessages: async (chat, reason) => { calls.push({ chat, reason }); },
  };

  return { options, refs, calls, selectedChat };
};

test('recarrega quando o preview do chat está à frente e deduplica pela assinatura', () => {
  const context = createOptions();
  const firstView = render(<Harness options={context.options} />);
  assert.deepEqual(context.calls, [{ chat: context.selectedChat, reason: 'poll' }]);
  firstView.unmount();

  const duplicateView = render(<Harness options={context.options} />);
  assert.equal(context.calls.length, 1);
  duplicateView.unmount();

  context.selectedChat.last_message_text = 'Outro preview novo';
  const changedPreviewView = render(<Harness options={context.options} />);
  assert.equal(context.calls.length, 2);
  changedPreviewView.unmount();
});

test('marca como reconciliado um preview já coberto pela timeline carregada', () => {
  const context = createOptions('2026-09-28T12:00:00.000Z');
  const currentView = render(<Harness options={context.options} />);
  assert.equal(context.calls.length, 0);
  currentView.unmount();

  context.refs.latestMessagesRef.current = [createMessage('2026-09-28T11:00:00.000Z')];
  const olderTimelineView = render(<Harness options={context.options} />);
  assert.equal(context.calls.length, 0);
  olderTimelineView.unmount();
});

test('não compete com a paginação antiga nem com o carregamento inicial', () => {
  const context = createOptions();
  context.options.loadingOlderMessages = true;
  const pagingView = render(<Harness options={context.options} />);
  assert.equal(context.calls.length, 0);
  pagingView.unmount();

  context.options.loadingOlderMessages = false;
  context.refs.messagesSignatureRef.current = '';
  const initialLoadView = render(<Harness options={context.options} />);
  assert.equal(context.calls.length, 0);
  initialLoadView.unmount();
});
