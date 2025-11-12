const LID_IDENTIFIER_REGEX = /@lid\b|\blid@|:lid\b|\blid:/i;

function collectChatIdentifiers(payload: any): string[] {
  const candidateValues: unknown[] = [
    payload?.chatLid,
    payload?.chat?.lid,
    payload?.chat?.chatLid,
    payload?.chat?.id,
    payload?.chat?.jid,
    payload?.message?.chatLid,
    payload?.message?.chat?.lid,
    payload?.message?.chat?.id,
    payload?.message?.remoteJid,
    payload?.message?.jid,
    payload?.message?.key?.remoteJid,
    payload?.contextInfo?.chatLid,
    payload?.contextInfo?.chat?.lid,
    payload?.contextInfo?.remoteJid,
    payload?.conversationLid,
    payload?.conversation?.lid,
    payload?.conversation?.chatLid,
    payload?.remoteLid,
    payload?.lid,
    payload?.chatId,
    payload?.remoteJid,
    payload?.jid,
    payload?.phone,
  ];

  const preferred: string[] = [];
  const secondary: string[] = [];
  const seen = new Set<string>();

  for (const value of candidateValues) {
    if (typeof value !== 'string' && typeof value !== 'number') {
      continue;
    }

    const stringValue = typeof value === 'number' && Number.isFinite(value) ? String(Math.trunc(value)) : String(value);
    const trimmed = stringValue.trim();

    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    const lower = trimmed.toLowerCase();

    if (LID_IDENTIFIER_REGEX.test(lower)) {
      preferred.push(trimmed);
      continue;
    }

    if (lower.includes('@g.us') || lower.includes('-group')) {
      secondary.push(trimmed);
    }
  }

  return preferred.length > 0 ? preferred : secondary;
}

export function normalizePhoneNumber(raw: unknown): string | null {
  if (!raw || typeof raw !== 'string') {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const lowerTrimmed = trimmed.toLowerCase();
  const hasLidIdentifier = LID_IDENTIFIER_REGEX.test(lowerTrimmed);
  if (hasLidIdentifier) {
    return trimmed;
  }
  if (lowerTrimmed.includes('-group') || lowerTrimmed.includes('@g.us')) {
    return trimmed;
  }

  const digits = trimmed.replace(/\D/g, '');
  if (!digits) {
    return trimmed.includes('@') ? trimmed : null;
  }

  if (digits.startsWith('55')) {
    return digits;
  }

  if (digits.length === 11) {
    return digits;
  }

  return digits;
}

export function extractNormalizedPhoneNumber(payload: any): string | null {
  const candidatePhones: string[] = [];
  const seenCandidates = new Set<string>();

  const pushNormalized = (value: unknown) => {
    let candidate = value;
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      candidate = String(Math.trunc(candidate));
    }

    if (typeof candidate !== 'string') {
      return;
    }

    const normalized = normalizePhoneNumber(candidate);
    if (normalized && !seenCandidates.has(normalized)) {
      candidatePhones.push(normalized);
      seenCandidates.add(normalized);
    }
  };

  const addCandidate = (value: unknown) => {
    if (!value) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => addCandidate(entry));
      return;
    }

    pushNormalized(value);
  };

  const candidateValues: unknown[] = [
    payload?.senderPhone,
    payload?.sender?.phone,
    payload?.sender?.jid,
    payload?.participantPhone,
    payload?.participant?.phone,
    payload?.participant?.jid,
    payload?.contact?.phone,
    payload?.contact?.waid,
    payload?.contact?.jid,
    payload?.contact?.id,
    payload?.message?.participant,
    payload?.message?.key?.participant,
    payload?.contextInfo?.participant,
    payload?.phone,
    payload?.phoneNumber,
    payload?.chatPhone,
    payload?.remotePhone,
    payload?.receiverPhone,
    payload?.recipientPhone,
    payload?.targetPhone,
    payload?.to,
    payload?.from,
    payload?.whatsapp,
    payload?.contactPhone,
    payload?.chatId,
    payload?.remoteJid,
    payload?.jid,
    payload?.participant,
    payload?.groupId,
    payload?.groupJid,
    payload?.conversationId,
    payload?.chat?.id,
    payload?.chat?.jid,
    payload?.chat?.phone,
    payload?.message?.phone,
    payload?.message?.chatId,
    payload?.message?.remoteJid,
    payload?.message?.jid,
    payload?.message?.to,
    payload?.message?.from,
    payload?.message?.key?.remoteJid,
    payload?.contextInfo?.remoteJid,
  ];

  candidateValues.forEach((value) => addCandidate(value));

  const connectedValues: unknown[] = [
    payload?.connectedPhone,
    payload?.instancePhone,
    payload?.sessionPhone,
    payload?.connected?.phone,
    payload?.instance?.phone,
    payload?.session?.phone,
    payload?.me,
    payload?.me?.id,
    payload?.me?.jid,
    payload?.me?.phone,
    payload?.user?.id,
    payload?.user?.jid,
    payload?.owner?.id,
    payload?.account?.phone,
    payload?.account?.jid,
    payload?.profile?.jid,
  ];

  if (payload?.fromMe) {
    connectedValues.push(payload?.senderPhone, payload?.from, payload?.message?.from);
  }

  const connectedNumbers = new Set<string>();
  connectedValues.forEach((value) => {
    let candidate = value;
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      candidate = String(Math.trunc(candidate));
    }

    const normalized = normalizePhoneNumber(candidate);
    if (normalized) {
      connectedNumbers.add(normalized);
      const digitsOnly = normalized.replace(/\D/g, '');
      if (digitsOnly) {
        connectedNumbers.add(digitsOnly);
      }
    }
  });

  const chatIdentifiers = collectChatIdentifiers(payload);
  for (const identifier of chatIdentifiers) {
    const trimmed = identifier.trim();
    if (!trimmed) {
      continue;
    }

    const numericOnly = trimmed.replace(/\D/g, '');
    if (numericOnly && connectedNumbers.has(numericOnly)) {
      continue;
    }

    return trimmed;
  }

  const groupCandidateByJid = candidatePhones.find((candidate) =>
    candidate.toLowerCase().includes('@g.us')
  );
  if (groupCandidateByJid) {
    return groupCandidateByJid;
  }

  const groupCandidateBySuffix = candidatePhones.find((candidate) =>
    candidate.toLowerCase().includes('-group')
  );
  if (groupCandidateBySuffix) {
    return groupCandidateBySuffix;
  }

  if (payload?.fromMe) {
    if (connectedNumbers.size > 0) {
      for (const candidate of candidatePhones) {
        if (!connectedNumbers.has(candidate)) {
          return candidate;
        }
      }

      return null;
    }

    return candidatePhones[0] ?? null;
  }

  if (candidatePhones.length > 0) {
    return candidatePhones[0];
  }

  if (connectedNumbers.size > 0) {
    return Array.from(connectedNumbers)[0] ?? null;
  }

  return null;
}

