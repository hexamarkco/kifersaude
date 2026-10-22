// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { authenticate, createClient } = vi.hoisted(() => ({ authenticate: vi.fn(), createClient: vi.fn() }));
vi.mock('npm:@supabase/supabase-js@2.57.4', () => ({ createClient }));
vi.mock('../oauth.ts', async () => {
  const { buildMcpOAuthChallenge } = await import('../oauth-tool-access');
  return {
    authenticateOAuthAccessToken: authenticate,
    handleOAuthRoute: async () => null,
    getMcpOAuthChallenge: (_request: Request, scopes?: readonly string[], insufficient = false) => buildMcpOAuthChallenge('https://project.supabase.co/functions/v1/chatgpt-mcp', scopes, insufficient),
  };
});

let handler: (request: Request) => Promise<Response>;
const request = (method: string, params?: unknown) => handler(new Request('https://project.supabase.co/functions/v1/chatgpt-mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer synthetic-test' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }));

beforeAll(async () => {
  vi.stubGlobal('Deno', { env: { get: () => '' }, serve: (callback: typeof handler) => { handler = callback; } });
  await import('../index');
});
beforeEach(() => {
  createClient.mockClear();
  authenticate.mockResolvedValue({ actor: 'chatgpt:synthetic', userId: '11111111-1111-4111-8111-111111111111', scope: 'kifer.read' });
});
afterAll(() => { vi.unstubAllGlobals(); });

describe('deployed MCP request flow', () => {
  it('lists the complete action catalog for an existing read-only OAuth session', async () => {
    const response = await (await request('tools/list')).json();
    const tools = response.result.tools as Array<{ name: string; securitySchemes: Array<{ scopes: string[] }> }>;
    expect(tools.find((tool) => tool.name === 'kifer_update_reminder')?.securitySchemes[0].scopes).toEqual(['kifer.read', 'kifer.write']);
    expect(tools.map((tool) => tool.name)).toEqual(expect.arrayContaining(['kifer_reschedule_reminders', 'kifer_reopen_reminder', 'kifer_delete_reminders', 'kifer_get_connection_access']));
    expect(new Set(tools.map((tool) => tool.name)).size).toBe(tools.length);
    expect(createClient).not.toHaveBeenCalled();
  });
  it('responds with an OAuth linking challenge before any database work on a write with missing scope', async () => {
    const response = await (await request('tools/call', { name: 'kifer_update_reminder', arguments: { reminder_id: '22222222-2222-4222-8222-222222222222', changes: { data_lembrete: '2030-10-22T12:00:00Z' } } })).json();
    expect(response.result.isError).toBe(true);
    expect(response.result._meta['mcp/www_authenticate'][0]).toContain('error="insufficient_scope"');
    expect(response.result._meta['mcp/www_authenticate'][0]).toContain('scope="kifer.read kifer.write offline_access"');
    expect(createClient).not.toHaveBeenCalled();
  });
  it('reports the real connection scope and recognizes a fully authorized administrator', async () => {
    const read = await (await request('tools/call', { name: 'kifer_get_connection_access' })).json();
    expect(JSON.parse(read.result.content[0].text)).toMatchObject({ can_write: false, granted_scopes: ['kifer.read'] });
    authenticate.mockResolvedValue({ actor: 'chatgpt:synthetic', userId: '11111111-1111-4111-8111-111111111111', scope: 'kifer.read kifer.write' });
    const write = await (await request('tools/call', { name: 'kifer_get_connection_access' })).json();
    expect(JSON.parse(write.result.content[0].text)).toMatchObject({ can_write: true });
    expect(createClient).not.toHaveBeenCalled();
  });
});
