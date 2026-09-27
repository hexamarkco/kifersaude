import { getSafeChatDisplayName } from './chatPresentation';
import type { CommWhatsAppScheduledMessage, CommWhatsAppScheduledSequence } from './types';

type ScheduledContact = Pick<CommWhatsAppScheduledMessage, 'chat' | 'display_name' | 'phone_number' | 'phone_digits'>
  | Pick<CommWhatsAppScheduledSequence, 'chat' | 'display_name' | 'phone_number' | 'phone_digits'>;

/**
 * Agendamentos guardam um nome histórico para auditoria, mas a tela deve
 * refletir o nome atual do chat quando ele ainda existir.
 */
export const getScheduledContactDisplayName = (
  scheduled: ScheduledContact,
  currentContactName?: string | null,
) => (
  getSafeChatDisplayName({
    display_name: currentContactName || scheduled.chat?.display_name || scheduled.display_name,
    phone_number: scheduled.chat?.phone_number || scheduled.phone_number,
    phone_digits: scheduled.chat?.phone_digits || scheduled.phone_digits,
    saved_contact_name: currentContactName || scheduled.chat?.saved_contact_name,
    push_name: scheduled.chat?.push_name,
    lead_name: scheduled.chat?.lead_name,
    lead_id: scheduled.chat?.lead_id,
    is_group: scheduled.chat?.is_group,
  })
);
