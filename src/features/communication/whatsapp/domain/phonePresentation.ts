export const formatCommWhatsAppPhoneLabel = (value?: string | null) => {
  const normalized = String(value ?? '').trim();
  if (/@(?:lid|s\.whatsapp\.net|c\.us|g\.us)$/i.test(normalized)) {
    return 'Contato privado';
  }

  const digits = normalized.replace(/\D/g, '');

  if (digits.length === 13 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }

  if (digits.length === 12 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }

  if (!digits) {
    return 'Contato privado';
  }

  return normalized || 'Contato privado';
};
