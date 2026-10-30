import { Text } from '../../../../design-system';
import { Bot, Calendar, CalendarClock, ChevronLeft, Copy, Download, FolderOpen, Info, Loader2, MoreHorizontal, Pause, Search, Sparkles, Users } from 'lucide-react';
import type { RefObject } from 'react';

import { Badge, ButtonGroup, IconButton } from '../../../../design-system';
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
  isSelectedChatWaitingForQuote: boolean;
  assumingControl: boolean;
  chatFilesOpen: boolean;
  chatMessageSearchOpen: boolean;
  scheduledMessagesPanelOpen: boolean;
  copyingTranscript: boolean;
  syncingHistory: boolean;
  historyRecoveryDisabledReason: string | null;
  followUpGenerationDisabledReason: string | null;
  generatingFollowUp: boolean;
  threadActionsMenuOpen: boolean;
  contactContextPanelOpen: boolean;
  threadActionsMenuTriggerRef: RefObject<HTMLButtonElement>;
  chatAgendaSummary: ChatAgendaSummary;
  nextChatReminderSummary: string | null;
  chatAgendaSummaryError: string | null;
  onBack: () => void;
  onToggleAutonomousAttendance: () => void;
  onOpenChatFiles: () => void;
  onToggleChatMessageSearch: () => void;
  onOpenScheduledMessages: () => void;
  onCopyTranscript: () => void;
  onRecoverHistory: () => void;
  onOpenFollowUp: () => void;
  onToggleContactContextPanel: () => void;
  onToggleThreadActionsMenu: () => void;
};

