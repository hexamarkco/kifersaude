export const CONTACT_CACHE_STALE_MS = 30 * 60 * 1000;

export const isContactCacheStale = (
  lastSyncedAt: string | null | undefined,
  nowMs = Date.now(),
) => {
  if (!lastSyncedAt) return true;

  const ageMs = nowMs - new Date(lastSyncedAt).getTime();
  return !Number.isFinite(ageMs) || ageMs > CONTACT_CACHE_STALE_MS;
};
