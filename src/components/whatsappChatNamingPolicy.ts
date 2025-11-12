import { normalizePeerPhone } from '../lib/whatsappPeers';

export type ChatNameSource = 'contact' | 'lead' | 'lead-conflict' | 'phone';

export interface ChatNameState {
  value: string;
  source: ChatNameSource;
  hasLeadConflict?: boolean;
}

export interface ChatNameResolutionOptions {
  normalizedPhone?: string | null;
  contactName?: string | null;
  leadNames?: string[];
  hasLeadConflict?: boolean;
  fallbackDisplay?: string | null;
  previous?: ChatNameState | null;
  conflictLabel?: string;
}

export interface ChatNameDecision {
  state: ChatNameState;
  changed: boolean;
  promoted: boolean;
}

const CHAT_NAME_SOURCE_PRIORITY: Record<ChatNameSource, number> = {
  contact: 3,
  lead: 2,
  'lead-conflict': 2,
  phone: 1,
};

const DEFAULT_CONFLICT_LABEL = '• vários leads disponíveis';

const normalizeDigits = (value?: string | null): string => {
  if (!value) {
    return '';
  }

  const normalized = normalizePeerPhone(value);
  return normalized || value.replace(/\D/g, '');
};

export const formatPhoneToE164 = (normalized?: string | null, fallback?: string | null): string => {
  const digits = normalizeDigits(normalized);
  if (digits) {
    const prefixed = digits.startsWith('+') ? digits : `+${digits}`;
    return prefixed;
  }

  if (typeof fallback === 'string' && fallback.trim()) {
    const trimmed = fallback.trim();
    if (trimmed.startsWith('+')) {
      return trimmed;
    }
    const fallbackDigits = trimmed.replace(/\D/g, '');
    if (fallbackDigits) {
      return `+${fallbackDigits}`;
    }
    return trimmed;
  }

  return '';
};

const uniqueNormalizedNames = (names: string[]): string[] => {
  const seen = new Set<string>();
  const results: string[] = [];

  names.forEach((name) => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    const normalized = trimmed
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();

    if (seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    results.push(trimmed);
  });

  return results;
};

export const resolveNameWithPriority = (
  options: ChatNameResolutionOptions,
): ChatNameDecision => {
  const {
    normalizedPhone,
    contactName,
    leadNames = [],
    hasLeadConflict = false,
    fallbackDisplay,
    previous,
    conflictLabel = DEFAULT_CONFLICT_LABEL,
  } = options;

  const fallback = formatPhoneToE164(normalizedPhone, fallbackDisplay);
  const candidates: ChatNameState[] = [];

  const normalizedContact = typeof contactName === 'string' ? contactName.trim() : '';
  if (normalizedContact) {
    candidates.push({ value: normalizedContact, source: 'contact' });
  }

  const uniqueLeadNames = uniqueNormalizedNames(leadNames);

  if (!normalizedContact) {
    if (hasLeadConflict && uniqueLeadNames.length > 0) {
      candidates.push({
        value: `${fallback}${fallback ? ' ' : ''}${conflictLabel}`.trim(),
        source: 'lead-conflict',
        hasLeadConflict: true,
      });
    } else if (uniqueLeadNames.length === 1) {
      candidates.push({ value: uniqueLeadNames[0]!, source: 'lead' });
    }
  }

  candidates.push({ value: fallback, source: 'phone' });

  let chosen = candidates[0]!;
  let chosenPriority = CHAT_NAME_SOURCE_PRIORITY[chosen.source];

  for (let index = 1; index < candidates.length; index += 1) {
    const candidate = candidates[index]!;
    const priority = CHAT_NAME_SOURCE_PRIORITY[candidate.source];
    if (priority > chosenPriority) {
      chosen = candidate;
      chosenPriority = priority;
    }
  }

  if (previous) {
    const previousPriority = CHAT_NAME_SOURCE_PRIORITY[previous.source];

    if (previousPriority > chosenPriority) {
      return { state: previous, changed: false, promoted: false };
    }

    if (previousPriority === chosenPriority && previous.value === chosen.value) {
      if (previous.hasLeadConflict !== chosen.hasLeadConflict) {
        return { state: { ...previous, hasLeadConflict: chosen.hasLeadConflict }, changed: true, promoted: false };
      }
      return { state: previous, changed: false, promoted: false };
    }

    const promoted = chosenPriority > previousPriority;
    return { state: chosen, changed: true, promoted };
  }

  return { state: chosen, changed: true, promoted: chosen.source !== 'phone' };
};

export const shouldBlockChatName = (
  candidate: string | null | undefined,
  blockedNames: Iterable<string>,
): boolean => {
  if (typeof candidate !== 'string') {
    return false;
  }

  const normalizedCandidate = candidate
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();

  if (!normalizedCandidate) {
    return false;
  }

  for (const blocked of blockedNames) {
    if (!blocked) {
      continue;
    }
    const normalizedBlocked = blocked
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim()
      .toLowerCase();
    if (normalizedBlocked && normalizedBlocked === normalizedCandidate) {
      return true;
    }
  }

  return false;
};
