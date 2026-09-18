import { normalizeWhapiParticipantId } from './comm-whatsapp/identity.ts';

export type WhapiPresenceStatus = 'online' | 'offline' | 'typing' | 'recording' | 'pending' | 'unknown';

export type WhapiPresenceItem = {
  entryId: string;
  status: WhapiPresenceStatus;
  lastSeenAt: string | null;
  raw: Record<string, unknown>;
};

export const WHAPI_TRANSIENT_PRESENCE_TTL_MS = 20_000;

const PRESENCE_STATUSES = new Set<WhapiPresenceStatus>([
  'online',
  'offline',
  'typing',
  'recording',
  'pending',
]);

export const isWhapiTransientPresenceStatus = (status: unknown): boolean =>
  status === 'typing' || status === 'recording';

export const isWhapiPresenceSnapshotStale = (
  status: unknown,
  observedAt: string | null | undefined,
  nowMs = Date.now(),
): boolean => {
  if (!isWhapiTransientPresenceStatus(status) || !observedAt) return false;
  const observedAtMs = Date.parse(observedAt);
  return Number.isFinite(observedAtMs)
    && nowMs - observedAtMs > WHAPI_TRANSIENT_PRESENCE_TTL_MS;
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const toTrimmedString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const timestampToIso = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    const timestampMs = numeric >= 1e15 ? numeric / 1000 : numeric >= 1e12 ? numeric : numeric * 1000;
    const date = new Date(timestampMs);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const normalizeWhapiPresenceStatus = (value: unknown): WhapiPresenceStatus => {
  const status = toTrimmedString(value).toLowerCase();
  return PRESENCE_STATUSES.has(status as WhapiPresenceStatus)
    ? status as WhapiPresenceStatus
    : 'unknown';
};

export const normalizeWhapiPresenceItem = (value: unknown): WhapiPresenceItem | null => {
  if (!isRecord(value)) return null;

  const entryId = normalizeWhapiParticipantId(
    value.contact_id ?? value.contactId ?? value.entry_id ?? value.entryId ?? value.id,
  );
  if (!entryId) return null;

  return {
    entryId,
    status: normalizeWhapiPresenceStatus(value.status ?? value.presence),
    lastSeenAt: timestampToIso(value.last_seen ?? value.lastSeen ?? value.last_seen_at),
    raw: value,
  };
};

export const extractWhapiPresenceItems = (payload: Record<string, unknown>): WhapiPresenceItem[] => {
  const candidates: unknown[] = Array.isArray(payload.presences)
    ? payload.presences
    : isRecord(payload.presence)
      ? [payload.presence]
      : [];

  return candidates
    .map(normalizeWhapiPresenceItem)
    .filter((item): item is WhapiPresenceItem => item !== null);
};

export const buildWhapiPresenceEventKey = (
  eventAction: string,
  item: Pick<WhapiPresenceItem, 'entryId' | 'status' | 'lastSeenAt'>,
): string => (
  `presence:${eventAction || 'post'}:${item.entryId}:${item.status}:${item.lastSeenAt || 'no-last-seen'}`
);
