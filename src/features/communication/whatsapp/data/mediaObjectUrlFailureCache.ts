type MediaObjectUrlFailureCacheOptions = {
  ttlMs?: number;
  now?: () => number;
};

const DEFAULT_FAILURE_TTL_MS = 60_000;

type FailureEntry = {
  error: unknown;
  expiresAt: number;
};

export const createMediaObjectUrlFailureCache = ({
  ttlMs = DEFAULT_FAILURE_TTL_MS,
  now = () => Date.now(),
}: MediaObjectUrlFailureCacheOptions = {}) => {
  const entries = new Map<string, FailureEntry>();

  return {
    get(mediaId: string) {
      const entry = entries.get(mediaId);
      if (!entry) {
        return null;
      }

      if (entry.expiresAt <= now()) {
        entries.delete(mediaId);
        return null;
      }

      return entry.error;
    },

    remember(mediaId: string, error: unknown) {
      if (!mediaId || ttlMs <= 0) {
        return;
      }

      entries.set(mediaId, {
        error,
        expiresAt: now() + ttlMs,
      });
    },

    clear(mediaId: string) {
      entries.delete(mediaId);
    },
  };
};

export type MediaObjectUrlFailureCache = ReturnType<typeof createMediaObjectUrlFailureCache>;
