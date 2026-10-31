import type { MutableRefObject } from 'react';
import { createRoot } from 'react-dom/client';

import { WhatsAppMessageThread } from '../../../src/features/communication/whatsapp/components/WhatsAppMessageThread';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../../../src/features/communication/whatsapp/domain/types';
import type { InboxMessageTimelineItem } from '../../../src/features/communication/whatsapp/domain/inboxMessageTimeline';
import '../../../src/index.css';

const createdAt = '2026-10-30T12:45:00.000Z';
const selectedChat: CommWhatsAppChat = {
  id: 'preview-chat',
  channel_id: 'preview-channel',
  external_chat_id: 'preview@s.whatsapp.net',
  is_group: false,
  phone_number: '+55 (21) 90000-0000',
  phone_digits: '5521900000000',
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

const previewImage = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="260" viewBox="0 0 480 260"><rect width="480" height="260" fill="#ead9c8"/><rect x="22" y="22" width="436" height="216" rx="16" fill="#f4eee7"/><circle cx="162" cy="120" r="48" fill="#d16a3d"/><path d="M105 204l93-66 68 48 52-39 67 57H105z" fill="#9d6246"/></svg>')}`;

const inboundImage: CommWhatsAppMessage = {
  id: 'preview-inbound-image',
  chat_id: selectedChat.id,
  channel_id: selectedChat.channel_id,
  direction: 'inbound',
  message_type: 'image',
  delivery_status: 'received',
  text_content: null,
  media_url: previewImage,
  media_id: null,
  external_message_id: null,
  media_caption: null,
  message_at: createdAt,
  metadata: {
    reactions: [{ emoji: '💗', actor_key: 'preview-contact', from_name: 'Contato demonstração' }],
  },
  created_at: createdAt,
};

const mutableRef = <T,>(current: T): MutableRefObject<T> => ({ current });
const noop = () => undefined;
const messageTimelineItems: InboxMessageTimelineItem[] = [
  { type: 'message', key: `message:${inboundImage.id}`, message: inboundImage },
];

function InboxThreadPreview() {
  const theme = new URLSearchParams(window.location.search).get('theme') === 'light' ? 'theme-light' : 'theme-dark';

  return (
    <main className={`painel-theme kifer-ds comm-terracotta ${theme}`}>
      <style>{`
        html, body, #root { min-height: 100%; margin: 0; }
        body { background: var(--bg-canvas); }
        .preview-frame { min-height: 100dvh; display: flex; align-items: flex-end; padding: clamp(8px, 2vw, 24px); box-sizing: border-box; }
        .preview-thread { width: min(100%, 68rem); margin-inline: auto; min-height: 14rem; display: flex; flex-direction: column; border: 1px solid var(--border-subtle); border-radius: var(--radius-panel); background: var(--bg-canvas); }
        .preview-heading { margin: 0; padding: 12px 16px; border-bottom: 1px solid var(--border-subtle); color: var(--text-secondary); font: var(--type-caption); }
        .preview-message-media { overflow: hidden; width: min(18rem, 100%); border-radius: var(--radius-md); }
        .preview-message-media img { display: block; width: 100%; height: auto; aspect-ratio: 12 / 6.5; object-fit: cover; }
        @media (max-width: 767px) { .preview-thread { min-height: 12rem; } }
      `}</style>
      <div className="preview-frame">
        <section className="preview-thread whatsapp-inbox-thread" aria-label="Conversa de demonstração">
          <p className="preview-heading">Mensagem de mídia inbound com reação</p>
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
            messages={[inboundImage]}
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
          />
        </section>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<InboxThreadPreview />);
