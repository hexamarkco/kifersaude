// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { executeProviderOperation } from '../../comm-whatsapp-provider-operations/service';
import { createProviderOperationsHandler } from '../../comm-whatsapp-provider-operations/handler';

const mocks = vi.hoisted(() => ({
  stored: null as Record<string, unknown> | null,
  uncertain: false,
  state: { provider: 'zapi', instanceId: 'instance', revision: 4, changedAt: '' },
  enabled: true,
  canonical: vi.fn(async () => ({ identityConflict: false, externalChatId: '5511999999999@s.whatsapp.net', phoneNumber: '5511999999999', displayName: 'Contato', pushName: null })),
  persist: vi.fn(async () => ({ chatId: 'chat' })),
  mutation: vi.fn(async () => {}),
  begin: vi.fn(), finish: vi.fn(async () => {}),
}));

vi.mock('../comm-whatsapp', async (original) => ({
  ...await original<typeof import('../comm-whatsapp')>(),
  ensureCommWhatsAppSettings: async () => ({ enabled: mocks.enabled }),
  ensurePrimaryChannel: async () => ({ id: 'primary', phone_number: '5511888888888' }),
  resolveCommWhatsAppCanonicalChatRoute: mocks.canonical,
  persistCommWhatsAppMessage: mocks.persist,
  applyCommWhatsAppMessageMutation: mocks.mutation,
}));
vi.mock('../comm-whatsapp/transport', async (original) => {
  const actual = await original<typeof import('../comm-whatsapp/transport')>();
  return {
    ...actual,
    getZapiCredentials: () => ({ instanceId: 'instance', instanceToken: 'private-token', clientToken: 'account-token' }),
    readWhatsAppTransport: async () => mocks.state,
    beginWhatsAppOperation: mocks.begin.mockImplementation(async () => {
      if (mocks.uncertain) throw new actual.WhatsAppTransportError('Confirmação pendente', true);
      return mocks.stored ? { id: '', result: mocks.stored } : { id: 'attempt', result: null };
    }),
    finishWhatsAppOperation: mocks.finish,
  };
});

const actor = { userId: 'operator', profileId: 'profile', role: 'admin', canEditModule: true, canViewModule: true };
const request = { operation: 'message/send-text', input: { phone: '5511999999999', message: 'Olá' }, revision: 4, requestId: 'request_123' };
const rpc = vi.fn(async () => ({ data: { allowed: true }, error: null }));
const update = vi.fn((patch: Record<string, unknown>) => ({ eq: async () => {
  if (patch.result) mocks.stored = patch.result as Record<string, unknown>;
  if (patch.uncertain) mocks.uncertain = true;
  return { error: null };
} }));
const remove = vi.fn(() => ({ eq: async () => ({ error: null }) }));
const admin = { from: () => ({ update, delete: remove }), rpc } as unknown as Parameters<typeof executeProviderOperation>[0];
const fetcher = vi.fn(async (url: string): Promise<Response> => {
  if (url.endsWith('/status')) return Response.json({ connected: true });
  if (url.endsWith('/device')) return Response.json({ phone: '5511888888888' });
  return Response.json({ messageId: 'MSG', zaapId: 'QUEUE' });
});
const sends = () => fetcher.mock.calls.filter(([url]) => url.includes('/send-text'));

