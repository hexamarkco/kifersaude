export const normalizeCommWhatsAppPhoneDigits = (value?: string | null) => {
  const digits = String(value ?? '').replace(/\D/g, '');

  if (!digits) return '';
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return digits;
  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) return `55${digits}`;
  return digits;
};

export const normalizeWhapiDirectChatId = (value?: string | null) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  if (/@c\.us$/i.test(raw) || /@s\.whatsapp\.net$/i.test(raw)) {
    const normalizedDomain = raw
      .replace(/@c\.us$/i, '@s.whatsapp.net')
      .replace(/(@s\.whatsapp\.net)+$/i, '@s.whatsapp.net');
    const phone = normalizeCommWhatsAppPhoneDigits(normalizedDomain.replace(/@s\.whatsapp\.net$/i, ''));
    return phone ? `${phone}@s.whatsapp.net` : normalizedDomain;
  }

  if (raw.includes('@')) return raw;

  const phone = normalizeCommWhatsAppPhoneDigits(raw);
  return phone ? `${phone}@s.whatsapp.net` : raw;
};
