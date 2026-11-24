import { Calendar, ChevronLeft, Copy, MoreHorizontal, PanelRight, Users } from 'lucide-react';
import type { RefObject } from 'react';

import { Badge, ButtonGroup, Heading, IconButton, OperationalStatusSelect, type OperationalStatusSelectOption } from '../../../../design-system';
import { isOverdue } from '../../../../lib/dateUtils';
import type { CommWhatsAppChat } from '../domain/types';

type ChatAgendaSummary = {
  pendingCount: number;
  nextReminder: {
    data_lembrete: string;
  } | null;
};

type WhatsAppThreadHeaderProps = {
  selectedChat: CommWhatsAppChat;
  selectedChatDisplayName: string;
  leadStatus: string | null;
  leadStatusOptions: readonly OperationalStatusSelectOption[];
  leadStatusUpdating: boolean;
  leadStatusDisabled: boolean;
  onLeadStatusChange: (status: string) => void;
  copyingTranscript: boolean;
  threadActionsMenuOpen: boolean;
  contactContextPanelOpen: boolean;
  threadActionsMenuTriggerRef: RefObject<HTMLButtonElement>;
  chatAgendaSummary: ChatAgendaSummary;
  nextChatReminderSummary: string | null;
  chatAgendaSummaryError: string | null;
  onBack: () => void;
  onCopyTranscript: () => void;
  onToggleContactContextPanel: () => void;
  onToggleThreadActionsMenu: () => void;
};

export function WhatsAppThreadHeader({
  selectedChat,
  selectedChatDisplayName,
  leadStatus,
  leadStatusOptions,
  leadStatusUpdating,
  leadStatusDisabled,
  onLeadStatusChange,
  copyingTranscript,
  threadActionsMenuOpen,
  contactContextPanelOpen,
  threadActionsMenuTriggerRef,
  chatAgendaSummary,
  nextChatReminderSummary,
  chatAgendaSummaryError,
  onBack,
  onCopyTranscript,
  onToggleContactContextPanel,
  onToggleThreadActionsMenu,
}: WhatsAppThreadHeaderProps) {
  const agendaBadge = !selectedChat.is_group && nextChatReminderSummary ? (
    <Badge
      size="sm"
      className="min-w-0 max-w-full"
      tone={chatAgendaSummaryError ? 'warning' : chatAgendaSummary.nextReminder && isOverdue(chatAgendaSummary.nextReminder.data_lembrete) ? 'danger' : 'neutral'}
      icon={Calendar}
      title={chatAgendaSummaryError ? 'Abra as informações do lead para tentar carregar a agenda novamente.' : nextChatReminderSummary}
    >
      <span className="min-w-0 max-w-full truncate">{nextChatReminderSummary}</span>
    </Badge>
  ) : null;

  return (
    <header className="whatsapp-inbox-thread-header border-b">
      <div className="whatsapp-inbox-thread-identity">
        <IconButton variant="ghost" size="md" type="button" onClick={onBack} className="whatsapp-inbox-thread-back" aria-label="Voltar para a lista de conversas">
          <ChevronLeft aria-hidden="true" />
        </IconButton>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <div className="whatsapp-inbox-thread-name">
            <Heading level={2} family="interface" weight="semibold" size="lg" className="whatsapp-inbox-heading min-w-0 truncate" title={selectedChatDisplayName}>
              {selectedChat.is_group ? <Users className="sr-only" aria-label="Grupo" /> : null}
              {selectedChatDisplayName}
            </Heading>
            {!selectedChat.is_group && selectedChat.lead_id ? (
              <OperationalStatusSelect
                value={leadStatus ?? ''}
                options={leadStatusOptions}
                triggerLabel={leadStatus || 'Sem status'}
                onValueChange={onLeadStatusChange}
                triggerAriaLabel={`Alterar status do lead ${selectedChatDisplayName}: ${leadStatus || 'Sem status'}`}
                menuAriaLabel="Alterar status do lead"
                loading={leadStatusUpdating}
                disabled={leadStatusDisabled}
              />
            ) : null}
          </div>
          {agendaBadge}
        </div>
      </div>
      <div className="whatsapp-inbox-thread-actions">
        <ButtonGroup className="whatsapp-inbox-action-group kds-control-group-md" role="group" aria-label="Ações da conversa">
          {!selectedChat.is_group ? (
            <IconButton
              type="button"
              onClick={onToggleContactContextPanel}
              variant={contactContextPanelOpen ? 'secondary' : 'ghost'}
              aria-label={contactContextPanelOpen ? 'Fechar informações do contato' : 'Abrir informações do contato'}
              aria-pressed={contactContextPanelOpen}
              title={contactContextPanelOpen ? 'Fechar informações do contato' : 'Informações do contato'}
              size="md"
            >
              <span className="relative inline-flex">
                <PanelRight className="kds-control-icon" aria-hidden="true" />
                {chatAgendaSummary.pendingCount > 0 ? <span className="kds-sidebar-badge whatsapp-inbox-count-badge" aria-label={`${chatAgendaSummary.pendingCount} lembretes pendentes`}>{chatAgendaSummary.pendingCount > 9 ? '9+' : chatAgendaSummary.pendingCount}</span> : null}
              </span>
            </IconButton>
          ) : null}
          <IconButton type="button" onClick={onCopyTranscript} loading={copyingTranscript} variant="ghost" aria-label="Copiar conversa formatada" title="Copiar conversa formatada" size="md">
            <Copy className="kds-control-icon" aria-hidden="true" />
          </IconButton>
        </ButtonGroup>
        {selectedChat.is_group && (
          <IconButton ref={threadActionsMenuTriggerRef} type="button" onClick={onToggleThreadActionsMenu} variant={threadActionsMenuOpen ? 'secondary' : 'ghost'} aria-label="Abrir ações da conversa" aria-expanded={threadActionsMenuOpen} aria-haspopup="menu" title="Ações da conversa" size="md">
            <MoreHorizontal aria-hidden="true" />
          </IconButton>
        )}
      </div>
    </header>
  );
}
