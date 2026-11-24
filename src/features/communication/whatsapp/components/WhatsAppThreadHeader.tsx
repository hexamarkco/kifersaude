import { ArrowUpRight, Calendar, CalendarClock, ChevronLeft, MoreHorizontal, PanelRight, UserRound, Users } from 'lucide-react';
import type { RefObject } from 'react';

import { Badge, Button, ButtonGroup, Heading, IconButton, OperationalStatusSelect, type OperationalStatusSelectOption } from '../../../../design-system';
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
  scheduledMessagesPanelOpen: boolean;
  threadActionsMenuOpen: boolean;
  contactContextPanelOpen: boolean;
  threadActionsMenuTriggerRef: RefObject<HTMLButtonElement>;
  chatAgendaSummary: ChatAgendaSummary;
  nextChatReminderSummary: string | null;
  chatAgendaSummaryError: string | null;
  onBack: () => void;
  onOpenScheduledMessages: () => void;
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
  scheduledMessagesPanelOpen,
  threadActionsMenuOpen,
  contactContextPanelOpen,
  threadActionsMenuTriggerRef,
  chatAgendaSummary,
  nextChatReminderSummary,
  chatAgendaSummaryError,
  onBack,
  onOpenScheduledMessages,
  onToggleContactContextPanel,
  onToggleThreadActionsMenu,
}: WhatsAppThreadHeaderProps) {
  const agendaBadge = nextChatReminderSummary ? (
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
    <>
      <header className="whatsapp-inbox-thread-header border-b">
        <div className="whatsapp-inbox-thread-identity">
          <IconButton variant="ghost" size="md" type="button" onClick={onBack} className="whatsapp-inbox-thread-back" aria-label="Voltar para a lista de conversas">
            <ChevronLeft aria-hidden="true" />
          </IconButton>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <Heading level={2} family="interface" weight="semibold" size="lg" className="whatsapp-inbox-heading min-w-0 truncate" title={selectedChatDisplayName}>
                {selectedChat.is_group ? <Users className="sr-only" aria-label="Grupo" /> : null}
                {selectedChatDisplayName}
              </Heading>
            </div>
          </div>
        </div>
        <div className="whatsapp-inbox-thread-actions">
          <ButtonGroup className="whatsapp-inbox-action-group kds-control-group-md" role="group" aria-label="Ações da conversa">
            <IconButton type="button" onClick={onOpenScheduledMessages} variant={scheduledMessagesPanelOpen ? 'secondary' : 'ghost'} aria-label="Ver mensagens agendadas desta conversa" title="Mensagens agendadas desta conversa" size="md"><CalendarClock className="kds-control-icon" /></IconButton>
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
          </ButtonGroup>
          <IconButton ref={threadActionsMenuTriggerRef} type="button" onClick={onToggleThreadActionsMenu} variant={threadActionsMenuOpen ? 'secondary' : 'ghost'} className="whatsapp-inbox-thread-overflow" aria-label="Abrir ações da conversa" aria-expanded={threadActionsMenuOpen} title="Ações da conversa" size="md">
            <MoreHorizontal aria-hidden="true" />
          </IconButton>
        </div>
      </header>
      {!selectedChat.is_group && (selectedChat.lead_id || agendaBadge) ? (
        <div className="whatsapp-inbox-conversation-context" aria-label="Contexto da conversa">
          {selectedChat.lead_id ? <>
            <span className="whatsapp-inbox-conversation-context-label"><UserRound className="kds-control-icon" aria-hidden="true" />Lead em acompanhamento</span>
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
          </> : null}
          {agendaBadge}
          {selectedChat.lead_id ? <Button size="sm" variant="text" onClick={onToggleContactContextPanel} aria-pressed={contactContextPanelOpen}>
            {contactContextPanelOpen ? 'Ocultar negociação' : 'Ver negociação'} <ArrowUpRight className="kds-control-icon" aria-hidden="true" />
          </Button> : null}
        </div>
      ) : null}
    </>
  );
}
