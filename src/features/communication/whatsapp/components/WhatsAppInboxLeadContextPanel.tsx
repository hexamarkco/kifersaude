import { Activity, CalendarClock, Contact, Link2, Loader2 } from 'lucide-react';

import { Avatar, Badge, Button, Heading, Text } from '../../../../design-system';
import { formatDateTimeFullBR } from '../../../../lib/dateUtils';
import type { CommWhatsAppLeadPanel } from '../data';
import type { CommWhatsAppChat } from '../domain/types';

type WhatsAppInboxLeadContextPanelProps = {
  selectedChat: CommWhatsAppChat | null;
  selectedChatDisplayName: string | null;
  leadPanel: CommWhatsAppLeadPanel | null;
  leadPanelLoading: boolean;
  leadPanelError: string | null;
  pendingReminderCount: number;
  onOpenLeadDrawer: () => void;
  onOpenLeadInCrm?: () => void;
};

function formatLastContact(value: string | null | undefined) {
  if (!value || Number.isNaN(new Date(value).getTime())) {
    return 'Sem registro de atividade';
  }

  return formatDateTimeFullBR(value);
}

export function WhatsAppInboxLeadContextPanel({
  selectedChat,
  selectedChatDisplayName,
  leadPanel,
  leadPanelLoading,
  leadPanelError,
  pendingReminderCount,
  onOpenLeadDrawer,
  onOpenLeadInCrm,
}: WhatsAppInboxLeadContextPanelProps) {
  const linkedLead = selectedChat?.lead_id && leadPanel?.id === selectedChat.lead_id ? leadPanel : null;
  const displayName = linkedLead?.nome_completo ?? selectedChat?.lead_name ?? selectedChatDisplayName ?? selectedChat?.display_name ?? 'Contato';
  const isGroup = selectedChat?.is_group ?? false;
  const hasLead = Boolean(selectedChat?.lead_id);
  const statusName = linkedLead?.status_nome ?? selectedChat?.lead_status ?? null;
  const responsibleName = linkedLead?.responsavel_label ?? selectedChat?.lead_responsavel ?? null;

  return (
    <aside
      className="kds-inbox-lead-context-panel min-h-0 flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-surface)]"
      aria-label="Informações do contato"
    >
      <div className="flex h-12 shrink-0 items-center border-b border-[var(--border-subtle)] px-4">
        <Heading level={2} className="text-sm font-semibold text-[var(--text-primary)]">
          {isGroup ? 'Informações do grupo' : 'Informações do contato'}
        </Heading>
      </div>

      {!selectedChat ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-5 text-center">
          <Contact className="h-6 w-6 text-[var(--text-muted)]" aria-hidden="true" />
          <Text className="text-sm text-[var(--text-secondary)]">Selecione uma conversa para ver os dados do contato.</Text>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <div className="flex flex-col items-center border-b border-[var(--border-subtle)] pb-5 text-center">
            <Avatar name={displayName} tone="brand" size="xl" />
            <Text className="mt-3 max-w-full break-words text-sm font-semibold text-[var(--text-primary)]">{displayName}</Text>
            <Text className="mt-1 text-xs text-[var(--text-secondary)]">
              {isGroup ? 'Conversa em grupo' : hasLead ? 'Lead vinculado ao atendimento' : 'Contato do WhatsApp'}
            </Text>
            {!isGroup ? (
              <Badge tone={hasLead ? 'lead' : 'neutral'} size="sm" className="mt-3">
                {statusName ?? (hasLead ? leadPanelLoading ? 'Carregando status' : 'Status não informado' : 'Sem lead vinculado')}
              </Badge>
            ) : null}
          </div>

          <div className="divide-y divide-[var(--border-subtle)]">
            {!isGroup ? (
              <div className="py-3">
                <Text className="text-xs text-[var(--text-muted)]">Responsável</Text>
                <Text className="mt-1 text-sm font-medium text-[var(--text-primary)]">
                  {responsibleName ?? (hasLead && leadPanelLoading ? 'Carregando responsável' : 'Ainda não atribuído')}
                </Text>
              </div>
            ) : null}

            <div className="py-3">
              <Text className="text-xs text-[var(--text-muted)]">Último contato</Text>
              <div className="mt-1 flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                <Activity className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                <span>{formatLastContact(selectedChat.last_message_at)}</span>
              </div>
            </div>

            {!isGroup && pendingReminderCount > 0 ? (
              <div className="flex items-center justify-between gap-3 py-3">
                <Text className="text-sm text-[var(--text-secondary)]">Lembretes pendentes</Text>
                <Badge tone="warning" size="sm" icon={CalendarClock}>{pendingReminderCount}</Badge>
              </div>
            ) : null}
          </div>

          {leadPanelLoading && hasLead ? (
            <Text role="status" className="mt-4 flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Atualizando dados do lead
            </Text>
          ) : null}
          {leadPanelError && hasLead ? (
            <Text role="status" className="mt-4 text-xs leading-5 text-[var(--danger-text)]">
              Não foi possível atualizar os dados do lead. Abra as informações para tentar novamente.
            </Text>
          ) : null}

          {!isGroup ? (
            <div className="mt-4 flex flex-col gap-2">
              <Button variant="secondary" size="sm" fullWidth onClick={onOpenLeadDrawer}>
                <Link2 className="kds-control-icon" aria-hidden="true" />
                {hasLead ? 'Informações e agenda' : 'Vincular ou criar lead'}
              </Button>
              {hasLead && onOpenLeadInCrm ? (
                <Button variant="ghost" size="sm" fullWidth onClick={onOpenLeadInCrm}>
                  Abrir no CRM
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </aside>
  );
}
