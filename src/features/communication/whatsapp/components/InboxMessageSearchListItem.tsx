import { memo } from 'react';
import type { CommWhatsAppMessageSearchResult } from '../../../../lib/commWhatsAppService';
import { ChatPreviewIcon } from './ChatPreviewIcon';
import { formatMessageTime, getChatPreviewIconType, getMessageSearchPreviewText, getSafeChatDisplayName } from './InboxComponentsShared';

function InboxMessageSearchListItemBase({ result, selected, connectedUserName, onSelect }: {
  result: CommWhatsAppMessageSearchResult; selected: boolean; connectedUserName?: string | null; onSelect: (chatId: string) => void;
}) {
  const messagePreviewText = getMessageSearchPreviewText(result.message);
  const messagePreviewIconType = getChatPreviewIconType(messagePreviewText);
  if (!messagePreviewText) return null;

  return (
    <div className={`relative border-b transition ${selected ? 'is-active' : ''}`}>
      <div className="px-4 py-3">
        <button type="button" onClick={() => onSelect(result.chat.id)} className="min-w-0 w-full text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="whatsapp-inbox-heading truncate text-sm font-semibold text-[var(--panel-text,#1f2937)]">{getSafeChatDisplayName(result.chat, connectedUserName)}</p>
              {messagePreviewText ? (
                <p className="mt-px truncate text-sm text-[var(--panel-text-muted,#6b7280)]">
                  {messagePreviewIconType ? <ChatPreviewIcon type={messagePreviewIconType} /> : messagePreviewText}
                </p>
              ) : null}
            </div>
            <span className="whatsapp-inbox-chat-meta shrink-0 pt-0.5 text-[11px] font-medium leading-none">{formatMessageTime(result.message.message_at)}</span>
          </div>
        </button>
      </div>
    </div>
  );
}

export const InboxMessageSearchListItem = memo(InboxMessageSearchListItemBase);
