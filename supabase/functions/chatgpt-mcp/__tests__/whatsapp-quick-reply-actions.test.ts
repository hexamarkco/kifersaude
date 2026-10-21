import { describe, expect, it, vi } from 'vitest';
import {
  executeMcpWhatsAppQuickReplyReadAction,
  executeMcpWhatsAppQuickReplyWriteAction,
} from '../whatsapp-quick-reply-actions';

const actor = { actor: 'chatgpt:admin@kifer.test', actorId: '7b09577d-49ec-4f00-a54a-56bf370e5179' };
const updatedAt = '2026-10-21T12:00:00.000Z';

describe('MCP WhatsApp quick replies', () => {
  it('reads the settings consumed by the Inbox', async () => {
    const auditInsert = vi.fn().mockResolvedValue({ error: null });
    const query: Record<string, unknown> = {};
    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.maybeSingle = vi.fn(async () => ({ data: { settings: { quickReplies: [{ id: 'reply-1', name: 'Saudação', shortcut: 'oi', text: 'Olá!', extra: 'hidden' }] }, updated_at: updatedAt }, error: null }));
    const from = vi.fn((table: string) => table === 'integration_settings' ? query : { insert: auditInsert });

    const result = await executeMcpWhatsAppQuickReplyReadAction({
      supabase: { from } as never,
      toolName: 'kifer_get_whatsapp_quick_replies',
      actor,
    });

    expect(result).toMatchObject({ success: true, quick_replies: [{ id: 'reply-1', name: 'Saudação', shortcut: 'oi', text: 'Olá!' }], updated_at: updatedAt });
    expect(JSON.stringify(result)).not.toContain('extra');
    expect(auditInsert.mock.calls[0]?.[0]).toMatchObject({ request_summary: { slug: 'whatsapp_quick_replies', quick_reply_count: 1 } });
  });

  it('uses optimistic concurrency and keeps message text out of audit records', async () => {
    const auditInsert = vi.fn().mockResolvedValue({ error: null });
    const readQuery: Record<string, unknown> = {};
    readQuery.select = vi.fn(() => readQuery);
    readQuery.eq = vi.fn(() => readQuery);
    readQuery.maybeSingle = vi.fn(async () => ({ data: { id: 'integration-1', settings: { keep: true, quickReplies: [] }, updated_at: updatedAt }, error: null }));
    const updateQuery: Record<string, unknown> = {};
    updateQuery.update = vi.fn(() => updateQuery);
    updateQuery.eq = vi.fn(() => updateQuery);
    updateQuery.select = vi.fn(() => updateQuery);
    updateQuery.maybeSingle = vi.fn(async () => ({ data: { id: 'integration-1', updated_at: '2026-10-21T12:01:00.000Z' }, error: null }));
    const from = vi.fn((table: string) => {
      if (table === 'mcp_action_audit_log') return { insert: auditInsert };
      return { ...readQuery, update: updateQuery.update, eq: vi.fn(() => readQuery), select: readQuery.select, maybeSingle: readQuery.maybeSingle };
    });
    let integrationCalls = 0;
    from.mockImplementation((table: string) => {
      if (table === 'mcp_action_audit_log') return { insert: auditInsert } as never;
      integrationCalls += 1;
      if (integrationCalls === 1) return readQuery as never;
      return updateQuery as never;
    });
    const sensitiveText = 'Informação confidencial da cliente';

    const result = await executeMcpWhatsAppQuickReplyWriteAction({
      supabase: { from } as never,
      toolName: 'kifer_update_whatsapp_quick_replies',
      arguments: { expected_updated_at: updatedAt, quick_replies: [{ name: 'Retorno', shortcut: 'retorno', text: sensitiveText }] },
      actor,
    });

    expect(result).toMatchObject({ success: true, quick_replies: [{ name: 'Retorno', shortcut: 'retorno', text: sensitiveText }] });
    expect(JSON.stringify(auditInsert.mock.calls[0]?.[0])).not.toContain(sensitiveText);
    expect(auditInsert.mock.calls[0]?.[0]).toMatchObject({ request_payload: { quick_reply_count: 1, quick_reply_ids: ['quick-reply-retorno-1'] } });
    expect(updateQuery.eq).toHaveBeenCalledWith('updated_at', updatedAt);
  });

  it('rejects a stale version before writing', async () => {
    const query: Record<string, unknown> = {};
    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.maybeSingle = vi.fn(async () => ({ data: { id: 'integration-1', settings: { quickReplies: [] }, updated_at: '2026-10-21T12:02:00.000Z' }, error: null }));
    const update = vi.fn();
    const result = await executeMcpWhatsAppQuickReplyWriteAction({
      supabase: { from: vi.fn(() => ({ ...query, update })) } as never,
      toolName: 'kifer_update_whatsapp_quick_replies',
      arguments: { expected_updated_at: updatedAt, quick_replies: [] },
      actor,
    });

    expect(result).toMatchObject({ success: false, error_code: 'CONFLICT' });
    expect(update).not.toHaveBeenCalled();
  });
});
