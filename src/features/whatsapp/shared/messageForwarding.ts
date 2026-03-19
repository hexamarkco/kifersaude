const MAX_FORWARD_MARKER_DEPTH = 5;

const BOOLEAN_FORWARD_KEYS = new Set(['forwarded', 'isforwarded']);
const SCORE_FORWARD_KEYS = new Set(['forwardingscore']);

const normalizeMarkerKey = (key: string) => key.replace(/[^a-z0-9]/gi, '').toLowerCase();

const readPositiveNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 0 ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
};

const isTrueish = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'sim';
  }

  return false;
};

const hasForwardMarker = (value: unknown, depth: number, seen: Set<object>): boolean => {
  if (depth > MAX_FORWARD_MARKER_DEPTH || !value || typeof value !== 'object') {
    return false;
  }

  if (seen.has(value)) {
    return false;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.some((item) => hasForwardMarker(item, depth + 1, seen));
  }

  return Object.entries(value).some(([key, entryValue]) => {
    const normalizedKey = normalizeMarkerKey(key);

    if (BOOLEAN_FORWARD_KEYS.has(normalizedKey) && isTrueish(entryValue)) {
      return true;
    }

    if (SCORE_FORWARD_KEYS.has(normalizedKey) && readPositiveNumber(entryValue) !== null) {
      return true;
    }

    return hasForwardMarker(entryValue, depth + 1, seen);
  });
};

export const isWhatsAppPayloadForwarded = (payload: unknown): boolean => hasForwardMarker(payload, 0, new Set<object>());

export const markWhatsAppPayloadAsForwarded = (
  payload: Record<string, unknown> | null | undefined,
): Record<string, unknown> => {
  const nextPayload = payload && typeof payload === 'object' ? { ...payload } : {};
  const existingForwardingScore = readPositiveNumber(nextPayload.forwarding_score);

  return {
    ...nextPayload,
    is_forwarded: true,
    forwarding_score: existingForwardingScore ?? 1,
  };
};
