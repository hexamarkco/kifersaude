import { Check } from 'lucide-react';

import {
  Button,
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  SearchInput,
} from '../../../../design-system';
import { LeadFavoriteBadge } from '../../../../components/LeadFavoriteStar';
import { formatCommWhatsAppPhoneLabel } from '../domain/phonePresentation';
import { getSafeChatDisplayName } from '../domain/chatPresentation';
import { getMessageSearchPreviewText } from '../domain/messagePresentation';
import type { CommWhatsAppChat, CommWhatsAppMessage } from '../domain/types';

type WhatsAppInboxDialogsProps = {
  forwardingMessage: CommWhatsAppMessage | null;
  forwardSearch: string;
  forwardTargetChats: CommWhatsAppChat[];
  forwardingTargetIds: string[];
  forwardingInProgress: boolean;
  connectedUserName: string | null;
  favoritedLeadIds: ReadonlySet<string>;
  onCloseForwardMessage: () => void;
  onForwardSearchChange: (value: string) => void;
  onToggleForwardTarget: (chatId: string) => void;
  onForwardToSelectedChats: () => void;
  chatPendingDeletion: CommWhatsAppChat | null;
  deletingChatId: string | null;
  onCloseChatDeletion: () => void;
  onDeleteChat: (chat: CommWhatsAppChat) => Promise<void>;
  messagePendingDeletion: CommWhatsAppMessage | null;
  deletingMessageId: string | null;
  onCloseMessageDeletion: () => void;
  onDeleteMessage: (message: CommWhatsAppMessage) => Promise<void>;
  retryPendingMessage: CommWhatsAppMessage | null;
  retryingMessageId: string | null;
  onCloseRetryMessage: () => void;
  onRetryMediaMessage: (message: CommWhatsAppMessage) => Promise<void>;
  saveContactDialogOpen: boolean;
  savedContactNameExists: boolean;
  saveContactName: string;
  savingContact: boolean;
  onCloseSaveContact: () => void;
  onSaveContactNameChange: (value: string) => void;
  onSaveContact: () => void;
};

