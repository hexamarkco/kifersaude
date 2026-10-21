import { describe, expect, it, vi } from 'vitest';
import {
  executeMcpWhatsAppMessageWriteAction,
  MCP_WHATSAPP_MESSAGE_TOOLS,
} from '../whatsapp-message-actions';

const actorId = '7b09577d-49ec-4f00-a54a-56bf370e5179';
const messageId = '637929ed-e9c5-46f1-ae45-28b26e53ab85';

describe('MCP WhatsApp message actions', () => {
  it('declares closed, confirmed write tools for message operations', () => {
    expect(MCP_WHATSAPP_MESSAGE_TOOLS).toHaveLength(7);
    for (const tool of MCP_WHATSAPP_MESSAGE_TOOLS) {
      expect(tool.annotations?.readOnlyHint).toBe(false);
      const schema = tool.inputSchema as { additionalProperties: boolean; required: string[]; properties: Record<string, unknown> };
      expect(schema.additionalProperties).toBe(false);
      expect(schema.required.some((name) => name.startsWith('confirm_'))).toBe(true);
    }
    const retrySchema = MCP_WHATSAPP_MESSAGE_TOOLS.find(({ name }) => name === 'kifer_retry_whatsapp_media')?.inputSchema as { properties: Record<string, unknown> };
    expect(retrySchema.properties).not.toHaveProperty('content_base64');
  });

  it('requires confirmation before invoking an edit and audits only message length', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const invoke = vi.fn();
    const result = await executeMcpWhatsAppMessageWriteAction({
      supabase: { from: vi.fn(() => ({ insert })), functions: { invoke } } as never,
      actor: { actor: 'chatgpt:admin@kifer.test', actorId },
      toolName: 'kifer_edit_whatsapp_message',
      arguments: { message_id: messageId, text: 'Contacte urgente sobre CPF 123.456.789-00' },
    });

    expect(result).toMatchObject({ success: false, error_code: 'CONFIRMATION_REQUIRED' });
    expect(invoke).not.toHaveBeenCalled();
    expect(JSON.stringify(insert.mock.calls[0]?.[0])).not.toContain('123.456.789-00');
    expect(insert.mock.calls[0]?.[0]).toMatchObject({ request_payload: { message_id: messageId, text_length: 41 } });
  });

  it('resolves reaction messages internally and adds the verified actor header', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const invoke = vi.fn().mockResolvedValue({ data: { success: true }, error: null });
    const query: Record<string, unknown> = {};
    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.maybeSingle = vi.fn(async () => ({ data: { external_message_id: 'whapi-message-id' }, error: null }));
    const from = vi.fn((table: string) => table === 'mcp_action_audit_log' ? { insert } : query);
    const result = await executeMcpWhatsAppMessageWriteAction({
      supabase: { from, functions: { invoke } } as never,
      actor: { actor: 'chatgpt:admin@kifer.test', actorId },
      toolName: 'kifer_set_whatsapp_message_reaction',
      arguments: { message_id: messageId, emoji: '👍', confirm_reaction: true },
    });

    expect(result).toMatchObject({ success: true, message_id: messageId, reaction_set: true });
    expect(invoke).toHaveBeenCalledWith('comm-whatsapp-react', {
      body: { messageId: 'whapi-message-id', emoji: '👍' },
      headers: { 'X-Kifer-MCP-Actor-Id': actorId },
    });
  });

  it('namespaces retry idempotency keys by the authenticated MCP actor', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const invoke = vi.fn().mockResolvedValue({ data: { success: true, messageId: 'retry-result', status: 'sent' }, error: null });
    const result = await executeMcpWhatsAppMessageWriteAction({
      supabase: { from: vi.fn(() => ({ insert })), functions: { invoke } } as never,
      actor: { actor: 'chatgpt:admin@kifer.test', actorId },
      toolName: 'kifer_retry_whatsapp_media',
      arguments: { message_id: messageId, client_request_id: 'retry-001', confirm_resend: true },
    });

    expect(result).toMatchObject({ success: true, message_id: 'retry-result', status: 'sent' });
    expect(invoke).toHaveBeenCalledWith('comm-whatsapp-retry-message', {
      body: { messageId, clientRequestId: `mcp:${actorId}:retry-001` },
      headers: { 'X-Kifer-MCP-Actor-Id': actorId },
    });
  });
});
