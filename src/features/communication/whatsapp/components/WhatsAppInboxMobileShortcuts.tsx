import { CalendarDays, CalendarClock, Clock3, Info, Sparkles } from 'lucide-react';
import { Button } from '../../../../design-system';

type WhatsAppInboxMobileShortcutsProps = {
  isGroup: boolean;
  followUpDisabledReason: string | null;
  onOpenContact: () => void;
  onOpenAgenda?: () => void;
  onOpenScheduleMessage?: () => void;
  onOpenScheduledMessages: () => void;
  onOpenFollowUp: () => void;
};

/**
 * Somente navegação. Todas as ações reutilizam os handlers do Inbox existente:
 * nenhuma duplicação de validação, persistência ou envio de WhatsApp.
 */
export function WhatsAppInboxMobileShortcuts({
  isGroup,
  followUpDisabledReason,
  onOpenContact,
  onOpenAgenda,
  onOpenScheduleMessage,
  onOpenScheduledMessages,
  onOpenFollowUp,
}: WhatsAppInboxMobileShortcutsProps) {
  return (
    <nav className="whatsapp-mobile-prototype-shortcuts" aria-label="Ações rápidas da conversa">
      {!isGroup ? (
        <Button type="button" variant="ghost" size="sm" onClick={onOpenContact}>
          <Info className="kds-control-icon" aria-hidden="true" />
          Contato
        </Button>
      ) : null}
      <Button type="button" variant="ghost" size="sm" onClick={onOpenAgenda} disabled={!onOpenAgenda}>
        <CalendarDays className="kds-control-icon" aria-hidden="true" />
        Agenda
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onOpenScheduleMessage}
        disabled={!onOpenScheduleMessage}
      >
        <Clock3 className="kds-control-icon" aria-hidden="true" />
        Programar
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onOpenScheduledMessages}>
        <CalendarClock className="kds-control-icon" aria-hidden="true" />
        Agendadas
      </Button>
      {!isGroup ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onOpenFollowUp}
          disabled={Boolean(followUpDisabledReason)}
          title={followUpDisabledReason ?? 'Gerar follow-up com IA'}
        >
          <Sparkles className="kds-control-icon" aria-hidden="true" />
          Follow-up
        </Button>
      ) : null}
    </nav>
  );
}
