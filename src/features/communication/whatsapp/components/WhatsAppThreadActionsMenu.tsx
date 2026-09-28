import type { Dispatch, Ref, SetStateAction } from 'react';
import { Bot, CalendarClock, Copy, Download, FolderOpen, Info, Loader2, Search, Sparkles } from 'lucide-react';

import PanelPopoverShell from '../../../../components/ui/PanelPopoverShell';
import type { CommWhatsAppChat } from '../domain/types';
import type { InboxOverlayPosition } from '../hooks/useInboxOverlayPositions';

type WhatsAppThreadActionsMenuProps = {
  menuRef: Ref<HTMLDivElement>;
  isOpen: boolean;
  position: InboxOverlayPosition | null;
  selectedChat: CommWhatsAppChat | null;
  setOpen: Dispatch<SetStateAction<boolean>>;
  assumingControlChatId: string | null;
  isSelectedChatWaitingForQuote: boolean;
  copyingTranscript: boolean;
  historyRecoveryDisabledReason: string | null;
  syncingHistoryChatId: string | null;
  followUpGenerationDisabledReason: string | null;
  generatingFollowUp: boolean;
  onToggleAutonomousAttendance: (chat: CommWhatsAppChat) => void;
  onOpenChatFiles: () => void;
  onToggleChatMessageSearch: () => void;
  onOpenScheduledMessages: () => void;
  onCopyTranscript: () => void;
  onRecoverHistory: () => void;
  onOpenFollowUp: () => void;
  onOpenLeadDrawer: () => void;
};

export const WhatsAppThreadActionsMenu = ({
  menuRef,
  isOpen,
  position,
  selectedChat,
  setOpen,
  assumingControlChatId,
  isSelectedChatWaitingForQuote,
  copyingTranscript,
  historyRecoveryDisabledReason,
  syncingHistoryChatId,
  followUpGenerationDisabledReason,
  generatingFollowUp,
  onToggleAutonomousAttendance,
  onOpenChatFiles,
  onToggleChatMessageSearch,
  onOpenScheduledMessages,
  onCopyTranscript,
  onRecoverHistory,
  onOpenFollowUp,
  onOpenLeadDrawer,
}: WhatsAppThreadActionsMenuProps) => (
  <PanelPopoverShell
    ref={menuRef}
    isOpen={isOpen}
    position={position}
    onClose={() => setOpen(false)}
    ariaLabel="Ações da conversa"
    role="menu"
    className="kds-dropdown-menu before:hidden overflow-y-auto p-1"
    style={{ width: position?.width ?? 288, maxHeight: position?.maxHeight }}
  >
    {selectedChat ? (
      <div className="flex flex-col gap-1">
        {!selectedChat.is_group && selectedChat.lead_id ? (
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              if (isSelectedChatWaitingForQuote) {
                return;
              }
              onToggleAutonomousAttendance(selectedChat);
            }}
            disabled={assumingControlChatId === selectedChat.id || isSelectedChatWaitingForQuote}
            className="kds-dropdown-option flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm disabled:opacity-60"
          >
            {assumingControlChatId === selectedChat.id ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Bot className="h-4 w-4 shrink-0" />}
            <span>{isSelectedChatWaitingForQuote
              ? 'IA encerrada enquanto aguarda cotação'
              : selectedChat.autonomous_attendance_status === 'active' ? 'Desativar IA neste chat' : 'Ativar IA neste chat'}</span>
          </button>
        ) : null}
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setOpen(false);
            onOpenChatFiles();
          }}
          className="kds-dropdown-option flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm"
        >
          <FolderOpen className="h-4 w-4 shrink-0" />
          <span>Arquivos da conversa</span>
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setOpen(false);
            onToggleChatMessageSearch();
          }}
          className="kds-dropdown-option flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span>Pesquisar neste chat</span>
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setOpen(false);
            onOpenScheduledMessages();
          }}
          className="kds-dropdown-option flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm"
        >
          <CalendarClock className="h-4 w-4 shrink-0" />
          <span>Mensagens agendadas desta conversa</span>
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setOpen(false);
            onCopyTranscript();
          }}
          disabled={copyingTranscript}
          className="kds-dropdown-option flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm disabled:opacity-60"
        >
          {copyingTranscript ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Copy className="h-4 w-4 shrink-0" />}
          <span>Copiar conversa formatada</span>
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setOpen(false);
            onRecoverHistory();
          }}
          disabled={Boolean(historyRecoveryDisabledReason) || syncingHistoryChatId === selectedChat.id}
          className="kds-dropdown-option flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm disabled:opacity-60"
          title={historyRecoveryDisabledReason ?? undefined}
        >
          {syncingHistoryChatId === selectedChat.id ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Download className="h-4 w-4 shrink-0" />}
          <span>Recuperar histórico antigo</span>
        </button>
        {!selectedChat.is_group ? (
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onOpenFollowUp();
            }}
            disabled={Boolean(followUpGenerationDisabledReason)}
            className="kds-dropdown-option flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm disabled:opacity-60"
            title={followUpGenerationDisabledReason ?? undefined}
          >
            {generatingFollowUp ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Sparkles className="h-4 w-4 shrink-0" />}
            <span>Gerar follow-up com IA</span>
          </button>
        ) : null}
        {!selectedChat.is_group ? (
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onOpenLeadDrawer();
            }}
            className="kds-dropdown-option flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm"
          >
            <Info className="h-4 w-4 shrink-0" />
            <span>{selectedChat.lead_id ? 'Informações do lead' : 'Vincular lead do CRM'}</span>
          </button>
        ) : null}
      </div>
    ) : null}
  </PanelPopoverShell>
);
