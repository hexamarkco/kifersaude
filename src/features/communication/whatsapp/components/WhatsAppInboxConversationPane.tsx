import type { ComponentProps, DragEventHandler } from 'react';
import { MessageCircle } from 'lucide-react';

import type { CommWhatsAppChat } from '../domain/types';
import { WhatsAppChatMessageSearch } from './WhatsAppChatMessageSearch';
import { WhatsAppComposer } from './WhatsAppComposer';
import { WhatsAppMessageThread } from './WhatsAppMessageThread';
import { WhatsAppThreadHeader } from './WhatsAppThreadHeader';

type ThreadHeaderProps = Omit<ComponentProps<typeof WhatsAppThreadHeader>, 'selectedChat'>;
type MessageThreadProps = Omit<ComponentProps<typeof WhatsAppMessageThread>, 'selectedChat'>;
type ComposerProps = Omit<ComponentProps<typeof WhatsAppComposer>, 'selectedChat'>;

export type WhatsAppInboxConversationView = {
  selectedChat: CommWhatsAppChat;
  header: ThreadHeaderProps;
  messageSearch: ComponentProps<typeof WhatsAppChatMessageSearch> | null;
  thread: MessageThreadProps;
  removedAttachment: { fileName: string; onUndo: () => void } | null;
  composer: ComposerProps;
};

type WhatsAppInboxConversationPaneProps = {
  conversation: WhatsAppInboxConversationView | null;
  isDraggingFilesOverThread: boolean;
  onDragEnter: DragEventHandler<HTMLDivElement>;
  onDragOver: DragEventHandler<HTMLDivElement>;
  onDragLeave: DragEventHandler<HTMLDivElement>;
  onDrop: DragEventHandler<HTMLDivElement>;
};

export const WhatsAppInboxConversationPane = ({
  conversation,
  isDraggingFilesOverThread,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
}: WhatsAppInboxConversationPaneProps) => (
  <div
    className={`whatsapp-inbox-panel whatsapp-inbox-thread relative h-full min-h-0 flex-col border shadow-sm lg:flex lg:rounded-l-none lg:border-l-0 ${conversation ? 'flex' : 'hidden lg:flex'}`}
    onDragEnter={onDragEnter}
    onDragOver={onDragOver}
    onDragLeave={onDragLeave}
    onDrop={onDrop}
  >
    {isDraggingFilesOverThread ? (
      <div className="pointer-events-none absolute inset-2 z-[3] flex items-center justify-center rounded-2xl border-2 border-dashed border-[var(--brand-primary)] bg-[var(--brand-primary-soft)]/90">
        <p className="whatsapp-inbox-heading text-sm font-semibold text-[var(--brand-primary)]">Solte para anexar à conversa</p>
      </div>
    ) : null}
    {conversation ? (
      <>
        <WhatsAppThreadHeader selectedChat={conversation.selectedChat} {...conversation.header} />
        {conversation.messageSearch ? <WhatsAppChatMessageSearch {...conversation.messageSearch} /> : null}
        <WhatsAppMessageThread selectedChat={conversation.selectedChat} {...conversation.thread} />
        {conversation.removedAttachment ? (
          <div className="mx-2.5 mt-2.5 flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-secondary)] sm:mx-3">
            <span className="truncate">Anexo removido: {conversation.removedAttachment.fileName}</span>
            <button
              type="button"
              onClick={conversation.removedAttachment.onUndo}
              className="shrink-0 text-xs font-semibold text-[var(--brand-primary)] hover:underline"
            >
              Desfazer
            </button>
          </div>
        ) : null}
        <WhatsAppComposer selectedChat={conversation.selectedChat} {...conversation.composer} />
      </>
    ) : (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <MessageCircle className="h-10 w-10 whatsapp-inbox-empty-icon" />
        <div className="space-y-1">
          <p className="whatsapp-inbox-heading text-base font-semibold text-[var(--text-primary)]">Selecione uma conversa</p>
          <p className="text-sm text-[var(--text-secondary)]">Abra um chat na coluna da esquerda para acompanhar o histórico e responder.</p>
        </div>
      </div>
    )}
  </div>
);
