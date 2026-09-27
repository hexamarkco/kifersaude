import type { CommWhatsAppChat, CommWhatsAppPhoneContact } from './types';

export const collectPhoneLookupKeys = (value?: string | null) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return [];

  const keys = new Set<string>();
  const appendKey = (candidate?: string | null) => {
    const normalized = String(candidate ?? '').replace(/\D/g, '');
    if (normalized) keys.add(normalized);
  };
  const appendBrazilMobileVariants = (candidate: string) => {
    if (candidate.length === 10) {
      const mobilePrefix = candidate[2] ?? '';
      if (/[6-9]/.test(mobilePrefix)) appendKey(`${candidate.slice(0, 2)}9${candidate.slice(2)}`);
      return;
    }

    if (candidate.length === 11) {
      const ninthDigit = candidate[2] ?? '';
      const mobilePrefix = candidate[3] ?? '';
      if (ninthDigit === '9' && /[6-9]/.test(mobilePrefix)) {
        appendKey(`${candidate.slice(0, 2)}${candidate.slice(3)}`);
      }
    }
  };
  const appendBrazilCountryCodeToNationalKeys = () => {
    for (const variant of Array.from(keys)) {
      if (!variant.startsWith('55') && (variant.length === 10 || variant.length === 11)) {
        appendKey(`55${variant}`);
      }
    }
  };

  appendKey(digits);

  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    const nationalDigits = digits.slice(2);
    appendKey(nationalDigits);
    appendBrazilMobileVariants(nationalDigits);
    appendBrazilCountryCodeToNationalKeys();
  }

  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
    appendKey(`55${digits}`);
    appendBrazilMobileVariants(digits);
    appendBrazilCountryCodeToNationalKeys();
  }

  return Array.from(keys);
};

const isManualSavedContact = (contact: CommWhatsAppPhoneContact) => (
  contact.contact_id?.startsWith('manual:') ?? false
);

const getContactTimestamp = (value?: string | null) => {
  const timestamp = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const isPreferredSavedContact = (
  candidate: CommWhatsAppPhoneContact,
  current: CommWhatsAppPhoneContact,
) => {
  const candidateIsManual = isManualSavedContact(candidate);
  const currentIsManual = isManualSavedContact(current);

  if (candidateIsManual !== currentIsManual) {
    return candidateIsManual;
  }

  const candidateUpdatedAt = getContactTimestamp(candidate.updated_at);
  const currentUpdatedAt = getContactTimestamp(current.updated_at);
  if (candidateUpdatedAt !== currentUpdatedAt) {
    return candidateUpdatedAt > currentUpdatedAt;
  }

  const candidateSyncedAt = getContactTimestamp(candidate.last_synced_at);
  const currentSyncedAt = getContactTimestamp(current.last_synced_at);
  if (candidateSyncedAt !== currentSyncedAt) {
    return candidateSyncedAt > currentSyncedAt;
  }

  return candidate.contact_id.localeCompare(current.contact_id) < 0;
};

export const selectPreferredSavedContacts = (contacts: CommWhatsAppPhoneContact[]) => {
  const preferredByPhoneKey = new Map<string, CommWhatsAppPhoneContact>();

  for (const contact of contacts) {
    if (!contact.saved || !contact.display_name?.trim()) {
      continue;
    }

    for (const key of collectPhoneLookupKeys(contact.phone_digits || contact.phone_number)) {
      const sourceKey = `${isManualSavedContact(contact) ? 'manual' : 'synchronized'}:${key}`;
      const current = preferredByPhoneKey.get(sourceKey);
      if (!current || isPreferredSavedContact(contact, current)) {
        preferredByPhoneKey.set(sourceKey, contact);
      }
    }
  }

  const selected = new Map<string, CommWhatsAppPhoneContact>();
  for (const contact of preferredByPhoneKey.values()) {
    selected.set(contact.id, contact);
  }

  return Array.from(selected.values());
};

export const addSavedContactsToNameMap = (
  target: Map<string, string>,
  contacts: CommWhatsAppPhoneContact[],
  manualTarget?: Map<string, string>,
) => {
  for (const contact of selectPreferredSavedContacts(contacts)) {
    const name = contact.display_name.trim();

    const destination = contact.contact_id?.startsWith('manual:')
      ? manualTarget ?? target
      : target;

    for (const key of collectPhoneLookupKeys(contact.phone_digits || contact.phone_number)) {
      destination.set(key, name);
    }
  }
};

export const getSavedContactNameForPhone = (
  phone: string | null | undefined,
  primary: ReadonlyMap<string, string>,
  fallback?: ReadonlyMap<string, string>,
) => {
  const keys = collectPhoneLookupKeys(phone);
  const primaryName = keys
    .map((key) => primary.get(key) ?? null)
    .find((value): value is string => Boolean(value?.trim()));
  if (primaryName) return primaryName.trim();

  if (fallback) {
    const fallbackName = keys
      .map((key) => fallback.get(key) ?? null)
      .find((value): value is string => Boolean(value?.trim()));
    if (fallbackName) return fallbackName.trim();
  }

  return null;
};

export const resolveSavedContactName = (
  phone: string | null | undefined,
  currentChatName: string | null | undefined,
  localOverrides: ReadonlyMap<string, string>,
  synchronizedNames: ReadonlyMap<string, string>,
) => {
  const localOverrideName = getSavedContactNameForPhone(phone, localOverrides);
  if (localOverrideName) {
    return localOverrideName;
  }

  // O cache de contatos salvos é a fonte canônica quando estiver disponível.
  // O nome que veio no chat pode ser histórico (por exemplo, um registro
  // `chat:` antigo) e não deve substituir um contato salvo mais recente.
  const synchronizedName = getSavedContactNameForPhone(phone, synchronizedNames);
  if (synchronizedName) {
    return synchronizedName;
  }

  const normalizedCurrentChatName = currentChatName?.trim();
  if (normalizedCurrentChatName) {
    return normalizedCurrentChatName;
  }

  return null;
};

export const applySavedContactNameFromLookup = (
  chat: CommWhatsAppChat,
  localOverrides: ReadonlyMap<string, string>,
  synchronizedNames: ReadonlyMap<string, string>,
) => {
  if (chat.is_group) {
    return chat;
  }

  const savedName = resolveSavedContactName(
    chat.phone_digits || chat.phone_number,
    chat.saved_contact_name,
    localOverrides,
    synchronizedNames,
  );
  if (!savedName) {
    return chat;
  }

  return {
    ...chat,
    saved_contact_name: savedName,
    display_name: savedName,
  };
};