export function WhatsAppThreadHeader({
  selectedChat,
  selectedChatDisplayName,
  isSelectedChatWaitingForQuote,
  assumingControl,
  chatFilesOpen,
  chatMessageSearchOpen,
  scheduledMessagesPanelOpen,
  copyingTranscript,
  syncingHistory,
  historyRecoveryDisabledReason,
  followUpGenerationDisabledReason,
  generatingFollowUp,
  threadActionsMenuOpen,
  contactContextPanelOpen,
  threadActionsMenuTriggerRef,
  chatAgendaSummary,
  nextChatReminderSummary,
  chatAgendaSummaryError,
  onBack,
  onToggleAutonomousAttendance,
  onOpenChatFiles,
  onToggleChatMessageSearch,
  onOpenScheduledMessages,
  onCopyTranscript,
  onRecoverHistory,
  onOpenFollowUp,
  onToggleContactContextPanel,
  onToggleThreadActionsMenu,
}: WhatsAppThreadHeaderProps) {
  const agendaBadge = nextChatReminderSummary ? (
    <Badge
      size="sm"
      className="min-w-0 max-w-full"
      tone={chatAgendaSummaryError ? 'warning' : chatAgendaSummary.nextReminder && isOverdue(chatAgendaSummary.nextReminder.data_lembrete) ? 'danger' : 'neutral'}
      icon={Calendar}
      title={chatAgendaSummaryError ? 'Abra as informações do lead para tentar carregar a agenda novamente.' : undefined}
    >
      <span className="min-w-0 max-w-full truncate">{nextChatReminderSummary}</span>
    </Badge>
  ) : null;

  return (
    <div className="whatsapp-inbox-thread-header flex flex-col gap-2 border-b lg:flex-row lg:items-start lg:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <IconButton variant="ghost" size="sm" type="button" onClick={onBack} className="mt-0.5 flex shrink-0 items-center justify-center transition lg:hidden" aria-label="Voltar para a lista de conversas">
          <ChevronLeft className="" />
        </IconButton>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <Text className="whatsapp-inbox-heading flex min-w-0 max-w-full items-center gap-1.5 text-base font-semibold leading-tight text-[var(--text-primary)] sm:text-lg">
                {selectedChat.is_group ? <Users className="h-4 w-4 shrink-0 text-[var(--brand-primary)]" aria-label="Grupo" /> : null}
                <span className="min-w-0 truncate">{selectedChatDisplayName}</span>
              </Text>
            </div>
            <IconButton ref={threadActionsMenuTriggerRef} type="button" onClick={onToggleThreadActionsMenu} variant={threadActionsMenuOpen ? 'secondary' : 'soft'} className="shrink-0 lg:hidden" aria-label="Abrir ações da conversa" aria-expanded={threadActionsMenuOpen} title="Ações da conversa" size="lg">
              <MoreHorizontal aria-hidden="true" />
            </IconButton>
          </div>
          {agendaBadge ? <div className="mt-1 flex min-w-0">{agendaBadge}</div> : null}
        </div>
      </div>
      <div className="hidden min-w-0 shrink-0 items-start lg:flex lg:justify-end">
        <div className="whatsapp-inbox-thread-actions flex min-w-0 items-center gap-2 lg:justify-end">
          <ButtonGroup className="whatsapp-inbox-action-group kds-control-group-md" role="group" aria-label="Ações da conversa">
            {!selectedChat.is_group && selectedChat.lead_id ? (
              <IconButton type="button" onClick={onToggleAutonomousAttendance} disabled={isSelectedChatWaitingForQuote} variant="icon" loading={assumingControl} aria-label={isSelectedChatWaitingForQuote ? 'IA encerrada enquanto aguarda cotação' : selectedChat.autonomous_attendance_status === 'active' ? 'Desativar IA neste chat' : 'Ativar IA neste chat'} title={isSelectedChatWaitingForQuote ? 'IA encerrada enquanto aguarda cotação' : selectedChat.autonomous_attendance_status === 'active' ? 'Desativar IA neste chat' : 'Ativar IA neste chat'} className={`whatsapp-inbox-ai-toggle ${selectedChat.autonomous_attendance_status === 'active' ? 'is-active' : 'is-inactive'}`} size="md">
                {selectedChat.autonomous_attendance_status === 'active' ? <Pause aria-hidden="true" /> : <Bot aria-hidden="true" />}
              </IconButton>
            ) : null}
            <IconButton type="button" onClick={onOpenChatFiles} variant={chatFilesOpen ? 'secondary' : 'ghost'} aria-label="Arquivos da conversa" title="Arquivos da conversa" size="md"><FolderOpen className="kds-control-icon" aria-hidden="true" /></IconButton>
            <IconButton type="button" onClick={onToggleChatMessageSearch} variant={chatMessageSearchOpen ? 'secondary' : 'ghost'} aria-label="Pesquisar mensagens neste chat" title="Pesquisar neste chat" size="md"><Search className="kds-control-icon" /></IconButton>
            <IconButton type="button" onClick={onOpenScheduledMessages} variant={scheduledMessagesPanelOpen ? 'secondary' : 'ghost'} aria-label="Ver mensagens agendadas desta conversa" title="Mensagens agendadas desta conversa" size="md"><CalendarClock className="kds-control-icon" /></IconButton>
            <IconButton type="button" onClick={onCopyTranscript} variant="ghost" aria-label="Copiar conversa formatada" title="Copiar conversa formatada" disabled={copyingTranscript} size="md">{copyingTranscript ? <Loader2 className="animate-spin" /> : <Copy aria-hidden="true" />}</IconButton>
            <IconButton type="button" onClick={onRecoverHistory} variant="ghost" aria-label="Recuperar mensagens antigas do chat" title={historyRecoveryDisabledReason ?? 'Recuperar mensagens antigas pela Whapi'} disabled={Boolean(historyRecoveryDisabledReason) || syncingHistory} size="md">{syncingHistory ? <Loader2 className="animate-spin" /> : <Download aria-hidden="true" />}</IconButton>
            {!selectedChat.is_group ? <IconButton type="button" onClick={onOpenFollowUp} variant="ghost" aria-label="Gerar follow-up com IA" title={followUpGenerationDisabledReason ?? 'Gerar follow-up com IA'} disabled={Boolean(followUpGenerationDisabledReason)} size="md">{generatingFollowUp ? <Loader2 className="animate-spin" /> : <Sparkles className="kds-control-icon" />}</IconButton> : null}
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
                  <Info className="kds-control-icon" />
                  {chatAgendaSummary.pendingCount > 0 ? <span className="kds-sidebar-badge whatsapp-inbox-count-badge" aria-label={`${chatAgendaSummary.pendingCount} lembretes pendentes`}>{chatAgendaSummary.pendingCount > 9 ? '9+' : chatAgendaSummary.pendingCount}</span> : null}
                </span>
              </IconButton>
            ) : null}
          </ButtonGroup>
        </div>
      </div>
    </div>
  );
}
