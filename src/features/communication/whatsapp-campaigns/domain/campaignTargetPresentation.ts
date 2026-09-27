import { getSafeChatDisplayName } from '../../whatsapp';
import type { CommWhatsAppCampaignTargetListItem } from '../commWhatsAppCampaignService';

/**
 * A linha da campanha guarda uma fotografia do nome no momento da importacao.
 * Quando existe um chat ligado, a identidade atual do Inbox deve ter prioridade
 * para refletir renomes e contatos salvos sem alterar o historico do disparo.
 */
export const getCampaignTargetDisplayName = (target: CommWhatsAppCampaignTargetListItem) => (
  getSafeChatDisplayName({
    display_name: target.chat?.display_name || target.display_name,
    phone_number: target.chat?.phone_number || target.phone_number,
    phone_digits: target.chat?.phone_digits || target.phone_digits,
    saved_contact_name: target.chat?.saved_contact_name,
    push_name: target.chat?.push_name,
    lead_name: target.chat?.lead_name,
    lead_id: target.chat?.lead_id,
    is_group: target.chat?.is_group,
  })
);
