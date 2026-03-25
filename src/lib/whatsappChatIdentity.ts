export type WhatsAppChatIdType = 'group' | 'phone' | 'lid' | 'newsletter' | 'broadcast' | 'status' | 'unknown';

export type WhatsAppChatKind = 'group' | 'direct' | 'newsletter' | 'broadcast' | 'status' | 'unknown';

const PHONE_CHAT_SUFFIX = '@s.whatsapp.net';
const LEGACY_PHONE_CHAT_SUFFIX = '@c.us';
const LID_CHAT_SUFFIX = '@lid';
const GROUP_CHAT_SUFFIX = '@g.us';
const NEWSLETTER_CHAT_SUFFIX = '@newsletter';
const BROADCAST_CHAT_SUFFIX = '@broadcast';
const STATUS_CHAT_IDS = new Set(['status@broadcast', 'stories']);

const cleanChatId = (value: string | null | undefined) => (typeof value === 'string' ? value.trim() : '');

export function getWhatsAppChatIdType(chatId: string): WhatsAppChatIdType {
  const normalized = cleanChatId(chatId).toLowerCase();
  if (!normalized) return 'unknown';
  if (normalized.endsWith(GROUP_CHAT_SUFFIX)) return 'group';
  if (STATUS_CHAT_IDS.has(normalized)) return 'status';
  if (normalized.endsWith(NEWSLETTER_CHAT_SUFFIX)) return 'newsletter';
  if (normalized.endsWith(BROADCAST_CHAT_SUFFIX)) return 'broadcast';
  if (normalized.endsWith(LID_CHAT_SUFFIX)) return 'lid';
  if (normalized.endsWith(PHONE_CHAT_SUFFIX) || normalized.endsWith(LEGACY_PHONE_CHAT_SUFFIX)) return 'phone';

  if (!normalized.includes('@')) {
    const digits = normalized.replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15) {
      return 'phone';
    }
  }

  return 'unknown';
}

export function getWhatsAppChatKindFromId(chatId: string): WhatsAppChatKind {
  const type = getWhatsAppChatIdType(chatId);
  if (type === 'phone' || type === 'lid') return 'direct';
  if (type === 'group') return 'group';
  if (type === 'newsletter') return 'newsletter';
  if (type === 'broadcast') return 'broadcast';
  if (type === 'status') return 'status';
  return 'unknown';
}

export function isDirectWhatsAppChatId(chatId: string): boolean {
  const type = getWhatsAppChatIdType(chatId);
  return type === 'phone' || type === 'lid';
}

export function normalizeWhatsAppChatId(chatId: string): string {
  const trimmed = cleanChatId(chatId);
  if (!trimmed) return trimmed;

  const type = getWhatsAppChatIdType(trimmed);
  if (type !== 'phone') {
    return trimmed;
  }

  if (/@c\.us$/i.test(trimmed)) {
    return trimmed.replace(/@c\.us$/i, PHONE_CHAT_SUFFIX);
  }

  if (/@s\.whatsapp\.net$/i.test(trimmed)) {
    return trimmed.replace(/(@s\.whatsapp\.net)+$/i, PHONE_CHAT_SUFFIX);
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 7 && digits.length <= 15) {
    return `${digits}${PHONE_CHAT_SUFFIX}`;
  }

  return trimmed;
}

export function normalizeMaybeDirectChatId(value: string | null | undefined): string | null {
  const cleaned = cleanChatId(value);
  if (!cleaned) return null;

  const type = getWhatsAppChatIdType(cleaned);
  return type === 'phone' ? normalizeWhatsAppChatId(cleaned) : cleaned;
}

export function extractDirectPhoneNumber(chatId: string | null | undefined): string | null {
  const normalizedChatId = normalizeWhatsAppChatId(cleanChatId(chatId));
  if (getWhatsAppChatIdType(normalizedChatId) !== 'phone') return null;

  const phone = normalizedChatId.replace(/@c\.us$|@s\.whatsapp\.net$/i, '').replace(/\D/g, '');
  return phone || null;
}

export function extractDirectLid(chatId: string | null | undefined): string | null {
  const cleaned = cleanChatId(chatId);
  return getWhatsAppChatIdType(cleaned) === 'lid' ? cleaned : null;
}

