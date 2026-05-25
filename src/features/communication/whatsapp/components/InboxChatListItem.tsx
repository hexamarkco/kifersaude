import { memo } from 'react';
import { Archive, BellOff, ChevronDown, Loader2, Pin } from 'lucide-react';
import type { CommWhatsAppChat } from '../../../../lib/supabase';
import { ChatPreviewIcon } from './ChatPreviewIcon';
import {
  formatMessageTime, getChatPreviewIconType, getDeliveryStatusMetaFromValues,
  getSafeChatDisplayName, getVisiblePreviewText,
} from './InboxComponentsShared';

type InboxChatListItemProps = {
  chat: CommWhatsAppChat;
  selected: boolean;
  connectedUserName: string | null;
  draftPreview: string;
  onSelect: (chatId: string) => void;
  menuOpen: boolean;
  menuBusy: boolean;
  onToggleMenu: (chatId: string) => void;
  onOpenContextMenu: (chatId: string, anchor: { x: number; y: number }) => void;
  menuTriggerRef: (node: HTMLButtonElement | null) => void;
};

function InboxChatListItemBase({ chat, selected, connectedUserName, draftPreview, onSelect, menuOpen, menuBusy, onToggleMenu, onOpenContextMenu, menuTriggerRef }: InboxChatListItemProps) {
  const rawLastMessageText = String(chat.last_message_text ?? '').trim();
  const visibleLastMessageText = getVisiblePreviewText(chat.last_message_text);
  const previewIconType = getChatPreviewIconType(visibleLastMessageText);
  const outboundPreviewStatusMeta = chat.last_message_direction === 'outbound' ? getDeliveryStatusMetaFromValues(chat.last_message_delivery_status) : null;
  const OutboundPreviewStatusIcon = outboundPreviewStatusMeta?.icon;
  const hasUnreadBadge = chat.unread_count > 0 || chat.manual_unread;

  return (
    <div className={`group/chat relative whatsapp-inbox-chat-card border-b transition ${selected ? 'is-active' : ''}`} onContextMenu={(event) => { event.preventDefault(); onOpenContextMenu(chat.id, { x: event.clientX, y: event.clientY }); }}>
      <div className="px-4 py-3">
        <button type="button" onClick={() => onSelect(chat.id)} className="min-w-0 w-full text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="whatsapp-inbox-heading truncate text-sm font-semibold text-[var(--panel-text,#1f2937)]">{getSafeChatDisplayName(chat, connectedUserName)}</p>
                {chat.is_pinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-[var(--panel-accent-strong,#c86f1d)]" /> : null}
                {chat.is_archived ? <Archive className="h-3.5 w-3.5 shrink-0 text-[var(--panel-text-muted,#8a735f)]" /> : null}
                {chat.is_muted ? <BellOff className="h-3.5 w-3.5 shrink-0 text-[var(--panel-text-muted,#8a735f)]" /> : null}
              </div>
            </div>
            <div className="flex shrink-0 items-start">
              <span className="whatsapp-inbox-chat-meta text-[11px] font-medium leading-none">{formatMessageTime(chat.last_message_at)}</span>
            </div>
          </div>
          <p className={`mt-px truncate text-sm text-[var(--panel-text-muted,#6b7280)] ${hasUnreadBadge ? 'pr-12' : ''}`}>
            {draftPreview ? (
              <><span className="mr-1 font-semibold text-[var(--panel-accent-red-text,#d9776b)]">Rascunho:</span><span>{draftPreview}</span></>
            ) : visibleLastMessageText ? (
              <>
                {OutboundPreviewStatusIcon && outboundPreviewStatusMeta ? (
                  <span className={`mr-1 inline-flex align-middle whatsapp-inbox-preview-status whatsapp-inbox-preview-status-${outboundPreviewStatusMeta.tone}`} title={outboundPreviewStatusMeta.label} aria-label={outboundPreviewStatusMeta.label}>
                    <OutboundPreviewStatusIcon className="h-3.5 w-3.5" />
                  </span>
                ) : null}
                {previewIconType ? <ChatPreviewIcon type={previewIconType} /> : <span>{visibleLastMessageText}</span>}
              </>
            ) : rawLastMessageText ? null : 'Sem mensagens ainda'}
          </p>
          {hasUnreadBadge ? (
            <span className="whatsapp-inbox-unread-badge absolute right-4 top-1/2 inline-flex min-h-5 min-w-6 -translate-y-1/2 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-semibold">
              {chat.unread_count > 0 ? chat.unread_count : '•'}
            </span>
          ) : null}
        </button>
      </div>

      <button
        ref={menuTriggerRef} type="button" onClick={(event) => { event.stopPropagation(); onToggleMenu(chat.id); }}
        className={`absolute right-3 top-2.5 z-[2] inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--panel-text-muted,#8a735f)] transition hover:bg-[rgba(255,248,240,0.08)] hover:text-[var(--panel-text,#f3e6d7)] ${menuOpen ? 'bg-[rgba(255,248,240,0.08)] text-[var(--panel-text,#f3e6d7)] opacity-100' : 'opacity-0 group-hover/chat:opacity-100 group-focus-within/chat:opacity-100'} ${selected ? 'opacity-100' : ''}`}
        aria-label="Abrir menu da conversa" aria-expanded={menuOpen} disabled={menuBusy}
      >
        {menuBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className={`h-3.5 w-3.5 transition ${menuOpen ? 'rotate-180' : ''}`} />}
      </button>
    </div>
  );
}

export const InboxChatListItem = memo(InboxChatListItemBase);
