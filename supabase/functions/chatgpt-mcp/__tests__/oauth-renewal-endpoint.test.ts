// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, createClient } = vi.hoisted(() => ({ rpc: vi.fn(), createClient: vi.fn() }));
vi.mock('npm:@supabase/supabase-js@2.57.4', () => ({ createClient }));
import { handleOAuthRoute } from '../oauth';

const endpoint = 'https://project.supabase.co/functions/v1/chatgpt-mcp';
const config: Record<string, string> = { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-server-key', KIFER_MCP_OAUTH_CLIENT_ID: 'chatgpt-kifer', KIFER_MCP_OAUTH_REDIRECT_URI: 'https://client.test/callback', KIFER_MCP_OAUTH_UI_URL: 'https://crm.test/consent' };
const hash = async (value: string) => Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))).toString('base64url');
const token = (params: Record<string, string>) => handleOAuthRoute(new Request(`${endpoint}/oauth/token`, { method: 'POST', body: new URLSearchParams({ client_id: 'chatgpt-kifer', ...params }) }));

beforeEach(() => {
  vi.stubGlobal('Deno', { env: { get: (name: string) => config[name] } });
  createClient.mockReset().mockReturnValue({ rpc });
  rpc.mockReset().mockResolvedValue({ data: { success: true, scope: 'kifer.read kifer.write', expires_in: 3600 }, error: null });
});
afterAll(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('OAuth connection renewal HTTP flow', () => {
  it('requests offline renewal on initial consent even when a client only asks for read/write', async () => {
    const authorize = new URL(`${endpoint}/oauth/authorize`);
    authorize.search = new URLSearchParams({ response_type: 'code', client_id: 'chatgpt-kifer', redirect_uri: config.KIFER_MCP_OAUTH_REDIRECT_URI, state: 'synthetic-state', code_challenge: 'v'.repeat(43), code_challenge_method: 'S256', scope: 'kifer.read kifer.write' }).toString();
    const response = await handleOAuthRoute(new Request(authorize));
    expect(response?.status).toBe(303);
    expect(new URL(response!.headers.get('location')!).searchParams.get('scope')).toBe('kifer.read kifer.write offline_access');
    authorize.searchParams.set('scope', 'kifer.read');
    const read = await handleOAuthRoute(new Request(authorize));
    expect(new URL(read!.headers.get('location')!).searchParams.get('scope')).toBe('kifer.read offline_access');
    expect(createClient).not.toHaveBeenCalled();
  });

  it('always returns both credentials and sends only hashes to the atomic exchange', async () => {
    const response = await token({ grant_type: 'authorization_code', code: 'synthetic-code', code_verifier: 'synthetic-verifier', redirect_uri: config.KIFER_MCP_OAUTH_REDIRECT_URI });
    expect(response?.status).toBe(200);
    const body = await response!.json();
    expect(body).toMatchObject({ token_type: 'Bearer', expires_in: 3600, scope: 'kifer.read kifer.write' });
    expect(body.refresh_token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body.access_token).not.toBe(body.refresh_token);
    expect(rpc).toHaveBeenCalledWith('mcp_exchange_oauth_tokens', { p_grant_type: 'authorization_code', p_credential_hash: await hash('synthetic-code'), p_client_id: 'chatgpt-kifer', p_resource: endpoint, p_redirect_uri: config.KIFER_MCP_OAUTH_REDIRECT_URI, p_code_challenge: await hash('synthetic-verifier'), p_access_token_hash: await hash(body.access_token), p_refresh_token_hash: await hash(body.refresh_token) });
    expect(response!.headers.get('cache-control')).toBe('no-store');
  });

  it('renews after one hour without another login and returns the replacement refresh credential', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2030-10-22T12:00:00Z'));
    const first = await (await token({ grant_type: 'authorization_code', code: 'synthetic-code', code_verifier: 'synthetic-verifier', redirect_uri: config.KIFER_MCP_OAUTH_REDIRECT_URI }))!.json();
    vi.setSystemTime(new Date('2030-10-22T13:01:00Z'));
    const renewed = await (await token({ grant_type: 'refresh_token', refresh_token: first.refresh_token }))!.json();
    expect(rpc.mock.calls[1][1]).toMatchObject({ p_grant_type: 'refresh_token', p_credential_hash: await hash(first.refresh_token), p_code_challenge: null, p_redirect_uri: null });
    expect(renewed.scope).toBe(first.scope);
    expect(renewed.refresh_token).not.toBe(first.refresh_token);
    expect(renewed.access_token).not.toBe(first.access_token);
    vi.useRealTimers();
  });

  it('returns OAuth errors without leaking tokens on invalid grants or persistence errors', async () => {
    rpc.mockResolvedValueOnce({ data: { success: false }, error: null });
    const invalid = await token({ grant_type: 'refresh_token', refresh_token: 'synthetic-refresh' });
    expect(invalid?.status).toBe(400);
    expect(await invalid!.json()).toMatchObject({ error: 'invalid_grant' });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'sensitive-db-detail' } });
    const failed = await token({ grant_type: 'refresh_token', refresh_token: 'synthetic-refresh' });
    expect(failed?.status).toBe(500);
    const body = await failed!.json();
    expect(body.error).toBe('server_error');
    expect(JSON.stringify(body)).not.toMatch(/sensitive-db-detail|synthetic-refresh|access_token|refresh_token/);
  });

  it('rejects wrong targets, clients and malformed bodies before accessing the database', async () => {
    expect((await token({ grant_type: 'refresh_token', refresh_token: 'synthetic', resource: 'https://other.test' }))?.status).toBe(400);
    expect((await token({ client_id: 'other-client', grant_type: 'refresh_token', refresh_token: 'synthetic' }))?.status).toBe(401);
    expect((await handleOAuthRoute(new Request(`${endpoint}/oauth/token`, { method: 'POST', body: '{}' })))?.status).toBe(400);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('advertises offline access and the refresh grant in OAuth discovery', async () => {
    const metadata = await (await handleOAuthRoute(new Request(`${endpoint}/.well-known/oauth-authorization-server`)))!.json();
    expect(metadata.scopes_supported).toContain('offline_access');
    expect(metadata.grant_types_supported).toContain('refresh_token');
  });
});