export function buildPhoneLookupVariants(phoneNumber: string): string[] {
  const rawDigits = cleanChatId(phoneNumber).replace(/\D/g, '');
  if (!rawDigits) return [];

  const variants = new Set<string>();
  const push = (value: string) => {
    const digits = cleanChatId(value).replace(/\D/g, '');
    if (!digits) return;
    variants.add(digits);

    if (digits.startsWith('55') && digits.length > 11) {
      variants.add(digits.slice(2));
    }

    if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
      variants.add(`55${digits}`);
    }
  };

  push(rawDigits);

  const snapshot = Array.from(variants);
  snapshot.forEach((value) => {
    const local = value.startsWith('55') && (value.length === 12 || value.length === 13) ? value.slice(2) : value;

    if (local.length === 11 && local[2] === '9') {
      const withoutNinthDigit = `${local.slice(0, 2)}${local.slice(3)}`;
      push(withoutNinthDigit);
      push(`55${withoutNinthDigit}`);
    }

    if (local.length === 10) {
      const withNinthDigit = `${local.slice(0, 2)}9${local.slice(2)}`;
      push(withNinthDigit);
      push(`55${withNinthDigit}`);
    }
  });

  return Array.from(variants);
}

export function buildDirectChatIdVariantsFromPhone(phoneNumber: string): string[] {
  const variants = new Set<string>();
  buildPhoneLookupVariants(phoneNumber).forEach((digits) => {
    variants.add(`${digits}${PHONE_CHAT_SUFFIX}`);
    variants.add(`${digits}${LEGACY_PHONE_CHAT_SUFFIX}`);
  });
  return Array.from(variants);
}

export function buildDirectChatAliasSet(params: {
  chatId?: string | null;
  phoneNumber?: string | null;
  lid?: string | null;
}): string[] {
  const aliases = new Set<string>();

  const add = (value: string | null | undefined) => {
    const cleaned = cleanChatId(value);
    if (cleaned) aliases.add(cleaned);
  };

  const normalizedChatId = normalizeMaybeDirectChatId(params.chatId);
  add(normalizedChatId);
  add(params.lid);

  if (normalizedChatId && getWhatsAppChatIdType(normalizedChatId) === 'phone') {
    if (normalizedChatId.endsWith(PHONE_CHAT_SUFFIX)) {
      aliases.add(normalizedChatId.replace(/@s\.whatsapp\.net$/i, LEGACY_PHONE_CHAT_SUFFIX));
    }
    if (normalizedChatId.endsWith(LEGACY_PHONE_CHAT_SUFFIX)) {
      aliases.add(normalizedChatId.replace(/@c\.us$/i, PHONE_CHAT_SUFFIX));
    }
  }

  const phoneNumber = cleanChatId(params.phoneNumber) || extractDirectPhoneNumber(normalizedChatId || '') || '';
  if (phoneNumber) {
    buildDirectChatIdVariantsFromPhone(phoneNumber).forEach((variant) => aliases.add(variant));
  }

  return Array.from(aliases);
}

export function resolveInboundCanonicalDirectChatId(
  rawChatId: string,
  normalizedChatId: string,
  normalizedFrom: string | null,
): string {
  const resolvedChatId = normalizeWhatsAppChatId(normalizedChatId);
  if (!normalizedFrom || getWhatsAppChatIdType(normalizedFrom) !== 'phone') {
    return resolvedChatId;
  }

  const chatType = getWhatsAppChatIdType(resolvedChatId);
  if (chatType === 'group' || chatType === 'newsletter' || chatType === 'broadcast' || chatType === 'status') {
    return resolvedChatId;
  }

  if (chatType === 'lid' || chatType === 'unknown') {
    return normalizeWhatsAppChatId(normalizedFrom);
  }

  if (chatType === 'phone' && resolvedChatId !== normalizedFrom) {
    const raw = cleanChatId(rawChatId).toLowerCase();
    if (!raw || raw.endsWith(LID_CHAT_SUFFIX) || !raw.includes('@')) {
      return normalizeWhatsAppChatId(normalizedFrom);
    }

    return normalizeWhatsAppChatId(normalizedFrom);
  }

  return resolvedChatId;
}

export function getDirectChatMergePriority(chatId: string, phoneNumber: string | null): number {
  const normalized = normalizeWhatsAppChatId(chatId).trim().toLowerCase();
  if (!normalized) return -1;

  if (phoneNumber) {
    if (normalized === `${phoneNumber}${PHONE_CHAT_SUFFIX}`) return 120;
    if (normalized === `${phoneNumber}${LEGACY_PHONE_CHAT_SUFFIX}`) return 110;
  }

  if (normalized.endsWith(PHONE_CHAT_SUFFIX)) return 90;
  if (normalized.endsWith(LEGACY_PHONE_CHAT_SUFFIX)) return 80;
  if (normalized.endsWith(LID_CHAT_SUFFIX)) return 20;
  if (!normalized.includes('@')) return 10;
  return 0;
}

export function choosePreferredDirectChatIdForPhone(
  primaryChatId: string,
  secondaryChatId: string,
  phoneNumber: string | null,
): string {
  const primaryScore = getDirectChatMergePriority(primaryChatId, phoneNumber);
  const secondaryScore = getDirectChatMergePriority(secondaryChatId, phoneNumber);
  return secondaryScore > primaryScore ? secondaryChatId : primaryChatId;
}
