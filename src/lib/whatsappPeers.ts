const LID_IDENTIFIER_REGEX = /@lid\b|\blid@|:lid\b|\blid:/i;
const GROUP_IDENTIFIER_REGEX = /@g\.us\b|[-_]group\b/i;

export const normalizePeerPhone = (value?: string | null): string => {
  if (value == null) {
    return '';
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return '';
  }

  const lower = trimmed.toLowerCase();
  if (GROUP_IDENTIFIER_REGEX.test(lower)) {
    return '';
  }

  let sanitized = trimmed.replace(/^lid@/i, '').replace(/(@|:)lid$/i, '');
  sanitized = sanitized.replace(/@s\.whatsapp\.net$/i, '');

  const digits = sanitized.replace(/\D/g, '');
  if (!digits) {
    return '';
  }

  let normalized = digits.replace(/^0+/, '');

  if (!normalized) {
    return '';
  }

  if (normalized.startsWith('55')) {
    if (normalized.length >= 13 && normalized.startsWith('550')) {
      normalized = `55${normalized.slice(3)}`;
    }
    return normalized;
  }

  if (normalized.length === 11 || normalized.length === 10) {
    normalized = `55${normalized}`;
  }

  return normalized;
};

export const normalizePeerChatIdentifier = (value?: string | null): { normalized: string; raw: string } | null => {
  if (value == null) {
    return null;
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }

  const lower = trimmed.toLowerCase();
  if (GROUP_IDENTIFIER_REGEX.test(lower)) {
    return null;
  }

  if (!LID_IDENTIFIER_REGEX.test(lower)) {
    return null;
  }

  const normalized = normalizePeerPhone(trimmed);
  if (!normalized) {
    return null;
  }

  return { normalized, raw: trimmed };
};

export const normalizePeerLookupKey = (
  value?: string | null,
): { key: string; isGroup: boolean } | null => {
  if (value == null) {
    return null;
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }

  const lower = trimmed.toLowerCase();
  if (GROUP_IDENTIFIER_REGEX.test(lower)) {
    return { key: lower, isGroup: true };
  }

  const chat = normalizePeerChatIdentifier(trimmed);
  if (chat) {
    return { key: chat.normalized, isGroup: false };
  }

  const phone = normalizePeerPhone(trimmed);
  if (phone) {
    return { key: phone, isGroup: false };
  }

  return { key: trimmed, isGroup: false };
};

