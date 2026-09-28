import { Forward, Info, Loader2, Pencil, Reply, Star, Trash2 } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';

import PanelPopoverShell from '../../../../components/ui/PanelPopoverShell';
import type { CommWhatsAppMessage } from '../domain/types';
import {
  canDeleteOutboundMessage,
  canEditOutboundMessage,
  canReplyOrForwardMessage,
  isMessageStarred,
} from '../domain/messagePresentation';
import { getOwnReactionEmoji } from '../domain/messageMetadata';

type WhatsAppMessagePopoversProps = {
  reactionPickerRef: RefObject<HTMLDivElement>;
  reactionPickerPosition: { top: number; left: number } | null;
  openReactionPickerMessage: CommWhatsAppMessage | null;
  reactionOptions: string[];
  reactingMessageIds: ReadonlySet<string>;
  onCloseReactionPicker: () => void;
  onReactToMessage: (message: CommWhatsAppMessage, emoji: string) => void;
  messageActionMenuRef: RefObject<HTMLDivElement>;
  messageActionMenuPosition: { top: number; left: number; width?: number; maxHeight?: number } | null;
  openMessageActionMenuMessage: CommWhatsAppMessage | null;
  starringMessageIds: ReadonlySet<string>;
  deletingMessageId: string | null;
  onCloseMessageActionMenu: () => void;
  onOpenMessageDetails: (message: CommWhatsAppMessage) => void;
  onReplyToMessage: (message: CommWhatsAppMessage) => void;
  onOpenForwardMessageModal: (message: CommWhatsAppMessage) => void;
  onToggleStarMessage: (message: CommWhatsAppMessage) => void;
  onOpenEditMessageModal: (message: CommWhatsAppMessage) => void;
  onRequestDeleteMessage: (message: CommWhatsAppMessage) => void;
};

export function WhatsAppMessagePopovers({
  reactionPickerRef,
  reactionPickerPosition,
  openReactionPickerMessage,
  reactionOptions,
  reactingMessageIds,
  onCloseReactionPicker,
  onReactToMessage,
  messageActionMenuRef,
  messageActionMenuPosition,
  openMessageActionMenuMessage,
  starringMessageIds,
  deletingMessageId,
  onCloseMessageActionMenu,
  onOpenMessageDetails,
  onReplyToMessage,
  onOpenForwardMessageModal,
  onToggleStarMessage,
  onOpenEditMessageModal,
  onRequestDeleteMessage,
}: WhatsAppMessagePopoversProps) {
  return (
    <>
      <PanelPopoverShell
        ref={reactionPickerRef}
        isOpen={Boolean(openReactionPickerMessage && reactionPickerPosition)}
        position={reactionPickerPosition}
        onClose={onCloseReactionPicker}
        ariaLabel="Seletor de reacoes da mensagem"
        className="before:hidden comm-whatsapp-reaction-picker"
      >
        {openReactionPickerMessage ? reactionOptions.map((emoji) => (
          <button
            key={`${openReactionPickerMessage.id}:${emoji}`}
            type="button"
            onClick={() => onReactToMessage(openReactionPickerMessage, emoji)}
            disabled={reactingMessageIds.has(openReactionPickerMessage.id)}
            className={`message-bubble-emoji-button inline-flex h-9 w-9 items-center justify-center rounded-full text-[1.45rem] leading-none transition ${getOwnReactionEmoji(openReactionPickerMessage) === emoji ? 'bg-[var(--brand-primary-soft)] scale-105' : 'hover:bg-[var(--bg-hover)]'}`}
            aria-label={`Reagir com ${emoji}`}
          >
            {emoji}
          </button>
        )) : null}
      </PanelPopoverShell>

      <PanelPopoverShell
        ref={messageActionMenuRef}
        isOpen={Boolean(openMessageActionMenuMessage && messageActionMenuPosition)}
        position={messageActionMenuPosition}
        onClose={onCloseMessageActionMenu}
        ariaLabel="Menu da mensagem"
        className="before:hidden overflow-y-auto rounded-2xl border-[var(--border-default)] bg-[var(--bg-elevated)] p-1 shadow-2xl"
        style={{ width: messageActionMenuPosition?.width ?? 268, maxHeight: messageActionMenuPosition?.maxHeight }}
      >
        {openMessageActionMenuMessage ? (
          <div className="flex flex-col gap-1">
            {openMessageActionMenuMessage.direction === 'outbound' ? <ActionButton icon={<Info className="h-4 w-4 shrink-0" />} label="Dados da mensagem" onClick={() => onOpenMessageDetails(openMessageActionMenuMessage)} /> : null}
            {canReplyOrForwardMessage(openMessageActionMenuMessage) ? (
              <>
                <ActionButton icon={<Reply className="h-4 w-4 shrink-0" />} label="Responder mensagem" onClick={() => onReplyToMessage(openMessageActionMenuMessage)} />
                <ActionButton icon={<Forward className="h-4 w-4 shrink-0" />} label="Encaminhar mensagem" onClick={() => onOpenForwardMessageModal(openMessageActionMenuMessage)} />
                <ActionButton
                  icon={starringMessageIds.has(openMessageActionMenuMessage.id) ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Star className={`h-4 w-4 shrink-0 ${isMessageStarred(openMessageActionMenuMessage) ? 'fill-current text-[var(--accent-gold)]' : ''}`} />}
                  label={isMessageStarred(openMessageActionMenuMessage) ? 'Remover estrela' : 'Estrelar mensagem'}
                  disabled={starringMessageIds.has(openMessageActionMenuMessage.id)}
                  onClick={() => onToggleStarMessage(openMessageActionMenuMessage)}
                />
              </>
            ) : null}
            {canEditOutboundMessage(openMessageActionMenuMessage) ? <ActionButton icon={<Pencil className="h-4 w-4 shrink-0" />} label={openMessageActionMenuMessage.message_type.trim().toLowerCase() === 'text' ? 'Editar mensagem' : 'Editar legenda'} onClick={() => onOpenEditMessageModal(openMessageActionMenuMessage)} /> : null}
            {canDeleteOutboundMessage(openMessageActionMenuMessage) ? <ActionButton destructive icon={deletingMessageId === openMessageActionMenuMessage.id ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Trash2 className="h-4 w-4 shrink-0" />} label="Apagar mensagem" disabled={deletingMessageId === openMessageActionMenuMessage.id} onClick={() => onRequestDeleteMessage(openMessageActionMenuMessage)} /> : null}
          </div>
        ) : null}
      </PanelPopoverShell>
    </>
  );
}

function ActionButton({ icon, label, onClick, disabled = false, destructive = false }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean; destructive?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`flex items-center gap-3 rounded-full px-3 py-2.5 text-left text-sm transition disabled:pointer-events-none disabled:opacity-60 ${destructive ? 'text-[var(--danger-text)] hover:bg-[var(--danger-soft)]' : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'}`}>{icon}<span>{label}</span></button>;
}
