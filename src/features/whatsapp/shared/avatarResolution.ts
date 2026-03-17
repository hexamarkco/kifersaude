import {
  buildChatIdFromPhone,
  getWhatsAppChatKind,
  normalizeChatId,
  type WhapiContact,
  type WhapiGroup,
} from '../../../lib/whatsappApiService';
import { normalizePhoneNumber } from './phoneUtils';

export type ChatAvatarTarget = {
  id: string;
  is_group?: boolean | null;
  phone_number?: string | null;
  lid?: string | null;
};

export type StoredContactPhotoRow = {
  contact_id: string;
  public_url?: string | null;
};

export type StoredGroupPhotoRow = {
  id: string;
  chat_pic?: string | null;
  chat_pic_full?: string | null;
};

const isDirectChatTarget = (chat: Pick<ChatAvatarTarget, 'id' | 'is_group'>) => {
  if (chat.is_group) return false;
  return getWhatsAppChatKind(chat.id) === 'direct';
};

const getPreferredPhotoUrl = (...candidates: Array<string | null | undefined>) => {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) return trimmed;
  }

  return null;
};

const getDirectChatVariants = (chatId: string) => {
  const variants = new Set<string>();

  if (chatId) {
    variants.add(chatId);
  }

  const normalized = normalizeChatId(chatId);
  if (normalized) {
    variants.add(normalized);
    if (normalized.endsWith('@s.whatsapp.net')) {
      variants.add(normalized.replace(/@s\.whatsapp\.net$/i, '@c.us'));
    }
    if (normalized.endsWith('@c.us')) {
      variants.add(normalized.replace(/@c\.us$/i, '@s.whatsapp.net'));
    }
  }

  const digits = getPhoneDigits(chatId);
  getDirectIdVariantsFromDigits(digits).forEach((variant) => variants.add(variant));

  return Array.from(variants);
};

const setPhotoVariants = (map: Map<string, string>, variants: string[], url: string, overwrite: boolean) => {
  variants.forEach((variant) => {
    if (!variant) return;
    if (!overwrite && map.has(variant)) return;
    map.set(variant, url);
  });
};

const pushUniqueUrl = (urls: string[], seen: Set<string>, value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed || seen.has(trimmed)) return;
  seen.add(trimmed);
  urls.push(trimmed);
};

export function getPhoneDigits(value: string | null | undefined) {
  if (!value) return '';
  return value.replace(/\D/g, '');
}

export function extractPhoneFromChatId(chatId: string) {
  const trimmed = chatId.trim();
  if (!trimmed) return '';
  if (getWhatsAppChatKind(trimmed) !== 'direct') return '';
  if (/@lid$/i.test(trimmed)) return '';
  if (!/@(?:s\.whatsapp\.net|c\.us)$/i.test(trimmed)) return '';
  return normalizePhoneNumber(trimmed);
}

export function getDirectIdVariantsFromDigits(digits: string) {
  if (!digits) return [];

  const phoneDigitsVariants = new Set<string>([digits]);

  const toggleBrazilNinthDigit = (value: string, withCountryCode: boolean) => {
    const base = withCountryCode ? value.slice(2) : value;
    if (base.length === 10) {
      const withNine = `${base.slice(0, 2)}9${base.slice(2)}`;
      phoneDigitsVariants.add(withCountryCode ? `55${withNine}` : withNine);
    }
    if (base.length === 11 && base[2] === '9') {
      const withoutNine = `${base.slice(0, 2)}${base.slice(3)}`;
      phoneDigitsVariants.add(withCountryCode ? `55${withoutNine}` : withoutNine);
    }
  };

  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    const local = digits.slice(2);
    if (local) {
      phoneDigitsVariants.add(local);
    }
    toggleBrazilNinthDigit(digits, true);
    if (local) {
      toggleBrazilNinthDigit(local, false);
    }
  }

  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
    phoneDigitsVariants.add(`55${digits}`);
    toggleBrazilNinthDigit(digits, false);
    toggleBrazilNinthDigit(`55${digits}`, true);
  }

  const snapshot = Array.from(phoneDigitsVariants);
  snapshot.forEach((value) => {
    if (value.startsWith('55') && (value.length === 12 || value.length === 13)) {
      phoneDigitsVariants.add(value.slice(2));
    }
    if (!value.startsWith('55') && (value.length === 10 || value.length === 11)) {
      phoneDigitsVariants.add(`55${value}`);
    }
  });

  const variants = new Set<string>();
  phoneDigitsVariants.forEach((value) => {
    variants.add(`${value}@s.whatsapp.net`);
    variants.add(`${value}@c.us`);
  });

  return Array.from(variants);
}

export function getChatIdVariants(chat: ChatAvatarTarget) {
  const variants = new Set<string>();

  if (chat.id) {
    variants.add(chat.id);
  }

  if (isDirectChatTarget(chat)) {
    const normalized = normalizeChatId(chat.id);
    if (normalized) variants.add(normalized);
    if (normalized?.endsWith('@s.whatsapp.net')) {
      variants.add(normalized.replace(/@s\.whatsapp\.net$/i, '@c.us'));
    }
    if (chat.id.endsWith('@c.us')) {
      variants.add(chat.id.replace(/@c\.us$/i, '@s.whatsapp.net'));
    }
    if (chat.phone_number) {
      variants.add(buildChatIdFromPhone(chat.phone_number));
    }
    if (chat.lid) {
      variants.add(chat.lid);
    }
  }

  return Array.from(variants);
}

export function buildContactPhotoMap(contacts: Array<Pick<WhapiContact, 'id' | 'profile_pic' | 'profile_pic_full'>>) {
  const map = new Map<string, string>();

  contacts.forEach((contact) => {
    const url = getPreferredPhotoUrl(contact.profile_pic_full, contact.profile_pic);
    if (!url) return;
    setPhotoVariants(map, getDirectChatVariants(contact.id), url, true);
  });

  return map;
}

export function buildLegacyContactPhotoMap(rows: StoredContactPhotoRow[]) {
  const map = new Map<string, string>();

  rows.forEach((row) => {
    const url = getPreferredPhotoUrl(row.public_url);
    if (!url) return;
    setPhotoVariants(map, getDirectChatVariants(row.contact_id), url, true);
  });

  return map;
}

export function buildGroupPhotoMap(groups: Array<Pick<WhapiGroup, 'id' | 'chat_pic' | 'chat_pic_full'> | StoredGroupPhotoRow>) {
  const map = new Map<string, string>();

  groups.forEach((group) => {
    const url = getPreferredPhotoUrl(group.chat_pic_full, group.chat_pic);
    if (!url || !group.id) return;
    map.set(group.id, url);
  });

  return map;
}

export function resolveChatAvatarSources(
  chat: ChatAvatarTarget | null | undefined,
  options: {
    directPrimary?: Map<string, string>;
    directFallback?: Map<string, string>;
    group?: Map<string, string>;
  },
) {
  if (!chat) return [];

  const sources: string[] = [];
  const seen = new Set<string>();
  const chatKind = chat.is_group ? 'group' : getWhatsAppChatKind(chat.id);

  if (chatKind === 'group') {
    pushUniqueUrl(sources, seen, options.group?.get(chat.id));
    return sources;
  }

  getChatIdVariants(chat).forEach((variant) => {
    pushUniqueUrl(sources, seen, options.directPrimary?.get(variant));
    pushUniqueUrl(sources, seen, options.directFallback?.get(variant));
  });

  return sources;
}
