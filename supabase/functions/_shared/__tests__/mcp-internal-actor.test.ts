import { describe, expect, it, vi } from 'vitest';
import { resolveMcpServiceActor } from '../mcp-internal-actor';

const actorId = '7b09577d-49ec-4f00-a54a-56bf370e5179';
const serviceKey = 'service-role-secret-for-test';

const makeSupabase = (role: string, email = role === 'admin' ? 'admin@kifer.test' : 'user@kifer.test') => {
  const query: Record<string, unknown> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => ({ data: { role, email }, error: null }));
  return { from: vi.fn(() => query) } as never;
};

describe('MCP internal service actor', () => {
  it('requires a service-role transport and an exact active MCP admin role', async () => {
    const req = new Request('https://example.test/function', { headers: { Authorization: `Bearer ${serviceKey}`, 'X-Kifer-MCP-Actor-Id': actorId } });
    expect(await resolveMcpServiceActor(req, makeSupabase('admin'), serviceKey)).toMatchObject({ isServiceRole: true, actorId, authorized: true });
    expect(await resolveMcpServiceActor(req, makeSupabase('manager'), serviceKey)).toMatchObject({ isServiceRole: true, actorId, authorized: false });
    expect(await resolveMcpServiceActor(req, makeSupabase('admin', ' '), serviceKey)).toMatchObject({ isServiceRole: true, actorId, authorized: false });
    expect(await resolveMcpServiceActor(new Request('https://example.test/function', { headers: { 'X-Kifer-MCP-Actor-Id': actorId } }), makeSupabase('admin'), serviceKey)).toMatchObject({ isServiceRole: false, actorId: null, authorized: false });
  });
});
