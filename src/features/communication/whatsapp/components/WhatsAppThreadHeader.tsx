import { Bot, Calendar, CalendarClock, ChevronLeft, Copy, Download, FolderOpen, Info, Loader2, MoreHorizontal, Pause, Pencil, Search, Sparkles, Users } from 'lucide-react';
import type { RefObject } from 'react';

import {
  Badge,
  ButtonGroup,
  IconButton,
  OperationalStatusBadge,
} from '../../../../design-system';
import { LeadFavoriteToggle } from '../../../../components/LeadFavoriteStar';
import StatusDropdown from '../../../../components/StatusDropdown';
import { isOverdue } from '../../../../lib/dateUtils';
import { formatCommWhatsAppPhoneLabel } from '../domain/phonePresentation';
import type { CommWhatsAppChat } from '../domain/types';
import type { CommWhatsAppLeadPanel } from '../data';
import type { LeadStatusConfig } from '../../../leads';
import WhatsAppPresenceIndicator from './WhatsAppPresenceIndicator';

type ChatAgendaSummary = {
  pendingCount: number;
  nextReminder: {
    data_lembrete: string;
  } | null;
};

type WhatsAppThreadHeaderProps = {
  selectedChat: CommWhatsAppChat;
  selectedChatForPresentation: CommWhatsAppChat | null;
  selectedChatDisplayName: string;
  leadPanel: CommWhatsAppLeadPanel | null;
  leadStatuses: LeadStatusConfig[];
  favoritedLeadIds: ReadonlySet<string>;
  selectedChatLeadMutationLoading: boolean;
  selectedChatWasAutoLinked: boolean;
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
  threadActionsMenuTriggerRef: RefObject<HTMLButtonElement>;
  chatAgendaSummary: ChatAgendaSummary;
  nextChatReminderSummary: string | null;
  chatAgendaSummaryError: string | null;
  onBack: () => void;
  onLeadStatusChange: (leadId: string, newStatus: string) => Promise<void>;
  onSaveContact: (name: string) => void;
  onToggleAutonomousAttendance: () => void;
  onOpenChatFiles: () => void;
  onToggleChatMessageSearch: () => void;
  onOpenScheduledMessages: () => void;
  onCopyTranscript: () => void;
  onRecoverHistory: () => void;
  onOpenFollowUp: () => void;
  onOpenLeadDrawer: () => void;
  onToggleThreadActionsMenu: () => void;
};