beforeEach(() => {
  vi.clearAllMocks(); mocks.stored = null; mocks.uncertain = false; mocks.enabled = true;
  mocks.state.provider = 'zapi'; mocks.state.revision = 4;
  rpc.mockResolvedValue({ data: { allowed: true }, error: null });
  mocks.canonical.mockResolvedValue({ identityConflict: false, externalChatId: '5511999999999@s.whatsapp.net', phoneNumber: '5511999999999', displayName: 'Contato', pushName: null });
  mocks.persist.mockResolvedValue({ chatId: 'chat' });
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => vi.unstubAllGlobals());

describe('provider operation execution', () => {
  test('replays an accepted send and projects it locally without another external send', async () => {
    const first = await executeProviderOperation(admin, actor, request);
    expect(first).toMatchObject({ state: 'queued', externalMessageId: 'zapi:instance:MSG', historyPending: false });
    expect(await executeProviderOperation(admin, actor, request)).toEqual(first);
    expect(sends()).toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith('check_contact_permission_for_send', expect.objectContaining({ p_endpoint_normalized: '5511999999999', p_purpose_scope: 'commercial' }));
    expect(mocks.persist).toHaveBeenCalledWith(admin, expect.objectContaining({ externalMessageId: 'zapi:instance:MSG', deliveryStatus: 'queued' }));
  });

  test('rejects reuse of an accepted request identifier with other content', async () => {
    await executeProviderOperation(admin, actor, request);
    await expect(executeProviderOperation(admin, actor, { ...request, input: { ...request.input, message: 'Outra' } })).rejects.toThrow(/outros dados/);
    expect(sends()).toHaveLength(1);
  });

  test('holds ambiguous sends and never retries externally', async () => {
    fetcher.mockImplementationOnce(async () => Response.json({ connected: true }))
      .mockImplementationOnce(async () => Response.json({ phone: '5511888888888' }))
      .mockImplementationOnce(async () => new Response('unavailable', { status: 503 }));
    await expect(executeProviderOperation(admin, actor, request)).rejects.toMatchObject({ uncertain: true });
    expect(mocks.uncertain).toBe(true);
    await expect(executeProviderOperation(admin, actor, request)).rejects.toMatchObject({ uncertain: true });
    expect(sends()).toHaveLength(1);
  });

  test('holds a 200 queue-only response instead of asserting a confirmed send', async () => {
    fetcher.mockImplementationOnce(async () => Response.json({ connected: true }))
      .mockImplementationOnce(async () => Response.json({ phone: '5511888888888' }))
      .mockImplementationOnce(async () => Response.json({ zaapId: 'QUEUE' }));
    await expect(executeProviderOperation(admin, actor, request)).rejects.toMatchObject({ uncertain: true });
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  test('local history failures can be retried using the saved acceptance', async () => {
    mocks.persist.mockRejectedValueOnce(new Error('database unavailable'));
    expect(await executeProviderOperation(admin, actor, request)).toMatchObject({ historyPending: true });
    expect(await executeProviderOperation(admin, actor, request)).toMatchObject({ historyPending: false });
    expect(sends()).toHaveLength(1);
  });

  test('queue acceptance does not apply an edit or create a second message before its callback', async () => {
    await executeProviderOperation(admin, actor, { ...request, input: { ...request.input, editMessageId: 'ORIGINAL' } });
    expect(mocks.persist).not.toHaveBeenCalled();
    expect(mocks.mutation).not.toHaveBeenCalled();
    expect(mocks.stored).toMatchObject({ operation: 'message/send-text', externalId: 'zapi:instance:MSG' });
  });

  test('checks opt-out immediately before dispatch and blocks on permission failure', async () => {
    rpc.mockResolvedValueOnce({ data: { allowed: false }, error: null });
    await expect(executeProviderOperation(admin, actor, request)).rejects.toMatchObject({ code: 'CONTACT_PERMISSION_BLOCKED' });
    expect(sends()).toHaveLength(0);
    expect(mocks.finish).toHaveBeenCalled();
  });

  test('blocks stale revision, disabled integration, identity conflict and provider changes', async () => {
    await expect(executeProviderOperation(admin, actor, { ...request, revision: 3 })).rejects.toThrow(/conexão mudou/);
    mocks.enabled = false;
    await expect(executeProviderOperation(admin, actor, request)).rejects.toThrow(/desabilitada/);
    mocks.enabled = true;
    mocks.canonical.mockResolvedValueOnce({ identityConflict: true, externalChatId: '', phoneNumber: '', displayName: '', pushName: null });
    await expect(executeProviderOperation(admin, actor, request)).rejects.toThrow(/identidade/);
    mocks.state.provider = 'whapi';
    await expect(executeProviderOperation(admin, actor, request)).rejects.toThrow(/Ative a Z-API/);
    expect(sends()).toHaveLength(0);
  });

  test('administrative mutations require admin, including accepting an invite through GET', async () => {
    await expect(executeProviderOperation(admin, { ...actor, role: 'operator' }, {
      ...request, operation: 'group/accept-group-invite', input: { url: 'https://chat.whatsapp.com/invite' },
    })).rejects.toMatchObject({ status: 403 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  test('checks every broadcast member and does not send if one is blocked', async () => {
    fetcher.mockImplementationOnce(async () => Response.json({ connected: true }))
      .mockImplementationOnce(async () => Response.json({ phone: '5511888888888' }))
      .mockImplementationOnce(async () => Response.json([{ broadcastId: '1779395073@broadcast', phones: ['5511999999999', '5511777777777'] }]));
    rpc.mockResolvedValueOnce({ data: { allowed: true }, error: null }).mockResolvedValueOnce({ data: { allowed: false }, error: null });
    await expect(executeProviderOperation(admin, actor, { ...request, input: { ...request.input, phone: '1779395073@broadcast' } }))
      .rejects.toMatchObject({ code: 'CONTACT_PERMISSION_BLOCKED' });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(sends()).toHaveLength(0);
  });
});

describe('authenticated operation HTTP boundary', () => {
  const execute = vi.fn(async () => ({ state: 'processed', result: null }));
  const make = (user: typeof actor | Response = actor) => createProviderOperationsHandler({
    headers: {}, authorize: async () => user, rateLimit: async () => true, execute,
  });
  const post = (body: unknown) => new Request('https://crm.test/operations', { method: 'POST', body: JSON.stringify(body) });

  test('rejects unauthenticated calls, unknown operations and read-only users before execution', async () => {
    expect((await make(new Response(null, { status: 401 }))(post(request))).status).toBe(401);
    expect((await make()(post({ operation: 'arbitrary/proxy' }))).status).toBe(400);
    expect((await make({ ...actor, canEditModule: false })(post(request))).status).toBe(403);
    expect(execute).not.toHaveBeenCalled();
  });

  test('only content sends return 202 and invalid JSON returns 400', async () => {
    expect((await make()(post(request))).status).toBe(202);
    expect((await make()(post({ operation: 'newsletter/newsletter-list' }))).status).toBe(200);
    expect((await make()(new Request('https://crm.test', { method: 'POST', body: '{invalid' }))).status).toBe(400);
  });
});
