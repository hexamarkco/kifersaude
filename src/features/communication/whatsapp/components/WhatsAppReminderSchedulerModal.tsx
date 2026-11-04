import type { ComponentProps } from 'react';
import { CalendarClock } from 'lucide-react';
import ReminderSchedulerModal from '../../../../components/ReminderSchedulerModal';
import { LeadFavoriteBadge } from '../../../../components/LeadFavoriteStar';
import { formatCommWhatsAppPhoneLabel } from '../domain/phonePresentation';
import { WhatsAppInboxPanelHeader } from './WhatsAppInboxPanelHeader';

type InboxReminderProps = Omit<ComponentProps<typeof ReminderSchedulerModal>, 'className' | 'renderHeader'>;

/** Keep the shared reminder workflow while composing its Inbox presentation here. */
export default function WhatsAppReminderSchedulerModal({ lead, ...props }: InboxReminderProps) {
  return (
    <ReminderSchedulerModal {...props} lead={lead}
      className="whatsapp-inbox-dialog comm-whatsapp-overlay"
      renderHeader={({ onClose, showCloseButton }) => (
        <WhatsAppInboxPanelHeader icon={CalendarClock} title="Agendar novo lembrete"
          context={<span className="inline-flex items-center gap-1.5"><LeadFavoriteBadge favorito={lead.favorito} />{lead.nome_completo}</span>}
          description={formatCommWhatsAppPhoneLabel(lead.telefone)}
          onClose={onClose} showCloseButton={showCloseButton} />
      )} />
  );
}
