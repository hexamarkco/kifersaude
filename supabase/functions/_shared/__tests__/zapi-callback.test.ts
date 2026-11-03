// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { handleZapiCallback } from '../../comm-whatsapp-webhook/zapi-callback';

const mocks = vi.hoisted(() => ({
  active: { provider: 'zapi', instanceId: 'inst-01', revision: 1, changedAt: '2026-01-01T00:00:00.000Z' },
  begin: vi.fn(async () => ({ id: 'lease' })),
  finish: vi.fn(async () => {}),
  canonical: vi.fn(async () => ({ identityConflict: false, phoneNumber: '5511999999999' })),
  status: vi.fn(async () => {}),
  receipt: vi.fn(async (): Promise<object | null> => null),
  record: vi.fn(async () => {}),
  archive: vi.fn(async () => 'image/jpeg'),
}));

vi.mock('../comm-whatsapp/transport', () => ({
  getZapiCredentials: () => ({ instanceId: 'inst-01', instanceToken: 'test', clientToken: 'test' }),
  readWhatsAppTransport: () => Promise.resolve(mocks.active),
  beginWhatsAppOperation: mocks.begin,
  finishWhatsAppOperation: mocks.finish,
}));
vi.mock('../comm-whatsapp', async (importOriginal) => ({
  ...await importOriginal<typeof import('../comm-whatsapp')>(),
  resolveCommWhatsAppCanonicalChatRoute: mocks.canonical,
  updateCommWhatsAppMessageStatus: mocks.status,
}));
vi.mock('../webhook-event-receipts', () => ({
  findCommWhatsAppEventReceipt: mocks.receipt,
  recordCommWhatsAppEventReceipt: mocks.record,
}));
vi.mock('../comm-whatsapp/zapi-media', () => ({
  archiveZapiMedia: mocks.archive,
  isTrustedZapiMediaUrl: () => true,
}));

const fixtureKey = 'zapi-fixture-'.repeat(3);
const channel = { id: 'primary-id', phone_number: '5511888888888', slug: 'primary' };
const inbound = {
  type: 'ReceivedCallback', instanceId: 'inst-01', connectedPhone: channel.phone_number, phone: '5511999999999',
  messageId: 'MSG-1', momment: Date.parse('2026-02-01T00:00:00.001Z'), fromMe: false, text: { message: 'Olá' },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.active.provider = 'zapi';
  vi.stubGlobal('Deno', { env: { get: () => fixtureKey } });
});
afterEach(() => { vi.unstubAllGlobals(); });

async function callback(payload: object, providedSecret = fixtureKey) {
  const upsert = vi.fn(async () => ({ error: null }));
  const from = vi.fn(() => ({ upsert }));
  const admin = { from } as unknown as Parameters<typeof handleZapiCallback>[1];
  const persist = vi.fn(async () => ({ id: 'chat-1' }));
  const response = await handleZapiCallback(new Request(`https://test.invalid?channel=primary&secret=${providedSecret}`, {
    method: 'POST', body: JSON.stringify(payload),
  }), admin, channel, persist);
  return { response, persist, from, upsert };
}

describe('Z-API callback entry point', () => {
  test('rejects unauthorized and wrong-instance requests before any persistence', async () => {
    const badSecret = await callback(inbound, 'incorrect');
    expect(badSecret.response.status).toBe(401);
    expect(badSecret.from).not.toHaveBeenCalled();
    const badInstance = await callback({ ...inbound, instanceId: 'other' });
    expect(badInstance.response.status).toBe(400);
    expect(badInstance.persist).not.toHaveBeenCalled();
  });

  test('passes a verified new message to the Inbox once and deduplicates a callback with a receipt', async () => {
    const first = await callback(inbound);
    expect(first.response.status).toBe(200);
    expect(first.persist).toHaveBeenCalledWith(expect.objectContaining({ id: 'zapi:inst-01:MSG-1', from_me: false }));
    expect(mocks.record).toHaveBeenCalledWith(expect.anything(), channel.id, 'message:zapi:inst-01:MSG-1',
      'message', 'zapi:inst-01:MSG-1', expect.objectContaining({ provider: 'zapi' }), null);
    mocks.receipt.mockResolvedValueOnce({});
    const duplicate = await callback(inbound);
    expect(await duplicate.response.json()).toMatchObject({ duplicate: true });
    expect(duplicate.persist).not.toHaveBeenCalled();
  });

  test('an inactive provider can reconcile delivery without inserting an inbound message', async () => {
    mocks.active.provider = 'whapi';
    const message = await callback(inbound);
    expect(await message.response.json()).toMatchObject({ skipped: 'inactive_or_delayed' });
    expect(message.persist).not.toHaveBeenCalled();
    expect(mocks.begin).not.toHaveBeenCalled();
    const read = await callback({ ...inbound, type: 'MessageStatusCallback', status: 'READ', ids: ['MSG-1'] });
    expect(read.response.status).toBe(200);
    expect(mocks.status).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      channelId: channel.id, deliveryStatus: 'read', externalMessageId: 'zapi:inst-01:MSG-1',
    }));
  });

  test('a late inbound event and a LID-only contact cannot start a turn', async () => {
    const late = await callback({ ...inbound, momment: Date.parse('2025-12-01T00:00:00.000Z') });
    expect(await late.response.json()).toMatchObject({ skipped: 'inactive_or_delayed' });
    expect(late.persist).not.toHaveBeenCalled();
    const lid = await callback({ ...inbound, phone: '1234567890@lid' });
    expect(await lid.response.json()).toMatchObject({ skipped: 'identity_review' });
    expect(lid.from).toHaveBeenCalledWith('whatsapp_transport_identity_review');
    expect(lid.persist).not.toHaveBeenCalled();
  });

  test('persists a message even if media storage fails and queues the private URL for retry', async () => {
    mocks.archive.mockRejectedValueOnce(new Error('storage unavailable'));
    const url = 'https://media.test.invalid/path?signature=private';
    const message = await callback({ ...inbound, text: null, image: { imageUrl: url, mimeType: 'image/jpeg' } });
    expect(message.response.status).toBe(200);
    expect(message.persist).toHaveBeenCalledWith(expect.objectContaining({
      image: expect.objectContaining({ id: expect.stringMatching(/^zapi-media-[a-f0-9]{64}$/) }),
    }));
    expect(JSON.stringify(message.persist.mock.calls)).not.toContain(url);
    expect(message.from).toHaveBeenCalledWith('comm_whatsapp_enrichment_jobs');
    expect(message.upsert).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ provider: 'zapi', media_url: url }),
    }), expect.objectContaining({ ignoreDuplicates: true }));
  });
});
