import { describe, expect, it } from 'vitest';
import { attachMcpOAuthSecuritySchemes, getMcpPrompt, MCP_PROMPTS, MCP_RESOURCES, readMcpResource, type McpToolDescriptor } from '../mcp-discovery';

const tools: readonly McpToolDescriptor[] = [
  { name: 'kifer_get_operational_overview', annotations: { readOnlyHint: true } },
  { name: 'kifer_get_lead_360', annotations: { readOnlyHint: true } },
  { name: 'kifer_update_lead_status', annotations: { readOnlyHint: false } },
  { name: 'kifer_send_whatsapp_message', annotations: { readOnlyHint: false } },
];

describe('MCP discovery primitives', () => {
  it('declares the OAuth requirement on every exposed tool', () => {
    expect(attachMcpOAuthSecuritySchemes(tools).map(({ securitySchemes }) => securitySchemes)).toEqual(
      tools.map(() => [{ type: 'oauth2', scopes: ['kifer.read'] }]),
    );
  });

  it('publishes deterministic safe resources and prompts', () => {
    expect(MCP_RESOURCES.map(({ uri }) => uri)).toEqual([
      'kifer://capabilities/catalog',
      'kifer://guides/agent-safety',
      'kifer://guides/composable-workflows',
    ]);
    expect(MCP_PROMPTS.map(({ name }) => name)).toEqual([
      'kifer_operational_triage',
      'kifer_lead_context_brief',
      'kifer_safe_action_plan',
      'kifer_followup_review',
    ]);
  });

  it('derives the capability catalog from the public tool registry without data access', () => {
    const result = readMcpResource('kifer://capabilities/catalog', tools);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const catalog = JSON.parse(result.contents[0].text) as {
      protocol: { modes: string[]; tools: { total: number; read_only: number; write: number } };
      domains: Array<{ key: string; tool_names: string[] }>;
      interaction_contract: Record<string, boolean>;
    };
    expect(catalog.protocol.modes).toEqual(['tools', 'resources', 'prompts']);
    expect(catalog.protocol.tools).toEqual({ total: 4, read_only: 2, write: 2 });
    expect(catalog.domains.find(({ key }) => key === 'commercial')?.tool_names).toContain('kifer_get_lead_360');
    expect(catalog.domains.find(({ key }) => key === 'communication')?.tool_names).toContain('kifer_send_whatsapp_message');
    expect(catalog.interaction_contract.generic_sql_and_rpc_are_not_exposed).toBe(true);
    expect(result.contents[0].text).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|access_token|refresh_token|secret/i);
  });

  it('returns only static guidance resources and rejects unknown URIs', () => {
    const guide = readMcpResource('kifer://guides/agent-safety', tools);
    expect(guide.ok).toBe(true);
    if (guide.ok) expect(guide.contents[0].text).toContain('intenção explícita');

    expect(readMcpResource('kifer://leads/00000000-0000-4000-8000-000000000001', tools)).toEqual({
      ok: false,
      code: 'NOT_FOUND',
      message: 'Recurso MCP não encontrado.',
    });
  });

  it('builds prompts that preserve the read-then-confirm safety boundary', () => {
    const result = getMcpPrompt('kifer_safe_action_plan', { objective: 'revisar o retorno de um lead' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.prompt.messages[0].content.text).toContain('Só execute ferramentas de escrita');
      expect(result.prompt.messages[0].content.text).toContain('revisar o retorno de um lead');
    }

    expect(getMcpPrompt('kifer_lead_context_brief', {})).toMatchObject({ ok: false, code: 'INVALID_ARGUMENTS' });
    expect(getMcpPrompt('unknown_prompt', {})).toEqual({ ok: false, code: 'NOT_FOUND', message: 'Prompt MCP não encontrado.' });
  });
});
