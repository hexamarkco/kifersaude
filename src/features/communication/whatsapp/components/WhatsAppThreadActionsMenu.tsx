import { DropdownOption, LoadingMonogram, PositionedPopover } from '../../../../design-system';
import type { Ref } from 'react';
import { CalendarClock, Download, FolderOpen, Search } from 'lucide-react';

import type { InboxOverlayPosition } from '../hooks/useInboxOverlayPositions';

type WhatsAppThreadActionsMenuProps = {
  menuRef: Ref<HTMLDivElement>;
  isOpen: boolean;
  position: InboxOverlayPosition | null;
  onClose: () => void;
  historyRecoveryDisabledReason: string | null;
  syncingHistory: boolean;
  onOpenChatFiles: () => void;
  onToggleChatMessageSearch: () => void;
  onOpenScheduledMessages: () => void;
  onRecoverHistory: () => void;
};

export function WhatsAppThreadActionsMenu({
  menuRef,
  isOpen,
  position,
  onClose,
  historyRecoveryDisabledReason,
  syncingHistory,
  onOpenChatFiles,
  onToggleChatMessageSearch,
  onOpenScheduledMessages,
  onRecoverHistory,
}: WhatsAppThreadActionsMenuProps) {
  const actions = [
    { label: 'Arquivos da conversa', icon: FolderOpen, run: onOpenChatFiles },
    { label: 'Pesquisar neste chat', icon: Search, run: onToggleChatMessageSearch },
    { label: 'Mensagens agendadas desta conversa', icon: CalendarClock, run: onOpenScheduledMessages },
    {
      label: 'Recuperar histórico antigo',
      icon: Download,
      run: onRecoverHistory,
      disabled: Boolean(historyRecoveryDisabledReason) || syncingHistory,
      loading: syncingHistory,
      title: historyRecoveryDisabledReason ?? undefined,
    },
  ];

  return (
    <PositionedPopover
      ref={menuRef}
      isOpen={isOpen}
      position={position}
      onClose={onClose}
      ariaLabel="Ações da conversa"
      role="menu"
      className="comm-whatsapp-action-menu before:hidden overflow-y-auto"
      style={{ width: position?.width ?? 288, maxHeight: position?.maxHeight }}
    >
      {actions.map(({ label, icon: Icon, run, disabled, loading, title }) => (
        <DropdownOption
          key={label}
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            run();
          }}
          disabled={disabled}
          title={title}
        >
          <LoadingMonogram active={loading ?? false} fallback={<Icon className="kds-control-icon" aria-hidden="true" />} size="control" />
          <span>{label}</span>
        </DropdownOption>
      ))}
    </PositionedPopover>
  );
}
