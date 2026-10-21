import { describe, expect, it, vi } from 'vitest';
import { executeMcpAiSandboxWriteAction, MCP_AI_SANDBOX_TOOLS } from '../ai-sandbox-actions';

const actorId = '7b09577d-49ec-4f00-a54a-56bf370e5179';

describe('MCP AI sandbox capabilities', () => {
  it('caps scenario runs at eight turns and requires explicit generation consent', async () => {
    const insertAudit = vi.fn().mockResolvedValue({ error: null });
    const invoke = vi.fn();
    const supabase = {
      from: vi.fn(() => ({ insert: insertAudit })),
      functions: { invoke },
    } as never;
    const result = await executeMcpAiSandboxWriteAction({
      supabase,
      actor: { actor: 'chatgpt:admin@kifer.test', actorId },
      toolName: 'kifer_run_ai_sandbox_scenario',
      arguments: { scenario_key: 'smoke', scenario_label: 'Smoke', lead_persona_prompt: 'Lead persona', max_turns: 9, confirm_ai_generation: true },
    });

    expect(result).toMatchObject({ success: false, error_code: 'INVALID_INPUT' });
    expect(invoke).not.toHaveBeenCalled();
    const scenarioTool = MCP_AI_SANDBOX_TOOLS.find((tool) => tool.name === 'kifer_run_ai_sandbox_scenario');
    expect((scenarioTool?.inputSchema as { properties: { max_turns: { maximum: number } } }).properties.max_turns.maximum).toBe(8);
  });

  it('does not copy persona prompts into the audit record when a run is requested', async () => {
    const persona = 'Cliente simulado com situação pessoal para o teste.';
    const auditInsert = vi.fn().mockResolvedValue({ error: null });
    const invoke = vi.fn().mockResolvedValue({ data: { conversationId: 'a3b686ce-7e3c-4b5a-8a9d-fd830a96b8b1', passed: true, turns: 2 }, error: null });
    const supabase = {
      from: vi.fn(() => ({ insert: auditInsert })),
      functions: { invoke },
    } as never;
    const result = await executeMcpAiSandboxWriteAction({
      supabase,
      actor: { actor: 'chatgpt:admin@kifer.test', actorId },
      toolName: 'kifer_run_ai_sandbox_scenario',
      arguments: { scenario_key: 'smoke', scenario_label: 'Smoke', lead_persona_prompt: persona, max_turns: 2, confirm_ai_generation: true },
    });

    expect(result).toMatchObject({ success: true, passed: true, turns: 2 });
    expect(invoke.mock.calls[0]?.[0]).toBe('ai-sandbox-run-scenario');
    expect(invoke.mock.calls[0]?.[1]).toMatchObject({ headers: { 'X-Kifer-MCP-Actor-Id': actorId } });
    expect(JSON.stringify(auditInsert.mock.calls[0]?.[0])).not.toContain(persona);
  });
});
