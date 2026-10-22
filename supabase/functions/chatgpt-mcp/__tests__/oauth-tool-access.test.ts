import { describe, expect, it } from 'vitest';
import { attachMcpOAuthSecuritySchemes } from '../mcp-discovery';
import { buildMcpOAuthChallenge, getMcpConnectionAccess, getMcpDiscoverableTools, getMcpToolScopeError } from '../oauth-tool-access';

const resource = 'https://project.supabase.co/functions/v1/chatgpt-mcp';
const tools = attachMcpOAuthSecuritySchemes([
  { name: 'kifer_list_reminders', annotations: { readOnlyHint: true } },
  { name: 'kifer_update_reminder', annotations: { readOnlyHint: false } },
]);

describe('OAuth discovery and incremental authorization', () => {
  it('keeps writes discoverable for an existing read-only connection', () => {
    const discovered = getMcpDiscoverableTools(tools);
    expect(discovered.map((tool) => tool.name)).toContain('kifer_update_reminder');
    expect(discovered[1].securitySchemes?.[0].scopes).toEqual(['kifer.read', 'kifer.write']);
    expect(getMcpConnectionAccess(new Set(['kifer.read']), discovered, true)).toMatchObject({ can_write: false, tools: { total: 2, read: 1, write: 1 } });
  });

  it('requests write authorization through the MCP metadata instead of hiding the action or executing it', () => {
    const challenge = buildMcpOAuthChallenge(resource, ['kifer.read', 'kifer.write'], true);
    const error = getMcpToolScopeError(tools[1], new Set(['kifer.read']), challenge);
    expect(error).toMatchObject({ isError: true, _meta: { 'mcp/www_authenticate': [challenge] } });
    expect(JSON.parse(error!.content[0].text)).toMatchObject({ success: false, error_code: 'INSUFFICIENT_SCOPE', reconnect_required: true });
    expect(challenge).toContain('scope="kifer.read kifer.write offline_access"');
    expect(challenge).toContain('error="insufficient_scope"');
    expect(challenge).toContain('error_description="Authorize read and write access to Kifer Saude"');
    expect(getMcpToolScopeError(tools[0], new Set(['kifer.read']), challenge)).toBeNull();
    expect(getMcpToolScopeError(tools[1], new Set(['kifer.read', 'kifer.write']), challenge)).toBeNull();
  });

  it('asks for full CRM scopes on initial linking and never treats legacy or read-only authorization as a write grant', () => {
    expect(buildMcpOAuthChallenge(resource)).toContain('scope="kifer.read kifer.write offline_access"');
    expect(getMcpConnectionAccess(new Set(['kifer.read', 'kifer.write']), tools, false).can_write).toBe(false);
    expect(getMcpConnectionAccess(new Set(['kifer.read', 'kifer.write']), tools, true).can_write).toBe(true);
  });

  it('requests renewal once without requiring offline_access to execute existing tools', () => {
    expect(buildMcpOAuthChallenge(resource, ['kifer.read', 'offline_access'])).toContain('scope="kifer.read offline_access"');
    expect(getMcpToolScopeError(tools[1], new Set(['kifer.read', 'kifer.write']), buildMcpOAuthChallenge(resource))).toBeNull();
  });
});
