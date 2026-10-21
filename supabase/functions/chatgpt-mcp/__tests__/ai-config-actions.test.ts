import { describe, expect, it, vi } from 'vitest';
import {
  executeMcpAiConfigReadAction,
  executeMcpAiConfigWriteAction,
  MCP_AI_CONFIG_READ_TOOL_NAMES,
  MCP_AI_CONFIG_TOOLS,
  MCP_AI_CONFIG_WRITE_TOOL_NAMES,
} from '../ai-config-actions';
import { executeMcpWriteAction } from '../write-actions';

const actor = { actor: 'chatgpt:admin@kifer.test', actorId: '7b09577d-49ec-4f00-a54a-56bf370e5179' };
const id = '0570b739-8af3-47fb-898e-9c4536b7ab36';

type Response = Record<string, unknown>;

function createSupabase(queues: Record<string, Response[]>, auditSpy = vi.fn(), rpcResponse: Response = { data: null, error: null }) {
  const from = vi.fn((table: string) => {
    const response = queues[table]?.shift() ?? { data: null, error: null, count: 0 };
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'neq', 'not', 'in', 'order', 'limit', 'range', 'update', 'delete', 'upsert', 'insert']) {
      chain[method] = (...args: unknown[]) => {
        if (table === 'mcp_action_audit_log' && method === 'insert') auditSpy(args[0]);
        return chain;
      };
    }
    chain.single = async () => response;
    chain.maybeSingle = async () => response;
    chain.then = (resolve: (value: Response) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(response).then(resolve, reject);
    return chain;
  });
  const rpc = vi.fn().mockResolvedValue(rpcResponse);
  return { supabase: { from, rpc } as never, from, rpc, auditSpy };
}

