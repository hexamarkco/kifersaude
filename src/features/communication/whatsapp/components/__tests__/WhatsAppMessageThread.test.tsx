import assert from 'node:assert/strict';
import type { MutableRefObject } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { test, vi } from 'vitest';

import type { CommWhatsAppChat, CommWhatsAppMessage } from '../../domain/types';
import type { InboxMessageTimelineItem } from '../../domain/inboxMessageTimeline';
import { WhatsAppMessageThread } from '../WhatsAppMessageThread';

vi.mock('../WhatsAppMessageContent', () => ({
  WhatsAppMessageBody: () => <div data-testid="message-body" />,
}));

vi.mock('../WhatsAppInboxList', () => ({
  DeliveryStatusIndicator: () => null,
  RetryMediaButton: () => null,
  WhatsAppMediaGroupBody: () => <div data-testid="media-group-body" />,
}));

const createdAt = '2026-10-30T12:00:00.000Z';

const selectedChat: CommWhatsAppChat = {
  id: 'chat-1',
  channel_id: 'channel-1',
  external_chat_id: '5511999999999@s.whatsapp.net',
  is_group: false,
  phone_number: '+55 (11) 99999-9999',
  phone_digits: '5511999999999',
  display_name: 'Contato de demonstração',
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
  created_at: createdAt,
  updated_at: createdAt,
};

const createMessage = (id: string, messageType: string): CommWhatsAppMessage => ({
  id,
  chat_id: selectedChat.id,
  channel_id: selectedChat.channel_id,
  direction: 'inbound',
  message_type: messageType,
  delivery_status: 'received',
  text_content: null,
  media_url: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
  message_at: createdAt,
  metadata: {},
  created_at: createdAt,
});

const mutableRef = <T,>(current: T): MutableRefObject<T> => ({ current });
const noop = () => undefined;

const renderThread = (messageTimelineItems: InboxMessageTimelineItem[], messages: CommWhatsAppMessage[]) => renderToStaticMarkup(
  <WhatsAppMessageThread
    messagesContainerRef={mutableRef<HTMLDivElement | null>(null)}
    messageBubbleRefs={mutableRef<Record<string, HTMLDivElement | null>>({})}
    reactionAnchorRefs={mutableRef<Record<string, HTMLDivElement | null>>({})}
    reactionTriggerRefs={mutableRef<Record<string, HTMLButtonElement | null>>({})}
    messageActionTriggerRefs={mutableRef<Record<string, HTMLButtonElement | null>>({})}
    handleMessagesScroll={noop}
    messageLoadErrorNotice={null}
    hasOlderMessages={false}
    loadingOlderMessages={false}
    handleLoadOlderMessages={noop}
    loadingMessages={false}
    messageLoadError={null}
    threadReconcileChatId={null}
    selectedChat={selectedChat}
    messages={messages}
    messageTimelineItems={messageTimelineItems}
    highlightedMessageId={null}
    mediaUploadProgress={null}
    retryingMessageId={null}
    localOutgoingRetryPayloadRef={mutableRef(new Set<string>())}
    setLightboxMessageId={noop}
    handleCancelMediaUpload={noop}
    openMessageActionMenuMessageId={null}
    handleToggleMessageActionMenu={noop}
    starringMessageIds={new Set()}
    handleToggleStarMessage={noop}
    setRetryPendingMessage={noop}
    handleToggleReactionPicker={noop}
    handleOpenMessageActionMenuFromContext={noop}
    handleOpenQuotedMessage={noop}
    handleTranscribeMessage={noop}
    handleSelectInteractiveReply={noop}
    handleOpenSharedContactChat={noop}
    handleSaveSharedContact={noop}
    sharedContactActionKey={null}
    transcribingMessageId={null}
  />,
);

const assertMediaMetaHasConsistentSpacing = (markup: string) => {
  const classLists = [...markup.matchAll(/class="([^"]*)"/g)]
    .map((match) => match[1]?.split(/\s+/) ?? []);
  const classes = classLists.filter((classList) => classList.includes('whatsapp-inbox-media-meta'));

  assert.equal(classes.length, 1);
  assert.ok(classes[0]?.includes('whatsapp-inbox-media-meta'));
};

test('mantém o horário de mídia inbound recuado e antes das reações', () => {
  const message = {
    ...createMessage('image-1', 'image'),
    metadata: {
      reactions: [{ emoji: '💗', actor_key: 'contact-demo', from_name: 'Contato de demonstração' }],
    },
  };
  const markup = renderThread([{ type: 'message', key: 'message:image-1', message }], [message]);

  assertMediaMetaHasConsistentSpacing(markup);
  assert.ok(markup.indexOf('whatsapp-inbox-media-meta') < markup.indexOf('💗'));
});

test('mantém o horário do último item de grupo inbound afastado da borda', () => {
  const firstMessage = createMessage('image-1', 'image');
  const lastMessage = createMessage('image-2', 'image');
  const markup = renderThread([
    { type: 'media-group', key: 'media-group:image-1:image-2', messages: [firstMessage, lastMessage] },
  ], [firstMessage, lastMessage]);

  assertMediaMetaHasConsistentSpacing(markup);
});
