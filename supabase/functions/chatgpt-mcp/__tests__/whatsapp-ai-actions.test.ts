import { describe, expect, it, vi } from 'vitest';
import {
  executeMcpWhatsAppAiReadAction,
  executeMcpWhatsAppAiWriteAction,
  MCP_WHATSAPP_AI_TOOLS,
} from '../whatsapp-ai-actions';

const actorId = '7b09577d-49ec-4f00-a54a-56bf370e5179';
const chatId = '637929ed-e9c5-46f1-ae45-28b26e53ab85';

describe('MCP WhatsApp AI operations', () => {
  it('publishes generation operations as confirmed writes', () => {
    const writeTools = MCP_WHATSAPP_AI_TOOLS.filter(({ name }) => name !== 'kifer_list_whatsapp_attendance_critiques');
    expect(writeTools).toHaveLength(5);
    for (const tool of writeTools) {
      const schema = tool.inputSchema as { additionalProperties: boolean; required: string[] };
      expect(tool.annotations?.readOnlyHint).toBe(false);
      expect(schema.additionalProperties).toBe(false);
      expect(schema.required).toContain('confirm_ai_generation');
    }
  });

  it('requires explicit confirmation and never audits the actual draft text', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const invoke = vi.fn();
    const result = await executeMcpWhatsAppAiWriteAction({
      supabase: { from: vi.fn(() => ({ insert })), functions: { invoke } } as never,
      actor: { actor: 'chatgpt:admin@kifer.test', actorId },
      toolName: 'kifer_suggest_whatsapp_reply',
      arguments: { chat_id: chatId, composer_draft: 'Meu texto com informação sensível' },
    });

    expect(result).toMatchObject({ success: false, error_code: 'CONFIRMATION_REQUIRED' });
    expect(invoke).not.toHaveBeenCalled();
    expect(JSON.stringify(insert.mock.calls[0]?.[0])).not.toContain('informação sensível');
    expect(insert.mock.calls[0]?.[0]).toMatchObject({ request_payload: {} });
  });

  it('calls the existing suggestion function with the verified actor and returns a draft only', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const invoke = vi.fn().mockResolvedValue({ data: { text: 'Sugestão de resposta', mode: 'suggest_reply', provider: 'openai', model: 'gpt-test' }, error: null });
    const draft = 'Minha conversa particular';
    const result = await executeMcpWhatsAppAiWriteAction({
      supabase: { from: vi.fn(() => ({ insert })), functions: { invoke } } as never,
      actor: { actor: 'chatgpt:admin@kifer.test', actorId },
      toolName: 'kifer_suggest_whatsapp_reply',
      arguments: { chat_id: chatId, composer_draft: draft, confirm_ai_generation: true },
    });

    expect(result).toMatchObject({ success: true, chat_id: chatId, text: 'Sugestão de resposta', mode: 'suggest_reply' });
    expect(invoke).toHaveBeenCalledWith('comm-whatsapp-suggest-reply', {
      body: { chatId, composerDraft: draft, mode: 'complete_draft' },
      headers: { 'X-Kifer-MCP-Actor-Id': actorId },
    });
    expect(JSON.stringify(insert.mock.calls[0]?.[0])).not.toContain(draft);
    expect(insert.mock.calls[0]?.[0]).toMatchObject({ request_payload: { chat_id: chatId, mode: 'complete_draft', draft_length: draft.length } });
  });

  it('projects only the supported fields from stored critique records', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const query: Record<string, unknown> = {};
    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.order = vi.fn(() => query);
    query.limit = vi.fn(async () => ({ data: [{ id: 'critique-1', chat_id: chatId, generated_at: '2026-10-21T12:00:00Z', provider: 'openai', model: 'gpt-test', message_count: 3, critique: { resumo: 'Resumo', avaliacao_geral: 'bom', pontos_fortes: ['Clara'], credential: 'hidden' } }], error: null }));
    const from = vi.fn((table: string) => table === 'chatgpt_mcp_audit_log' ? { insert } : query);
    const result = await executeMcpWhatsAppAiReadAction({
      supabase: { from } as never,
      actor: { actor: 'chatgpt:admin@kifer.test', actorId },
      toolName: 'kifer_list_whatsapp_attendance_critiques',
      arguments: { chat_id: chatId },
    });

    expect(result).toMatchObject({ success: true, critiques: [{ critique: { resumo: 'Resumo', pontos_fortes: ['Clara'] } }] });
    expect(JSON.stringify(result)).not.toContain('credential');
  });
});
