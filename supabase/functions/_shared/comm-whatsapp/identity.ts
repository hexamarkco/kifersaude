const toTrimmedString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

export const normalizePhoneDigits = (value: unknown): string =>
  toTrimmedString(value).replace(/\D/g, '');

export const normalizeCommWhatsAppPhone = (value: unknown): string => {
  const digits = normalizePhoneDigits(value);

  if (!digits) return '';
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return digits;
  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) return `55${digits}`;
  return digits;
};

export const getCommWhatsAppPhoneLookupKeys = (value: unknown): string[] => {
  const digits = normalizePhoneDigits(value);
  if (!digits) return [];

  const keys = new Set<string>();
  const appendKey = (candidate: string) => {
    const normalized = normalizePhoneDigits(candidate);
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
      if (ninthDigit === '9' && /[6-9]/.test(mobilePrefix)) appendKey(`${candidate.slice(0, 2)}${candidate.slice(3)}`);
    }
  };

  appendKey(digits);
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    const nationalDigits = digits.slice(2);
    appendKey(nationalDigits);
    appendBrazilMobileVariants(nationalDigits);
  } else if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
    appendKey(`55${digits}`);
    appendBrazilMobileVariants(digits);
  }

  for (const variant of Array.from(keys)) {
    if (!variant.startsWith('55') && (variant.length === 10 || variant.length === 11)) appendKey(`55${variant}`);
  }
  return Array.from(keys);
};

export const normalizeWhapiChatId = (value: unknown): string => {
  const raw = toTrimmedString(value);
  if (!raw) return '';

  if (/@c\.us$/i.test(raw) || /@s\.whatsapp\.net$/i.test(raw)) {
    const normalizedDomain = raw
      .replace(/@c\.us$/i, '@s.whatsapp.net')
      .replace(/(@s\.whatsapp\.net)+$/i, '@s.whatsapp.net');
    const phone = normalizeCommWhatsAppPhone(normalizedDomain.replace(/@s\.whatsapp\.net$/i, ''));
    return phone ? `${phone}@s.whatsapp.net` : normalizedDomain;
  }
  if (/@lid$/i.test(raw)) {
    const identifier = raw.replace(/@lid$/i, '').trim();
    return identifier ? `${identifier}@lid` : '';
  }
  if (raw.includes('@')) return raw;
  const phone = normalizeCommWhatsAppPhone(raw);
  return phone ? `${phone}@s.whatsapp.net` : raw;
};

export const buildWhapiDirectChatId = (value: unknown): string => {
  const phone = normalizeCommWhatsAppPhone(value);
  return phone ? `${phone}@s.whatsapp.net` : '';
};

export const isWhapiPhoneDirectChatId = (value: unknown): boolean =>
  /@s\.whatsapp\.net$/i.test(normalizeWhapiChatId(value));

export const isWhapiLidChatId = (value: unknown): boolean =>
  /@lid$/i.test(normalizeWhapiChatId(value));

export const isDirectWhapiChatId = (value: unknown): boolean =>
  isWhapiPhoneDirectChatId(value) || isWhapiLidChatId(value);

export const extractPhoneFromChatId = (value: unknown): string => {
  const chatId = normalizeWhapiChatId(value);
  return isWhapiPhoneDirectChatId(chatId)
    ? chatId.replace(/@s\.whatsapp\.net$/i, '').replace(/\D/g, '')
    : '';
};

export const normalizeWhapiPhoneChatId = (value: unknown): string => {
  const raw = toTrimmedString(value);
  if (!raw || /@lid$/i.test(raw)) return '';
  const chatId = normalizeWhapiChatId(raw);
  if (!isWhapiPhoneDirectChatId(chatId)) return '';
  const phone = extractPhoneFromChatId(chatId);
  return phone.length >= 7 && phone.length <= 15 ? `${phone}@s.whatsapp.net` : '';
};

export const formatPhoneFromDigits = (digits: string): string => {
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  return digits || 'Numero desconhecido';
};

export const formatPhoneLabel = (value: unknown): string =>
  formatPhoneFromDigits(normalizeCommWhatsAppPhone(value));
