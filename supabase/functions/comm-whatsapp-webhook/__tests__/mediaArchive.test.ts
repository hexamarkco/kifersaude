import { describe, expect, it, vi } from 'vitest';

import { queueWhatsAppMediaArchive, type WhatsAppMediaArchiveCandidate } from '../mediaArchive';

const candidate: WhatsAppMediaArchiveCandidate = {
  mediaId: 'media-1',
  mediaUrl: 'https://media.example.test/attachment',
  mimeType: 'image/jpeg',
  fileName: 'foto.jpg',
};

describe('queueWhatsAppMediaArchive', () => {
  it('archives incoming media in the background with the configured integration', async () => {
    const tasks: Promise<void>[] = [];
    const archive = vi.fn(async () => undefined);
    const waitUntil = vi.fn((task: Promise<void>) => tasks.push(task));
    const onError = vi.fn();

    const queued = queueWhatsAppMediaArchive('inbound', candidate, {
      loadSettings: async () => ({ enabled: true, token: 'test-token' }),
      archive,
      waitUntil,
      onError,
    });

    expect(queued).toBe(true);
    expect(waitUntil).toHaveBeenCalledOnce();
    await Promise.all(tasks);
    expect(archive).toHaveBeenCalledWith({ ...candidate, token: 'test-token' });
    expect(onError).not.toHaveBeenCalled();
  });

  it('does not archive outbound or unidentified media', () => {
    const dependencies = {
      loadSettings: vi.fn(async () => ({ enabled: true, token: 'test-token' })),
      archive: vi.fn(async () => undefined),
      waitUntil: vi.fn(),
      onError: vi.fn(),
    };

    expect(queueWhatsAppMediaArchive('outbound', candidate, dependencies)).toBe(false);
    expect(queueWhatsAppMediaArchive('inbound', { ...candidate, mediaId: ' ' }, dependencies)).toBe(false);
    expect(dependencies.waitUntil).not.toHaveBeenCalled();
    expect(dependencies.loadSettings).not.toHaveBeenCalled();
  });

  it('does not archive when WhatsApp integration is disabled', async () => {
    const tasks: Promise<void>[] = [];
    const archive = vi.fn(async () => undefined);

    queueWhatsAppMediaArchive('inbound', candidate, {
      loadSettings: async () => ({ enabled: false, token: 'test-token' }),
      archive,
      waitUntil: (task) => tasks.push(task),
      onError: vi.fn(),
    });

    await Promise.all(tasks);
    expect(archive).not.toHaveBeenCalled();
  });

  it('retries a transient storage failure before reporting success', async () => {
    const tasks: Promise<void>[] = [];
    const archive = vi.fn()
      .mockRejectedValueOnce(new Error('temporary storage failure'))
      .mockResolvedValueOnce(undefined);

    queueWhatsAppMediaArchive('inbound', candidate, {
      loadSettings: async () => ({ enabled: true, token: 'test-token' }),
      archive,
      waitUntil: (task) => tasks.push(task),
      sleep: async () => undefined,
      onError: vi.fn(),
    });

    await Promise.all(tasks);
    expect(archive).toHaveBeenCalledTimes(2);
  });

  it('handles background failures without rejecting the webhook task', async () => {
    const tasks: Promise<void>[] = [];
    const failure = new Error('storage unavailable');
    const onError = vi.fn();

    queueWhatsAppMediaArchive('inbound', candidate, {
      loadSettings: async () => ({ enabled: true, token: 'test-token' }),
      archive: async () => { throw failure; },
      waitUntil: (task) => tasks.push(task),
      sleep: async () => undefined,
      onError,
    });

    await expect(Promise.all(tasks)).resolves.toEqual([undefined]);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(failure);
  });
});