export function WhatsAppInboxDialogs({
  forwardingMessage,
  forwardSearch,
  forwardTargetChats,
  forwardingTargetIds,
  forwardingInProgress,
  connectedUserName,
  favoritedLeadIds,
  onCloseForwardMessage,
  onForwardSearchChange,
  onToggleForwardTarget,
  onForwardToSelectedChats,
  chatPendingDeletion,
  deletingChatId,
  onCloseChatDeletion,
  onDeleteChat,
  messagePendingDeletion,
  deletingMessageId,
  onCloseMessageDeletion,
  onDeleteMessage,
  retryPendingMessage,
  retryingMessageId,
  onCloseRetryMessage,
  onRetryMediaMessage,
  saveContactDialogOpen,
  savedContactNameExists,
  saveContactName,
  savingContact,
  onCloseSaveContact,
  onSaveContactNameChange,
  onSaveContact,
}: WhatsAppInboxDialogsProps) {
  return (
    <>
      {forwardingMessage ? (
        <Dialog open onOpenChange={(open) => { if (!open) onCloseForwardMessage(); }} size="sm" closeOnEscape={false} closeOnOverlay={false} aria-label="Encaminhar mensagem" className="comm-whatsapp-overlay">
          <DialogHeader onClose={onCloseForwardMessage}>
            <div><DialogTitle>Encaminhar mensagem</DialogTitle><p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">{getMessageSearchPreviewText(forwardingMessage)}</p></div>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <SearchInput value={forwardSearch} onChange={(event) => onForwardSearchChange(event.target.value)} placeholder="Buscar conversa" />
            <div className="max-h-[45vh] space-y-1 overflow-y-auto pr-1">
              {forwardTargetChats.length > 0 ? forwardTargetChats.map((chat) => {
                const isSelected = forwardingTargetIds.includes(chat.id);
                return (
                  <button key={chat.id} type="button" onClick={() => onToggleForwardTarget(chat.id)} disabled={forwardingInProgress} className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-[var(--bg-hover)] disabled:opacity-70 ${isSelected ? 'bg-[var(--brand-primary-soft)] ring-1 ring-[var(--brand-primary-border)]' : ''}`}>
                    <div className="min-w-0"><p className="flex items-center gap-1.5 truncate text-sm font-semibold text-[var(--text-primary)]"><LeadFavoriteBadge favorito={chat.lead_id ? favoritedLeadIds.has(chat.lead_id) : false} />{getSafeChatDisplayName(chat, connectedUserName)}</p><p className="truncate text-xs text-[var(--text-secondary)]">{formatCommWhatsAppPhoneLabel(chat.phone_number)}</p></div>
                    {isSelected ? <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--text-inverse)]"><Check className="h-3 w-3" /></span> : <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--bg-surface)]" />}
                  </button>
                );
              }) : <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] p-5 text-center text-sm text-[var(--text-secondary)]">Nenhuma conversa encontrada.</div>}
            </div>
          </DialogBody>
          <DialogFooter className="gap-2">
            <Button variant="secondary" onClick={onCloseForwardMessage} disabled={forwardingInProgress}>Cancelar</Button>
            <Button variant="primary" onClick={onForwardToSelectedChats} loading={forwardingInProgress} disabled={forwardingInProgress || forwardingTargetIds.length === 0}>{forwardingTargetIds.length > 0 ? `Encaminhar para ${forwardingTargetIds.length} ${forwardingTargetIds.length === 1 ? 'conversa' : 'conversas'}` : 'Encaminhar'}</Button>
          </DialogFooter>
        </Dialog>
      ) : null}

      <ConfirmDialog open={Boolean(chatPendingDeletion)} onOpenChange={(open) => { if (!open) onCloseChatDeletion(); }} onConfirm={async () => { if (chatPendingDeletion) { await onDeleteChat(chatPendingDeletion); onCloseChatDeletion(); } }} title="Excluir conversa" description="Excluir esta conversa da Inbox? Novas mensagens recebidas do contato podem reabrir a conversa." confirmLabel="Excluir" destructive loading={Boolean(chatPendingDeletion && deletingChatId === chatPendingDeletion.id)} />
      <ConfirmDialog open={Boolean(messagePendingDeletion)} onOpenChange={(open) => { if (!open) onCloseMessageDeletion(); }} onConfirm={async () => { if (messagePendingDeletion) { await onDeleteMessage(messagePendingDeletion); onCloseMessageDeletion(); } }} title="Apagar mensagem" description="Apagar esta mensagem no WhatsApp para todos?" confirmLabel="Apagar" destructive loading={Boolean(messagePendingDeletion && deletingMessageId === messagePendingDeletion.id)} />
      <ConfirmDialog open={Boolean(retryPendingMessage)} onOpenChange={(open) => { if (!open) onCloseRetryMessage(); }} onConfirm={async () => { if (retryPendingMessage) { await onRetryMediaMessage(retryPendingMessage); onCloseRetryMessage(); } }} title="Reenviar mensagem" description="Confirme que a mensagem anterior realmente não chegou no WhatsApp antes de reenviar. Reenviar uma mensagem que já foi entregue cria uma duplicata para o contato." confirmLabel="Reenviar mesmo assim" loading={Boolean(retryPendingMessage && retryingMessageId === retryPendingMessage.id)} />

      <Dialog open={saveContactDialogOpen} onOpenChange={(open) => { if (!open) onCloseSaveContact(); }} size="sm">
        <DialogHeader onClose={onCloseSaveContact} showCloseButton><DialogTitle>{savedContactNameExists ? 'Renomear contato' : 'Salvar contato'}</DialogTitle></DialogHeader>
        <DialogBody className="space-y-4">
          <DialogDescription>{savedContactNameExists ? 'Atualize o apelido deste contato aqui no CRM. Isso não altera o WhatsApp da pessoa nem a sua agenda de contatos do celular — é só para facilitar identificar essa conversa no Inbox.' : 'Escolha um apelido para este contato aqui no CRM. Isso não altera o WhatsApp da pessoa nem a sua agenda de contatos do celular — é só para facilitar identificar essa conversa no Inbox.'}</DialogDescription>
          <div><label className="mb-1 block text-sm font-medium text-[var(--text-primary)]" htmlFor="save-contact-name">Nome do contato</label><Input id="save-contact-name" type="text" value={saveContactName} onChange={(event) => onSaveContactNameChange(event.target.value)} placeholder="Nome do contato" autoFocus disabled={savingContact} onKeyDown={(event) => { if (event.key === 'Enter' && !savingContact) onSaveContact(); }} /></div>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onCloseSaveContact} disabled={savingContact}>Cancelar</Button><Button variant="primary" onClick={onSaveContact} loading={savingContact} disabled={savingContact}>{savedContactNameExists ? 'Renomear' : 'Salvar'}</Button></div>
        </DialogBody>
      </Dialog>
    </>
  );
}
