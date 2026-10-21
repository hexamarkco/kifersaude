import { describe, expect, it, vi } from 'vitest';
import {
  executeMcpWhatsAppAdminReadAction,
  executeMcpWhatsAppAdminWriteAction,
} from '../whatsapp-admin-actions';

const actorId = '7b09577d-49ec-4f00-a54a-56bf370e5179';

describe('MCP WhatsApp integration administration', () => {
  it('projects connection status without returning webhook URLs or credentials', async () => {
    const auditInsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((table: string) => {
      if (table === 'chatgpt_mcp_audit_log') return { insert: auditInsert };
      const query: Record<string, unknown> = {};
      query.select = vi.fn(() => query);
      query.eq = vi.fn(() => query);
      query.maybeSingle = vi.fn(async () => ({ data: { updated_at: '2026-10-21T12:00:00Z' }, error: null }));
      return query;
    });
    const invoke = vi.fn().mockResolvedValue({
      data: {
        channel: { enabled: true, connection_status: 'connected', health_status: 'ok', phone_number: '+5521999999999', updated_at: '2026-10-21T12:00:00Z' },
        config: {
          enabled: true,
          tokenConfigured: true,
          webhookUrl: 'https://example.test/webhook?secret=hidden',
          webhookDiagnostics: { status: 'receiving_messages', lastWebhookAt: '2026-10-21T11:00:00Z' },
        },
      },
      error: null,
    });
    const result = await executeMcpWhatsAppAdminReadAction({
      supabase: { from, functions: { invoke } } as never,
      actor: { actor: 'chatgpt:admin@kifer.test', actorId },
      toolName: 'kifer_get_whatsapp_integration_status',
    });

    expect(result).toMatchObject({ success: true, status: { enabled: true, token_configured: true, health_status: 'ok' } });
    expect(JSON.stringify(result)).not.toContain('webhook?secret=hidden');
    expect(JSON.stringify(result)).not.toContain('hidden');
  });

  it('requires explicit confirmation and both current versions before changing channel state', async () => {
    const auditInsert = vi.fn().mockResolvedValue({ error: null });
    const rpc = vi.fn().mockResolvedValue({ data: { success: true, enabled: false, channel_updated_at: '2026-10-21T12:00:00Z', settings_updated_at: '2026-10-21T12:00:00Z' }, error: null });
    const result = await executeMcpWhatsAppAdminWriteAction({
      supabase: { rpc, from: vi.fn(() => ({ insert: auditInsert })) } as never,
      actor: { actor: 'chatgpt:admin@kifer.test', actorId },
      toolName: 'kifer_set_whatsapp_integration_enabled',
      arguments: { enabled: false, expected_channel_updated_at: '2026-10-21T11:00:00Z', expected_settings_updated_at: '2026-10-21T11:00:00Z' },
    });

    expect(result).toMatchObject({ success: false, error_code: 'CONFIRMATION_REQUIRED' });
    expect(rpc).not.toHaveBeenCalled();
    expect(auditInsert).toHaveBeenCalledTimes(1);
  });
});