export function WhatsAppThreadHeader({
  selectedChat,
  selectedChatForPresentation,
  selectedChatDisplayName,
  leadPanel,
  leadStatuses,
  favoritedLeadIds,
  selectedChatLeadMutationLoading,
  selectedChatWasAutoLinked,
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
  threadActionsMenuTriggerRef,
  chatAgendaSummary,
  nextChatReminderSummary,
  chatAgendaSummaryError,
  onBack,
  onLeadStatusChange,
  onSaveContact,
  onToggleAutonomousAttendance,
  onOpenChatFiles,
  onToggleChatMessageSearch,
  onOpenScheduledMessages,
  onCopyTranscript,
  onRecoverHistory,
  onOpenFollowUp,
  onOpenLeadDrawer,
  onToggleThreadActionsMenu,
}: WhatsAppThreadHeaderProps) {
  return (
    <div className="whatsapp-inbox-thread-header flex flex-col gap-3 border-b p-3 sm:p-4 lg:flex-row lg:items-start lg:justify-between lg:p-5">
      <div className="flex min-w-0 items-start gap-2">
        <button type="button" onClick={onBack} className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] lg:hidden" aria-label="Voltar para a lista de conversas">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <p className="whatsapp-inbox-heading flex min-w-0 items-center gap-1.5 text-base font-semibold leading-tight text-[var(--text-primary)] sm:text-lg">
                {selectedChat.is_group ? <Users className="h-4 w-4 shrink-0 text-[var(--brand-primary)]" aria-label="Grupo" /> : null}
                {!selectedChat.is_group && leadPanel?.id ? <LeadFavoriteToggle leadId={leadPanel.id} favorito={favoritedLeadIds.has(leadPanel.id)} size="sm" /> : null}
                <span className="min-w-0 truncate">{selectedChatDisplayName}</span>
              </p>
              {!selectedChat.is_group && selectedChat.lead_id && leadPanel?.id && leadPanel.status_nome ? (
                <StatusDropdown currentStatus={leadPanel.status_nome} leadId={leadPanel.id} onStatusChange={onLeadStatusChange} statusOptions={leadStatuses} disabled={selectedChatLeadMutationLoading} />
              ) : null}
              {!selectedChat.is_group && selectedChatWasAutoLinked ? <Badge tone="primary" size="sm" className="uppercase tracking-[0.12em]">Auto</Badge> : null}
              {!selectedChat.is_group && selectedChat.autonomous_attendance_status === 'active' ? (
                <OperationalStatusBadge statusColor="var(--accent-gold)" className="uppercase"><Bot className="h-3 w-3" aria-hidden="true" />IA atendendo</OperationalStatusBadge>
              ) : !selectedChat.is_group && selectedChat.autonomous_attendance_status === 'handed_off' ? (
                <OperationalStatusBadge statusColor="var(--text-muted)" className="uppercase"><Bot className="h-3 w-3" aria-hidden="true" />IA encerrada</OperationalStatusBadge>
              ) : null}
            </div>
            <IconButton ref={threadActionsMenuTriggerRef} type="button" onClick={onToggleThreadActionsMenu} variant={threadActionsMenuOpen ? 'secondary' : 'soft'} className="shrink-0 lg:hidden" aria-label="Abrir ações da conversa" aria-expanded={threadActionsMenuOpen} title="Ações da conversa" size="lg">
              <MoreHorizontal aria-hidden="true" />
            </IconButton>
          </div>
          {!selectedChat.is_group ? (
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)] sm:text-sm">
              <span className="min-w-0 truncate">{formatCommWhatsAppPhoneLabel(selectedChat.phone_number)}</span>
              <WhatsAppPresenceIndicator chat={selectedChat} />
              {!selectedChatForPresentation?.saved_contact_name ? (
                <button type="button" onClick={() => onSaveContact(selectedChatDisplayName)} className="text-xs font-semibold text-[var(--brand-primary)] hover:underline">+ Salvar contato</button>
              ) : (
                <button type="button" onClick={() => onSaveContact(selectedChatForPresentation.saved_contact_name || selectedChatDisplayName)} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-primary)] hover:underline"><Pencil className="h-3 w-3" />Renomear contato</button>
              )}
              {leadPanel?.responsavel_label ? <span className="min-w-0 truncate">Responsável: {leadPanel.responsavel_label}</span> : null}
            </div>
          ) : null}
          {nextChatReminderSummary ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={chatAgendaSummaryError ? 'warning' : chatAgendaSummary.nextReminder && isOverdue(chatAgendaSummary.nextReminder.data_lembrete) ? 'danger' : 'neutral'} icon={Calendar} title={chatAgendaSummaryError ? 'Abra as informações do lead para tentar carregar a agenda novamente.' : undefined}>
                <span className="min-w-0 max-w-full truncate">{nextChatReminderSummary}</span>
              </Badge>
            </div>
          ) : null}
        </div>
      </div>
      <div className="hidden min-w-0 shrink-0 items-start lg:flex lg:justify-end">
        <div className="whatsapp-inbox-thread-actions flex min-w-0 items-center gap-2 lg:justify-end">
          <ButtonGroup className="whatsapp-inbox-action-group" role="group" aria-label="Ações da conversa">
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
            {!selectedChat.is_group ? <IconButton type="button" onClick={onOpenLeadDrawer} variant="ghost" aria-label="Abrir informações do lead" title={selectedChat.lead_id ? 'Abrir informações do lead' : 'Vincular lead do CRM'} size="md"><span className="relative inline-flex"><Info className="kds-control-icon" />{chatAgendaSummary.pendingCount > 0 ? <span className="kds-sidebar-badge whatsapp-inbox-count-badge" aria-label={`${chatAgendaSummary.pendingCount} lembretes pendentes`}>{chatAgendaSummary.pendingCount > 9 ? '9+' : chatAgendaSummary.pendingCount}</span> : null}</span></IconButton> : null}
          </ButtonGroup>
        </div>
      </div>
    </div>
  );
}
