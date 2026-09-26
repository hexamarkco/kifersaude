type LocalMediaPreviewEntry = {
  objectUrl: string;
  referenceCount: number;
  releaseTimer: number | null;
};

type LocalMediaPreviewCacheOptions = {
  releaseGraceMs?: number;
  setTimeout?: (callback: () => void, delayMs: number) => number;
  clearTimeout?: (timerId: number) => void;
  revokeObjectUrl?: (objectUrl: string) => void;
};

const DEFAULT_RELEASE_GRACE_MS = 30_000;

const revokeBlobUrl = (objectUrl: string) => {
  if (objectUrl.startsWith('blob:')) {
    URL.revokeObjectURL(objectUrl);
  }
};

export const createLocalMediaPreviewCache = ({
  releaseGraceMs = DEFAULT_RELEASE_GRACE_MS,
  setTimeout: scheduleTimeout = (callback, delayMs) => window.setTimeout(callback, delayMs),
  clearTimeout: cancelTimeout = (timerId) => window.clearTimeout(timerId),
  revokeObjectUrl = revokeBlobUrl,
}: LocalMediaPreviewCacheOptions = {}) => {
  const entries = new Map<string, LocalMediaPreviewEntry>();

  const scheduleRelease = (messageId: string, entry: LocalMediaPreviewEntry) => {
    if (entry.referenceCount > 0 || entry.releaseTimer !== null) {
      return;
    }

    entry.releaseTimer = scheduleTimeout(() => {
      entry.releaseTimer = null;
      if (entries.get(messageId) !== entry || entry.referenceCount > 0) {
        return;
      }

      entries.delete(messageId);
      revokeObjectUrl(entry.objectUrl);
    }, releaseGraceMs);
  };

  return {
    remember(messageId: string, objectUrl: string) {
      if (!messageId || !objectUrl) {
        return;
      }

      const existing = entries.get(messageId);
      if (existing) {
        if (existing.objectUrl !== objectUrl && existing.referenceCount === 0) {
          if (existing.releaseTimer !== null) {
            cancelTimeout(existing.releaseTimer);
          }
          revokeObjectUrl(existing.objectUrl);
          entries.delete(messageId);
        } else {
          return;
        }
      }

      const entry: LocalMediaPreviewEntry = {
        objectUrl,
        referenceCount: 0,
        releaseTimer: null,
      };
      entries.set(messageId, entry);
      scheduleRelease(messageId, entry);
    },

    get(messageId?: string | null) {
      if (!messageId) {
        return null;
      }

      return entries.get(messageId)?.objectUrl ?? null;
    },

    retain(messageId?: string | null) {
      if (!messageId) {
        return null;
      }

      const entry = entries.get(messageId);
      if (!entry) {
        return null;
      }

      entry.referenceCount += 1;
      if (entry.releaseTimer !== null) {
        cancelTimeout(entry.releaseTimer);
        entry.releaseTimer = null;
      }
      return entry.objectUrl;
    },

    release(messageId?: string | null) {
      if (!messageId) {
        return;
      }

      const entry = entries.get(messageId);
      if (!entry) {
        return;
      }

      entry.referenceCount = Math.max(0, entry.referenceCount - 1);
      scheduleRelease(messageId, entry);
    },
  };
};

export type LocalMediaPreviewCache = ReturnType<typeof createLocalMediaPreviewCache>;