describe('MCP AI configuration capabilities', () => {
  it('registers closed read and write tools for the full admin AI configuration surface', () => {
    expect(MCP_AI_CONFIG_READ_TOOL_NAMES).toEqual([
      'kifer_list_ai_features',
      'kifer_get_ai_feature_history',
      'kifer_list_ai_global_configs',
      'kifer_list_ai_model_catalog',
      'kifer_get_ai_routing_settings',
      'kifer_get_ai_provider_status',
      'kifer_export_ai_configuration',
    ]);
    expect(MCP_AI_CONFIG_WRITE_TOOL_NAMES).toContain('kifer_import_ai_configuration');
    expect(MCP_AI_CONFIG_WRITE_TOOL_NAMES).toContain('kifer_update_ai_routing_settings');
    expect(MCP_AI_CONFIG_WRITE_TOOL_NAMES).toContain('kifer_set_ai_provider_enabled');
    expect(MCP_AI_CONFIG_TOOLS.every((tool) => tool.inputSchema?.additionalProperties === false)).toBe(true);
  });

  it('routes AI writes through the MCP write dispatcher and rejects out of range prompts before database access', async () => {
    const { supabase, from } = createSupabase({});
    const result = await executeMcpWriteAction({
      supabase,
      toolName: 'kifer_save_ai_feature_config',
      arguments: { feature_id: id, expected_latest_version: 0, feature_prompt: ' ', output_instructions: '', temperature: 0.4, max_output_tokens: 500, model_override_enabled: false },
      actor,
    });

    expect(result).toMatchObject({ success: false, error_code: 'INVALID_INPUT' });
    expect(from).not.toHaveBeenCalled();
  });

  it('validates feature model capability before mutating configuration', async () => {
    const { supabase, from } = createSupabase({
      ai_features: [{ data: { id, key: 'audio.transcribe', task_type: 'transcription', enabled: true }, error: null }],
      ai_models: [{ data: { capabilities: ['text'], active: true, deprecated_at: null }, error: null }],
    });
    const result = await executeMcpAiConfigWriteAction({
      supabase,
      toolName: 'kifer_save_ai_feature_config',
      arguments: { feature_id: id, expected_latest_version: 0, feature_prompt: 'Transcreva.', output_instructions: '', temperature: 0.3, max_output_tokens: 500, model_override_enabled: true, provider: 'openai', model: 'gpt-4.1-mini', reasoning_effort: null },
      actor,
    });

    expect(result).toMatchObject({ success: false, error_code: 'INVALID_MODEL' });
    expect(from).toHaveBeenCalledTimes(2);
  });

  it('creates an audited version through the atomic actor-bound database operation', async () => {
    const prompt = 'Prompt comercial privado.';
    const audit = vi.fn();
    const { supabase, rpc } = createSupabase({
      ai_features: [{ data: { id, key: 'message.suggest', task_type: 'text', enabled: true }, error: null }],
    }, audit, { data: { config: { id: 'config-2', feature_id: id, version: 2, is_active: true } }, error: null });
    const result = await executeMcpAiConfigWriteAction({
      supabase,
      toolName: 'kifer_save_ai_feature_config',
      arguments: { feature_id: id, expected_latest_version: 1, feature_prompt: prompt, output_instructions: 'Retorne texto.', temperature: 0.4, max_output_tokens: 500, model_override_enabled: false, reasoning_effort: null },
      actor,
    });

    expect(result).toMatchObject({ success: true, config: { version: 2, is_active: true } });
    expect(rpc).toHaveBeenCalledWith('mcp_mutate_ai_configuration', {
      p_actor_user_id: actor.actorId,
      p_action: 'save_feature_config',
      p_payload: expect.objectContaining({ feature_id: id, expected_latest_version: 1, feature_prompt: prompt }),
    });
    expect(JSON.stringify(audit.mock.calls[0]?.[0])).not.toContain(prompt);
  });

  it('updates only allowlisted global prompts and keeps the text out of the audit log', async () => {
    const privatePrompt = 'Instrução que muda respostas comerciais da equipe.';
    const audit = vi.fn();
    const { supabase, rpc } = createSupabase({
      mcp_action_audit_log: [{ data: null, error: null }],
    }, audit, { data: { config: { id, key: 'global_instructions', value: privatePrompt, updated_by: actor.actorId, updated_at: '2026-10-21T10:00:00.000Z' } }, error: null });
    const result = await executeMcpAiConfigWriteAction({
      supabase,
      toolName: 'kifer_update_ai_global_config',
      arguments: { key: 'global_instructions', value: privatePrompt, expected_updated_at: '2026-10-20T10:00:00.000Z' },
      actor,
    });

    expect(result).toMatchObject({ success: true, config: { key: 'global_instructions' } });
    expect(rpc).toHaveBeenCalledWith('mcp_mutate_ai_configuration', {
      p_actor_user_id: actor.actorId,
      p_action: 'update_global_config',
      p_payload: { key: 'global_instructions', value: privatePrompt, expected_updated_at: '2026-10-20T10:00:00.000Z' },
    });
    expect(JSON.stringify(audit.mock.calls[0]?.[0])).not.toContain(privatePrompt);
    expect(audit.mock.calls[0]?.[0]).toMatchObject({ request_payload: { key: 'global_instructions', value_length: privatePrompt.length } });
  });

  it('excludes the retired sandbox feature from administrative reads', async () => {
    const { supabase, from } = createSupabase({
      ai_features: [{ data: [{ id, key: 'autonomous.reply', name: 'Atendimento', enabled: true }], error: null }],
      ai_feature_configs: [{ data: [{ id: 'config-1', feature_id: id, version: 3, is_active: true }], error: null }],
    });
    const result = await executeMcpAiConfigReadAction({ supabase, toolName: 'kifer_list_ai_features', arguments: {} });

    expect(result).toMatchObject({ success: true, features: [{ key: 'autonomous.reply', active_config: { version: 3 }, config_count: 1 }] });
    expect(from).toHaveBeenCalledWith('ai_features');
  });

  it('projects only allowlisted model routes from integration settings', async () => {
    const { supabase } = createSupabase({
      integration_settings: [{ data: { updated_at: '2026-10-20T10:00:00.000Z', settings: { api_key: 'secret-value', tasks: { follow_up_generation: { provider: 'openai', model: 'gpt-5.5' }, ignored_internal: { token: 'another-secret' } } } }, error: null }],
    });
    const result = await executeMcpAiConfigReadAction({ supabase, toolName: 'kifer_get_ai_routing_settings', arguments: {} });

    expect(result).toEqual({ success: true, updated_at: '2026-10-20T10:00:00.000Z', tasks: { follow_up_generation: { provider: 'openai', model: 'gpt-5.5' } } });
    expect(JSON.stringify(result)).not.toContain('secret-value');
    expect(JSON.stringify(result)).not.toContain('ignored_internal');
  });
});
