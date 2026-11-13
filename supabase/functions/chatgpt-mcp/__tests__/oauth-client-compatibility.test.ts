// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { createClient, getUser, insert, rpc } = vi.hoisted(() => ({
  createClient: vi.fn(), getUser: vi.fn(), insert: vi.fn(), rpc: vi.fn(),
}));
vi.mock('npm:@supabase/supabase-js@2.57.4', () => ({ createClient }));
import { handleOAuthRoute } from '../oauth';

const endpoint = 'https://project.supabase.co/functions/v1/chatgpt-mcp';
const claudeCallback = 'https://claude.ai/api/mcp/auth_callback';
const chatgptCallback = 'https://chatgpt.test/callback';
const verifier = 'v'.repeat(43);
let config: Record<string, string>;
const authorizationParams = (redirectUri: string) => ({
  response_type: 'code', client_id: 'chatgpt-kifer', redirect_uri: redirectUri,
  state: 'synthetic-state', code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256',
  scope: 'kifer.read kifer.write', resource: endpoint,
});
const authorize = (redirectUri: string, overrides: Record<string, string> = {}) => handleOAuthRoute(new Request(
  `${endpoint}/oauth/authorize?${new URLSearchParams({ ...authorizationParams(redirectUri), ...overrides })}`,
));
const complete = (redirectUri: string, bearer = 'synthetic-session') => handleOAuthRoute(new Request(`${endpoint}/oauth/authorize/complete`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
  body: JSON.stringify(authorizationParams(redirectUri)),
}));

beforeEach(() => {
  config = { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'example-server-key',
    KIFER_MCP_OAUTH_CLIENT_ID: 'chatgpt-kifer', KIFER_MCP_OAUTH_REDIRECT_URI: chatgptCallback,
    KIFER_MCP_OAUTH_UI_URL: 'https://crm.test/mcp-oauth-authorize.html' };
  vi.stubGlobal('Deno', { env: { get: (name: string) => config[name] } });
  getUser.mockReset().mockResolvedValue({ data: { user: { id: 'synthetic-admin' } }, error: null });
  insert.mockReset().mockResolvedValue({ error: null });
  rpc.mockReset().mockResolvedValue({ data: { success: true, scope: 'kifer.read kifer.write offline_access', expires_in: 3600 }, error: null });
  createClient.mockReset().mockReturnValue({ auth: { getUser }, rpc, from: (table: string) => {
    if (table === 'chatgpt_mcp_oauth_authorization_codes') return { insert };
    if (table === 'user_profiles') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { email: 'admin@test.invalid', role: 'admin' }, error: null }) }) }) };
    throw new Error(`Unexpected table: ${table}`);
  } });
});
afterAll(() => vi.unstubAllGlobals());

