import { createRoot } from 'react-dom/client';
import type { MutableRefObject } from 'react';
import '../../../src/index.css';
import { WhatsAppMessageThread } from '../../../src/features/communication/whatsapp/components/WhatsAppMessageThread';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../../../src/features/communication/whatsapp/domain/types';
import type { InboxMessageTimelineItem } from '../../../src/features/communication/whatsapp/domain/inboxMessageTimeline';

const timestamp = '2026-10-30T12:00:00.000Z';
const chat: CommWhatsAppChat = {
  id: 'chat-demo', channel_id: 'channel-demo', external_chat_id: '5511999999999@s.whatsapp.net', is_group: false,
  phone_number: '+55 (11) 99999-9999', phone_digits: '5511999999999', display_name: 'Contato de demonstração',
  merged_into_chat_id: null, lead_link_source: null, lead_linked_at: null, lead_linked_by: null,
  auto_link_blocked: false, identity_conflict: false, is_archived: false, is_muted: false, is_pinned: false,
  manual_unread: false, last_message_direction: 'inbound', unread_count: 0, status: 'open',
  autonomous_attendance_status: 'inactive', created_at: timestamp, updated_at: timestamp,
};
const message: CommWhatsAppMessage = {
  id: 'message-demo', chat_id: chat.id, channel_id: chat.channel_id, direction: 'inbound', message_type: 'image',
  delivery_status: 'received', text_content: null,
  media_url: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
  message_at: timestamp, metadata: { reactions: [{ emoji: '💗', actor_key: 'contact-demo', from_name: 'Contato de demonstração' }] }, created_at: timestamp,
};
const ref = <T,>(current: T): MutableRefObject<T> => ({ current });
const noop = () => undefined;
const items: InboxMessageTimelineItem[] = [{ type: 'message', key: 'message:demo', message }];

createRoot(document.getElementById('root')!).render(
  <main className="painel-theme kifer-ds comm-terracotta theme-dark" style={{ height: '100dvh' }}>
    <section className="whatsapp-inbox-thread relative flex h-full min-h-0 flex-col">
      <header className="whatsapp-inbox-thread-header flex shrink-0 items-center border-b px-4 py-3">Conversa de demonstração</header>
      <WhatsAppMessageThread
        messagesContainerRef={ref<HTMLDivElement | null>(null)}
        messageBubbleRefs={ref<Record<string, HTMLDivElement | null>>({})}
        reactionAnchorRefs={ref<Record<string, HTMLDivElement | null>>({})}
        reactionTriggerRefs={ref<Record<string, HTMLButtonElement | null>>({})}
        messageActionTriggerRefs={ref<Record<string, HTMLButtonElement | null>>({})}
        handleMessagesScroll={noop}
        messageLoadErrorNotice={null}
        hasOlderMessages={false}
        loadingOlderMessages={false}
        handleLoadOlderMessages={noop}
        loadingMessages={false}
        messageLoadError={null}
        threadReconcileChatId={null}
        selectedChat={chat}
        messages={[message]}
        messageTimelineItems={items}
        highlightedMessageId={null}
        mediaUploadProgress={null}
        retryingMessageId={null}
        localOutgoingRetryPayloadRef={ref(new Set<string>())}
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
      />
    </section>
  </main>,
);
