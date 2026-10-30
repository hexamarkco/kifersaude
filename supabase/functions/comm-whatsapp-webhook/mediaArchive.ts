export type WhatsAppMediaArchiveCandidate = {
  mediaId: string;
  mediaUrl: string | null;
  mimeType: string | null;
  fileName: string | null;
};

type WhatsAppMediaArchiveSettings = {
  enabled: boolean;
  token: string;
};

type QueueWhatsAppMediaArchiveDependencies = {
  loadSettings: () => Promise<WhatsAppMediaArchiveSettings>;
  archive: (input: WhatsAppMediaArchiveCandidate & { token: string }) => Promise<unknown>;
  waitUntil: (task: Promise<void>) => void;
  sleep?: (milliseconds: number) => Promise<void>;
  onError: (error: unknown) => void;
};

export function queueWhatsAppMediaArchive(
  direction: 'inbound' | 'outbound',
  candidate: WhatsAppMediaArchiveCandidate | null,
  dependencies: QueueWhatsAppMediaArchiveDependencies,
): boolean {
  const mediaId = candidate?.mediaId.trim();
  if (direction !== 'inbound' || !candidate || !mediaId) return false;

  const archiveWithRetry = async (settings: WhatsAppMediaArchiveSettings) => {
    const input = { ...candidate, mediaId, token: settings.token };
    const sleep = dependencies.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await dependencies.archive(input);
        return;
      } catch (error) {
        if (attempt === 2) throw error;
        await sleep(attempt === 0 ? 250 : 750);
      }
    }
  };

  const task = Promise.resolve()
    .then(() => dependencies.loadSettings())
    .then((settings) => {
      if (!settings.enabled || !settings.token.trim()) return;
      return archiveWithRetry(settings);
    })
    .then(() => undefined)
    .catch((error: unknown) => {
      dependencies.onError(error);
    });

  dependencies.waitUntil(task);
  return true;
}
