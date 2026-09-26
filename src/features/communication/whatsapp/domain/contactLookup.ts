import type { CommWhatsAppPhoneContact } from './types';

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

export const addSavedContactsToNameMap = (
  target: Map<string, string>,
  contacts: CommWhatsAppPhoneContact[],
  manualTarget?: Map<string, string>,
) => {
  for (const contact of contacts) {
    const name = contact.display_name?.trim();
    if (!contact.saved || !name) continue;

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
