import { describe, expect, it, vi } from 'vitest';
import {
  executeMcpTrackingConfigReadAction,
  executeMcpTrackingConfigWriteAction,
} from '../tracking-config-actions';

const actor = { actor: 'chatgpt:admin@kifer.test', actorId: '7b09577d-49ec-4f00-a54a-56bf370e5179' };
const metaVersion = '2026-10-21T12:00:00.000Z';
const gtmVersion = '2026-10-21T12:01:00.000Z';

describe('MCP tracking configuration', () => {
  it('reads the current public tracking IDs but audits only whether they are configured', async () => {
    const auditInsert = vi.fn().mockResolvedValue({ error: null });
    let integrationRead = 0;
    const from = vi.fn((table: string) => {
      if (table === 'chatgpt_mcp_audit_log') return { insert: auditInsert };
      integrationRead += 1;
      const query: Record<string, unknown> = {};
      query.select = vi.fn(() => query);
      query.eq = vi.fn(() => query);
      query.maybeSingle = vi.fn(async () => integrationRead === 1
        ? { data: { settings: { pixelId: '1234567890' }, updated_at: metaVersion }, error: null }
        : { data: { settings: { gtmId: 'GTM-ABCD1234' }, updated_at: gtmVersion }, error: null });
      return query;
    });
    const supabase = { from } as never;

    const result = await executeMcpTrackingConfigReadAction({ supabase, toolName: 'kifer_get_tracking_configuration', actor });

    expect(result).toMatchObject({ success: true, meta_pixel: { pixel_id: '1234567890', updated_at: metaVersion }, google_tag_manager: { gtm_id: 'GTM-ABCD1234', updated_at: gtmVersion } });
    expect(JSON.stringify(auditInsert.mock.calls[0]?.[0])).not.toContain('1234567890');
    expect(auditInsert.mock.calls[0]?.[0]).toMatchObject({ request_summary: { meta_pixel_configured: true, google_tag_manager_configured: true } });
  });

  it('requires confirmation before changing either public tracker', async () => {
    const insertAudit = vi.fn().mockResolvedValue({ error: null });
    const invoke = vi.fn();
    const result = await executeMcpTrackingConfigWriteAction({
      supabase: { from: vi.fn(() => ({ insert: insertAudit })) } as never,
      toolName: 'kifer_set_meta_pixel_id',
      arguments: { pixel_id: '1234567890', expected_updated_at: metaVersion },
      actor,
    });

    expect(result).toMatchObject({ success: false, error_code: 'CONFIRMATION_REQUIRED' });
    expect(invoke).not.toHaveBeenCalled();
    expect(insertAudit).not.toHaveBeenCalled();
  });

  it('performs a versioned update and never stores the tracker identifier in the audit payload', async () => {
    const auditInsert = vi.fn().mockResolvedValue({ error: null });
    const readQuery: Record<string, unknown> = {};
    readQuery.select = vi.fn(() => readQuery);
    readQuery.eq = vi.fn(() => readQuery);
    readQuery.maybeSingle = vi.fn(async () => ({ data: { id: 'integration-1', settings: { pixelId: '1111' }, updated_at: metaVersion }, error: null }));
    const updateQuery: Record<string, unknown> = {};
    updateQuery.update = vi.fn(() => updateQuery);
    updateQuery.eq = vi.fn(() => updateQuery);
    updateQuery.select = vi.fn(() => updateQuery);
    updateQuery.maybeSingle = vi.fn(async () => ({ data: { id: 'integration-1', updated_at: '2026-10-21T12:02:00.000Z' }, error: null }));
    let integrationCall = 0;
    const from = vi.fn((table: string) => {
      if (table === 'mcp_action_audit_log') return { insert: auditInsert } as never;
      integrationCall += 1;
      return (integrationCall === 1 ? readQuery : updateQuery) as never;
    });
    const pixelId = '9876543210';

    const result = await executeMcpTrackingConfigWriteAction({
      supabase: { from } as never,
      toolName: 'kifer_set_meta_pixel_id',
      arguments: { pixel_id: pixelId, expected_updated_at: metaVersion, confirm_tracking_change: true },
      actor,
    });

    expect(result).toMatchObject({ success: true, pixel_id: pixelId, configured: true });
    expect(updateQuery.update).toHaveBeenCalledWith(expect.objectContaining({ settings: { pixelId } }));
    expect(updateQuery.eq).toHaveBeenCalledWith('updated_at', metaVersion);
    expect(JSON.stringify(auditInsert.mock.calls[0]?.[0])).not.toContain(pixelId);
    expect(auditInsert.mock.calls[0]?.[0]).toMatchObject({ request_payload: { value_length: pixelId.length, configured: true } });
  });

  it('rejects malformed GTM IDs before touching the database', async () => {
    const from = vi.fn();
    const result = await executeMcpTrackingConfigWriteAction({
      supabase: { from } as never,
      toolName: 'kifer_set_google_tag_manager_id',
      arguments: { gtm_id: 'https://example.test/script.js', expected_updated_at: null, confirm_tracking_change: true },
      actor,
    });
    expect(result).toMatchObject({ success: false, error_code: 'INVALID_INPUT' });
    expect(from).not.toHaveBeenCalled();
  });
});
