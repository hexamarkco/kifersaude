import {
  isValidCommWhatsAppDisplayName,
  normalizeCommWhatsAppPhone,
  toTrimmedString,
} from '../../_shared/comm-whatsapp.ts';

export const MANUAL_CONTACT_ID_PREFIX = 'manual:';

export const isManualContactId = (contactId: string | null | undefined) => (
  toTrimmedString(contactId).startsWith(MANUAL_CONTACT_ID_PREFIX)
);

export type ManualContactCacheRow = {
  channel_id: string;
  contact_id: string;
  phone_number: string;
  phone_digits: string;
  display_name: string;
  short_name: string | null;
  saved: true;
  last_synced_at: string;
  updated_at: string;
};

export const buildManualContactCacheRow = (params: {
  channelId: string;
  phoneNumber: string;
  displayName: string;
  nowIso: string;
}): ManualContactCacheRow => {
  const normalizedPhone = normalizeCommWhatsAppPhone(params.phoneNumber);
  const displayName = toTrimmedString(params.displayName);

  if (!normalizedPhone) {
    throw new Error('Numero invalido para salvar o contato.');
  }

  if (!isValidCommWhatsAppDisplayName(displayName)) {
    throw new Error('Nome invalido para salvar o contato.');
  }

  return {
    channel_id: params.channelId,
    contact_id: `${MANUAL_CONTACT_ID_PREFIX}${normalizedPhone}`,
    phone_number: normalizedPhone,
    phone_digits: normalizedPhone,
    display_name: displayName,
    short_name: displayName.split(/\s+/).filter(Boolean).slice(0, 2).join(' ') || null,
    saved: true,
    last_synced_at: params.nowIso,
    updated_at: params.nowIso,
  };
};