describe('ChatGPT and Claude OAuth compatibility', () => {
  it('discovers a reachable authorization server at the public CRM origin', async () => {
    const resource = await (await handleOAuthRoute(new Request(`${endpoint}/.well-known/oauth-protected-resource`)))!.json();
    expect(resource).toMatchObject({ resource: endpoint, authorization_servers: ['https://crm.test'] });
    const routing = JSON.parse(readFileSync(new URL('../../../../vercel.json', import.meta.url), 'utf8')) as {
      rewrites: Array<{ source: string; destination: string }>;
    };
    const rewrite = routing.rewrites.find(({ source }) => source === '/.well-known/oauth-authorization-server');
    expect(rewrite?.destination).toBe('https://eaxvvhamkmovkoqssahj.supabase.co/functions/v1/chatgpt-mcp/.well-known/oauth-authorization-server');
    // A public-origin proxy must keep the MCP resource and endpoints bound to Supabase.
    const discovery = await (await handleOAuthRoute(new Request(`${endpoint}/.well-known/oauth-authorization-server`, {
      headers: { 'x-forwarded-host': 'crm.test' },
    })))!.json();
    expect(discovery).toMatchObject({ issuer: resource.authorization_servers[0],
      authorization_endpoint: `${endpoint}/oauth/authorize`, token_endpoint: `${endpoint}/oauth/token`,
      token_endpoint_auth_methods_supported: ['none'], code_challenge_methods_supported: ['S256'] });
    const url = new URL(discovery.authorization_endpoint);
    url.search = new URLSearchParams(authorizationParams(claudeCallback)).toString();
    expect((await handleOAuthRoute(new Request(url)))?.status).toBe(303);
  });

  it.each([chatgptCallback, claudeCallback])('preserves consent, callback, state and token exchange for %s', async (redirectUri) => {
    const response = await authorize(redirectUri);
    expect(response?.status).toBe(303);
    const consent = new URL(response!.headers.get('location')!);
    expect(consent.origin).toBe('https://crm.test');
    expect(consent.searchParams.get('redirect_uri')).toBe(redirectUri);
    expect(consent.searchParams.get('scope')).toBe('kifer.read kifer.write offline_access');
    const approved = await complete(redirectUri);
    expect(approved?.status).toBe(200);
    const callback = new URL((await approved!.json()).redirect_to);
    expect(`${callback.origin}${callback.pathname}`).toBe(redirectUri);
    expect(callback.searchParams.get('state')).toBe('synthetic-state');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ client_id: 'chatgpt-kifer', redirect_uri: redirectUri, resource: endpoint }));
    const exchanged = await handleOAuthRoute(new Request(`${endpoint}/oauth/token`, { method: 'POST', body: new URLSearchParams({
      grant_type: 'authorization_code', client_id: 'chatgpt-kifer', code: callback.searchParams.get('code')!,
      code_verifier: verifier, redirect_uri: redirectUri, resource: endpoint,
    }) }));
    expect(exchanged?.status).toBe(200);
    expect(await exchanged!.json()).toMatchObject({ access_token: expect.any(String), refresh_token: expect.any(String) });
    expect(rpc).toHaveBeenCalledWith('mcp_exchange_oauth_tokens', expect.objectContaining({ p_redirect_uri: redirectUri, p_client_id: 'chatgpt-kifer', p_resource: endpoint }));
  });

  it.each([
    'https://claude.ai.evil.test/api/mcp/auth_callback', 'http://claude.ai/api/mcp/auth_callback',
    `${claudeCallback}/`, `${claudeCallback}?next=https://evil.test`, 'https://claude.ai/other',
  ])('rejects callbacks that do not exactly match the allowlist: %s', async (redirectUri) => {
    expect((await authorize(redirectUri))?.status).toBe(400);
    expect((await complete(redirectUri))?.status).toBe(400);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('keeps PKCE, client, target, scope and session checks for Claude', async () => {
    for (const overrides of [{ client_id: 'unknown' }, { code_challenge_method: 'plain' }, { code_challenge: 'short' },
      { state: '' }, { scope: 'unknown' }, { resource: 'https://other.test' }]) {
      expect((await authorize(claudeCallback, overrides))?.status).toBe(400);
    }
    expect((await complete(claudeCallback, ''))?.status).toBe(401);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('keeps the existing switch that disables new authorizations when no callback is configured', async () => {
    delete config.KIFER_MCP_OAUTH_REDIRECT_URI;
    expect((await authorize(chatgptCallback))?.status).toBe(400);
    expect((await authorize(claudeCallback))?.status).toBe(400);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('retains direct discovery when the public consent UI has not been configured', async () => {
    delete config.KIFER_MCP_OAUTH_UI_URL;
    const discovery = await (await handleOAuthRoute(new Request(`${endpoint}/.well-known/oauth-authorization-server`)))!.json();
    expect(discovery.issuer).toBe(endpoint);
  });

  it('keeps HTTPS canonical endpoints behind the Supabase gateway and public proxy', async () => {
    const discovery = await (await handleOAuthRoute(new Request('http://edge-runtime/chatgpt-mcp/.well-known/oauth-authorization-server', {
      headers: { 'x-forwarded-host': 'crm.test' },
    })))!.json();
    expect(discovery).toMatchObject({ issuer: 'https://crm.test', authorization_endpoint: `${endpoint}/oauth/authorize`, token_endpoint: `${endpoint}/oauth/token` });
  });
});
