import type { Lead } from '../lib/supabase';
import type { ZAPIContact } from '../lib/zapiService';
import { normalizePeerPhone } from '../lib/whatsappPeers';

export const sanitizePhoneDigits = (value?: string | null): string => {
  if (!value || typeof value !== 'string') return '';
  return value.replace(/\D/g, '');
};

export type LeadPreview = Pick<
  Lead,
  'id' | 'nome_completo' | 'telefone' | 'status' | 'responsavel' | 'observacoes'
>;

export const formatPhoneForDisplay = (phone: string): string => {
  if (!phone) return '';
  const withoutSuffix = phone.includes('@') ? phone.split('@')[0] : phone;
  const withoutGroupSuffix = withoutSuffix.replace(/-group$/i, '');
  return withoutGroupSuffix;
};

export const normalizePhoneForChat = (phone: string): string => {
  return normalizePeerPhone(phone);
};

export const buildPhoneLookupKeys = (value?: string | null): string[] => {
  const normalized = normalizePeerPhone(value);
  if (!normalized) {
    return [];
  }

  const sanitizedOriginal = sanitizePhoneDigits(value);
  const keys = new Set<string>();

  keys.add(normalized);

  if (normalized.startsWith('55') && normalized.length > 2) {
    const withoutDdi = normalized.slice(2);
    if (withoutDdi) {
      keys.add(withoutDdi);
    }
    keys.add(`+${normalized}`);
  }

  if (sanitizedOriginal && sanitizedOriginal !== normalized) {
    keys.add(sanitizedOriginal);
  }

  return Array.from(keys);
};

export const collectCrmLeadsWithoutContacts = (
  leads: Iterable<LeadPreview>,
  contacts: ZAPIContact[],
): LeadPreview[] => {
  const contactPhones = new Set<string>();

  contacts.forEach((contact) => {
    const normalized = normalizePhoneForChat(contact.phone);
    if (normalized) {
      contactPhones.add(normalized);
      buildPhoneLookupKeys(normalized).forEach((key) => {
        if (key) {
          contactPhones.add(key);
        }
      });
    }

    const digits = sanitizePhoneDigits(contact.phone);
    if (digits) {
      contactPhones.add(digits);
    }
  });

  const seenPhones = new Set<string>();
  const results: LeadPreview[] = [];

  for (const lead of leads) {
    const normalized = normalizePhoneForChat(lead.telefone);
    if (!normalized) {
      continue;
    }

    const lookupKeys = [normalized, ...buildPhoneLookupKeys(normalized)];
    const isLinkedToContact = lookupKeys.some((key) => key && contactPhones.has(key));
    if (isLinkedToContact) {
      continue;
    }

    const isDuplicateLead = lookupKeys.some((key) => key && seenPhones.has(key));
    if (isDuplicateLead) {
      continue;
    }

    lookupKeys.forEach((key) => {
      if (key) {
        seenPhones.add(key);
      }
    });

    results.push(lead);
  }

  return results;
};

export type StartConversationSelectionParams = {
  phone: string;
  selectedName: string | null;
  contacts: ZAPIContact[];
  leadsByPhoneMap: Map<string, LeadPreview>;
  leadsMap: Map<string, LeadPreview>;
  selectedLeadId: string | null;
};

export type StartConversationSelectionResult = {
  normalizedPhone: string;
  displayName: string;
  matchedLead?: LeadPreview;
  matchedContact?: ZAPIContact;
};

export const resolveStartConversationSelection = (
  params: StartConversationSelectionParams,
): StartConversationSelectionResult | null => {
  const normalized = normalizePhoneForChat(params.phone);
  if (!normalized) {
    return null;
  }

  const lookupKeys = [normalized, ...buildPhoneLookupKeys(normalized)];

  let matchedLead: LeadPreview | undefined;

  if (params.selectedLeadId) {
    const selectedLead = params.leadsMap.get(params.selectedLeadId);
    if (selectedLead) {
      const selectedNormalized = normalizePhoneForChat(selectedLead.telefone);
      if (selectedNormalized && selectedNormalized === normalized) {
        matchedLead = selectedLead;
      }
    }
  }

  if (!matchedLead) {
    for (const key of lookupKeys) {
      if (!key) continue;
      const candidate = params.leadsByPhoneMap.get(key);
      if (candidate) {
        matchedLead = candidate;
        break;
      }
    }
  }

  const matchedContact = params.contacts.find(
    (contact) => normalizePhoneForChat(contact.phone) === normalized,
  );

  const displayName =
    params.selectedName ||
    matchedContact?.name ||
    matchedContact?.short ||
    matchedContact?.vname ||
    matchedContact?.notify ||
    matchedLead?.nome_completo ||
    formatPhoneForDisplay(normalized);

  return {
    normalizedPhone: normalized,
    displayName,
    matchedLead,
    matchedContact,
  };
};
