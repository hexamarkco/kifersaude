import { describe, expect, test, vi } from 'vitest';
import { createWhapiClient, resolveWhapiOutboundDeliveryStatus, WHAPI_BASE_URL } from '../comm-whatsapp';
import { createZapiAdapter, zapiDestination, zapiExternalId } from '../comm-whatsapp/zapi';
import { normalizeZapiWebhook } from '../comm-whatsapp/zapi-webhook';
import { createWhatsAppDispatch, decodeDispatchRequest } from '../comm-whatsapp/transport';

const credentials = { instanceId: 'inst-01', instanceToken: 'instance-secret', clientToken: 'client-secret' };
const phone = '5511999999999';
const channel = '5511888888888';
const time = 1_770_000_000_123;
const received = {
  instanceId: credentials.instanceId, connectedPhone: channel, type: 'ReceivedCallback',
  fromMe: false, momment: time, messageId: 'ABC123', phone, isGroup: false,
};

describe('transport contracts', () => {
  test('WHAPI preserves authentication, quoted text and its sent fallback', async () => {
    const fetcher = vi.fn(async () => Response.json({ message: { id: 'whapi-id' } }));
    vi.stubGlobal('fetch', fetcher);
    try {
      const response = await createWhapiClient('legacy-token').sendText(`${phone}@s.whatsapp.net`, 'Olá', {
        replyMessageId: 'original',
      });
      expect(fetcher).toHaveBeenCalledWith(`${WHAPI_BASE_URL}/messages/text`, expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer legacy-token' }),
        body: JSON.stringify({ to: `${phone}@s.whatsapp.net`, body: 'Olá', quoted: { id: 'original' } }),
      }));
      expect(resolveWhapiOutboundDeliveryStatus(await response.json(), 'whapi-id')).toBe('sent');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('Z-API uses independent credentials and separates the WhatsApp ID from the queue ID', async () => {
    const fetcher = vi.fn(async () => Response.json({ zaapId: 'QUEUE', messageId: 'ABC123' }));
    const adapter = createZapiAdapter(credentials, fetcher);
    await expect(adapter.send({ phone, kind: 'text', text: 'Olá', quote: 'ORIGINAL' })).resolves.toEqual({
      messageId: 'zapi:inst-01:ABC123', queueId: 'QUEUE',
    });
    expect(fetcher).toHaveBeenCalledWith('https://api.z-api.io/instances/inst-01/token/instance-secret/send-text', expect.objectContaining({
      method: 'POST', redirect: 'error', headers: expect.objectContaining({ 'Client-Token': 'client-secret' }),
      body: JSON.stringify({ phone, messageId: 'ORIGINAL', message: 'Olá' }),
    }));
  });

  test('Z-API document preserves the filename, extension, caption and quote', async () => {
    const fetcher = vi.fn(async () => Response.json({ messageId: 'DOC' }));
    await createZapiAdapter(credentials, fetcher).send({
      phone, kind: 'document', media: 'data:application/pdf;name=a.pdf;base64,YQ==',
      fileName: 'a.pdf', caption: 'Segue o arquivo', quote: 'ORIGINAL',
    });
    expect(fetcher).toHaveBeenCalledWith(expect.stringMatching(/\/send-document\/pdf$/), expect.objectContaining({
      body: JSON.stringify({ phone, messageId: 'ORIGINAL', document: 'data:application/pdf;base64,YQ==', caption: 'Segue o arquivo', fileName: 'a.pdf' }),
    }));
  });

  test.each([408, 429, 500, 503])('Z-API HTTP %s stays uncertain and makes one attempt', async (status) => {
    const fetcher = vi.fn(async () => new Response('instance-secret', { status }));
    await expect(createZapiAdapter(credentials, fetcher).send({ phone, kind: 'text', text: 'Olá' }))
      .rejects.toMatchObject({ uncertain: true, status, message: expect.not.stringContaining('instance-secret') });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test('a missing WhatsApp ID, a network failure and a timeout never become acceptance', async () => {
    const input = { phone, kind: 'text' as const, text: 'Olá' };
    const queueOnly = vi.fn(async () => Response.json({ zaapId: 'QUEUE' }));
    const disconnected = vi.fn(async () => { throw new Error('instance-secret'); });
    const timeout = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      await new Promise<void>((resolve) => init?.signal?.addEventListener('abort', () => resolve(), { once: true }));
      throw new DOMException('timeout', 'TimeoutError');
    });
    await expect(createZapiAdapter(credentials, queueOnly).send(input)).rejects.toMatchObject({ uncertain: true });
    await expect(createZapiAdapter(credentials, disconnected).send(input)).rejects.toMatchObject({ uncertain: true });
    // A separate timer keeps the Node worker alive while AbortSignal's unref'ed timer fires.
    const keepAlive = setTimeout(() => {}, 100);
    try {
      await expect(createZapiAdapter(credentials, timeout).send(input, 5)).rejects.toMatchObject({ uncertain: true, status: 504 });
    } finally {
      clearTimeout(keepAlive);
    }
  });

  test('group addresses, verified phones and provider-scoped quotes are handled separately', () => {
    expect(zapiDestination('120363000123@g.us')).toBe('120363000123-group');
    expect(zapiDestination('987654321012@lid')).toBe('');
    expect(zapiDestination('987654321012@lid', phone)).toBe(phone);
    expect(zapiDestination(`${phone}@s.whatsapp.net`, channel)).toBe('');
    expect(() => decodeDispatchRequest(credentials.instanceId, `${WHAPI_BASE_URL}/messages/text`, JSON.stringify({
      to: `${phone}@s.whatsapp.net`, body: 'Olá', quoted: 'whapi-message-id',
    }))).toThrow(/própria instância/);
    expect(() => decodeDispatchRequest(credentials.instanceId, `${WHAPI_BASE_URL}/messages/document`, JSON.stringify({
      to: `${phone}@s.whatsapp.net`, media: 'a-whapi-media-id',
    }))).toThrow(/formato/);
  });

  test('an accepted dispatch is replayed from the ledger without a second provider call', async () => {
    let result: object | null = null;
    const rpc = vi.fn(async () => ({
      data: result ? { state: 'recorded', result } : { state: 'started', id: 'attempt-1' }, error: null,
    }));
    const update = vi.fn((patch: { result?: object }) => ({
      eq: async () => { result = patch.result ?? null; return { error: null }; },
    }));
    const admin = { rpc, from: () => ({ update }) } as unknown as Parameters<typeof createWhatsAppDispatch>[0];
    const fetcher = vi.fn(async (request: string) => {
      if (request.endsWith('/status')) return Response.json({ connected: true });
      if (request.endsWith('/device')) return Response.json({ phone: channel });
      return Response.json({ messageId: 'ACCEPTED', zaapId: 'QUEUE' });
    });
    vi.stubGlobal('fetch', fetcher);
    const environment: Record<string, string> = {
      ZAPI_INSTANCE_ID: credentials.instanceId,
      ZAPI_INSTANCE_TOKEN: credentials.instanceToken,
      ZAPI_CLIENT_TOKEN: credentials.clientToken,
    };
    vi.stubGlobal('Deno', { env: { get: (name: string) => environment[name] } });
    try {
      const dispatch = await createWhatsAppDispatch(admin, {
        state: { provider: 'zapi', instanceId: credentials.instanceId, revision: 1, changedAt: '' },
        key: 'job:one', channelPhone: channel,
      });
      const send = () => dispatch(`${WHAPI_BASE_URL}/messages/text`, {
        method: 'POST', body: JSON.stringify({ to: `${phone}@s.whatsapp.net`, body: 'Olá' }),
      });
      const accepted = await (await send()).json();
      expect(accepted).toMatchObject({ id: 'zapi:inst-01:ACCEPTED', status: 'queued', zaap_id: 'QUEUE' });
      expect(await (await send()).json()).toEqual(accepted);
      expect(fetcher).toHaveBeenCalledTimes(3);
      expect(rpc).toHaveBeenLastCalledWith('whatsapp_transport_begin', {
        p_revision: 1, p_provider: 'zapi', p_operation_key: 'job:one',
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('Z-API webhooks', () => {
  test('rejects the wrong instance or account and does not convert a LID into a phone', () => {
    expect(normalizeZapiWebhook(received, 'other', channel)).toBeNull();
    expect(normalizeZapiWebhook(received, credentials.instanceId, phone)).toBeNull();
    expect(normalizeZapiWebhook({ ...received, phone: '12345@lid', chatLid: '12345@lid' }, credentials.instanceId, channel))
      .toMatchObject({ kind: 'identity_review', lid: '12345@lid', id: 'zapi:inst-01:ABC123' });
  });

  test('normalizes both directions and scopes message identity to the instance', () => {
    const payload = { ...received, text: { message: 'Oi' }, senderLid: '12345@lid' };
    const normalize = (fromMe: boolean) => normalizeZapiWebhook({ ...payload, fromMe }, credentials.instanceId, channel);
    expect(normalize(false)).toMatchObject({ kind: 'message', id: 'zapi:inst-01:ABC123',
      message: { chat_id: `${phone}@s.whatsapp.net`, from_me: false, text: { body: 'Oi' } } });
    expect(normalize(true)).toMatchObject({ kind: 'message', message: { from_me: true } });
    expect(normalize(false)).toEqual(normalize(false));
    expect(zapiExternalId('other-instance', 'ABC123')).not.toBe(zapiExternalId(credentials.instanceId, 'ABC123'));
  });

  test('delivery, read and failure are independent of HTTP acceptance', () => {
    const normalize = (fields: Record<string, unknown>) => normalizeZapiWebhook({ ...received, ...fields }, credentials.instanceId, channel);
    expect(normalize({ type: 'MessageStatusCallback', ids: ['ABC123'], status: 'READ' }))
      .toMatchObject({ kind: 'status', ids: ['zapi:inst-01:ABC123'], status: 'read' });
    expect(normalize({ type: 'MessageStatusCallback', ids: ['ABC123'], status: 'RECEIVED' }))
      .toMatchObject({ kind: 'status', status: 'delivered' });
    expect(normalize({ type: 'DeliveryCallback', zaapId: 'QUEUE', error: 'private data' }))
      .toMatchObject({ kind: 'status', ids: ['zapi:inst-01:ABC123'], status: 'failed', error: 'A Z-API informou falha no envio.' });
  });

  test('preserves the group route and media while keeping a participant LID opaque', () => {
    const event = normalizeZapiWebhook({
      ...received, isGroup: true, phone: '120363000123-group', participantLid: '12345@lid',
      image: { imageUrl: 'https://media.example.test/file', mimeType: 'image/jpeg', caption: 'arquivo' },
    }, credentials.instanceId, channel);
    expect(event).toMatchObject({ kind: 'message', media: { type: 'image' }, message: {
      chat_id: '120363000123@g.us', from: '', image: { caption: 'arquivo' },
    } });
  });

  test('normalizes edits, deletes and reactions without making new messages', () => {
    const normalize = (fields: Record<string, unknown>) => normalizeZapiWebhook({ ...received, ...fields }, credentials.instanceId, channel);
    expect(normalize({ isEdit: true, text: { message: 'Editado' }, referenceMessageId: 'ORIGINAL' }))
      .toMatchObject({ kind: 'mutation', mutation: 'edit', targetId: 'zapi:inst-01:ORIGINAL' });
    expect(normalize({ notification: 'REVOKE', referenceMessageId: 'ORIGINAL' }))
      .toMatchObject({ kind: 'mutation', mutation: 'delete' });
    expect(normalize({ reaction: { value: '❤️', time, referencedMessage: { messageId: 'ORIGINAL' } } }))
      .toMatchObject({ kind: 'mutation', mutation: 'reaction', data: { actor_key: phone, emoji: '❤️' } });
  });
});