export function extractNormalizedTargetPhone(payload: any): string | null {
  const candidateValues: unknown[] = [
    payload?.targetPhone,
    payload?.phone,
    payload?.phoneNumber,
    payload?.remotePhone,
    payload?.receiverPhone,
    payload?.recipientPhone,
    payload?.chatPhone,
    payload?.to,
    payload?.chatId,
    payload?.jid,
    payload?.message?.to,
    payload?.message?.chatId,
    payload?.message?.remoteJid,
    payload?.message?.jid,
    payload?.message?.key?.remoteJid,
    payload?.participantPhone,
    payload?.participant?.phone,
    payload?.participant?.jid,
  ];

  const connectedValues: unknown[] = [
    payload?.connectedPhone,
    payload?.instancePhone,
    payload?.sessionPhone,
    payload?.connected?.phone,
    payload?.instance?.phone,
    payload?.session?.phone,
    payload?.me,
    payload?.me?.id,
    payload?.me?.jid,
    payload?.me?.phone,
    payload?.user?.id,
    payload?.user?.jid,
    payload?.owner?.id,
    payload?.account?.phone,
    payload?.account?.jid,
    payload?.profile?.jid,
  ];

  const connectedNumbers = new Set<string>();
  connectedValues.forEach((value) => {
    let candidate = value;
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      candidate = String(Math.trunc(candidate));
    }

    const normalized = normalizePhoneNumber(candidate);
    if (normalized) {
      connectedNumbers.add(normalized);
      const digitsOnly = normalized.replace(/\D/g, '');
      if (digitsOnly) {
        connectedNumbers.add(digitsOnly);
      }
    }
  });

  const chatIdentifiers = collectChatIdentifiers(payload);
  for (const identifier of chatIdentifiers) {
    const trimmed = identifier.trim();
    if (!trimmed) {
      continue;
    }

    const numericOnly = trimmed.replace(/\D/g, '');
    if (numericOnly && connectedNumbers.has(numericOnly)) {
      continue;
    }

    return trimmed;
  }

  for (const value of candidateValues) {
    let candidate = value;
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      candidate = String(Math.trunc(candidate));
    }

    if (typeof candidate !== 'string') {
      continue;
    }

    const normalized = normalizePhoneNumber(candidate);
    if (normalized && !connectedNumbers.has(normalized)) {
      return normalized;
    }
  }

  const forcedPayload = payload?.fromMe ? payload : { ...payload, fromMe: true };
  const fallback = extractNormalizedPhoneNumber(forcedPayload);
  if (fallback && !connectedNumbers.has(fallback)) {
    return fallback;
  }

  return null;
}
