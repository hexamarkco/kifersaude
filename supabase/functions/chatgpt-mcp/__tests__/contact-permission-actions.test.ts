import { describe, expect, it, vi } from 'vitest';
import {
  executeMcpContactPermissionReadAction,
  executeMcpContactPermissionWriteAction,
  MCP_CONTACT_PERMISSION_TOOLS,
} from '../contact-permission-actions';

const actorId = '7b09577d-49ec-4f00-a54a-56bf370e5179';
const leadId = '42c47f2e-c306-493f-8d7d-c08495017974';
const updatedAt = '2026-09-15T12:00:00.000Z';

const makeSupabase = (response: unknown = { success: true }) => {
  const rpc = vi.fn().mockResolvedValue({ data: response, error: null });
  return { client: { rpc } as never, rpc };
};

describe('MCP contact permission actions', () => {
  it('declares the three unique read, single-write, and bulk-write tools', () => {
    const names = MCP_CONTACT_PERMISSION_TOOLS.map(({ name }) => name);
    expect(names).toEqual([
      'kifer_get_contact_permission',
      'kifer_set_contact_permission',
      'kifer_bulk_set_contact_permission',
    ]);
    expect(new Set(names).size).toBe(names.length);
  });

  it('sends the OAuth actor and endpoint to the read RPC', async () => {
    const { client, rpc } = makeSupabase({ success: true, policies: [] });
    await executeMcpContactPermissionReadAction({
      supabase: client,
      toolName: 'kifer_get_contact_permission',
      arguments: { channel: 'whatsapp', endpoint: '+55 (21) 99999-1234' },
      actorId,
    });

    expect(rpc).toHaveBeenCalledWith('mcp_get_contact_permission', {
      p_actor_user_id: actorId,
      p_channel: 'whatsapp',
      p_endpoint: '+55 (21) 99999-1234',
    });
  });

  it('forwards optimistic concurrency and a validated exact lead association', async () => {
    const { client, rpc } = makeSupabase({
      success: true,
      policy: { lead_id: leadId, lead_match_ambiguous: false, updated_at: updatedAt },
    });
    const result = await executeMcpContactPermissionWriteAction({
      supabase: client,
      toolName: 'kifer_set_contact_permission',
      arguments: {
        client_request_id: 'permission-1',
        channel: 'whatsapp',
        endpoint: '5521999991234',
        purpose_scope: 'commercial',
        state: 'allowed',
        lead_id: leadId,
        expected_updated_at: updatedAt,
        evidence: { source: 'CRM review' },
      },
      actor: { actorId },
    });

    expect(result?.success).toBe(true);
    expect(rpc).toHaveBeenCalledWith('mcp_set_contact_permission', {
      p_actor_user_id: actorId,
      p_client_request_id: 'permission-1',
      p_channel: 'whatsapp',
      p_endpoint: '5521999991234',
      p_purpose_scope: 'commercial',
      p_state: 'allowed',
      p_reason: null,
      p_evidence: { source: 'CRM review' },
      p_lead_id: leadId,
      p_expected_updated_at: updatedAt,
    });
  });

  it('rejects duplicate normalized bulk targets before the RPC call', async () => {
    const { client, rpc } = makeSupabase();
    const result = await executeMcpContactPermissionWriteAction({
      supabase: client,
      toolName: 'kifer_bulk_set_contact_permission',
      arguments: {
        client_request_id: 'permission-bulk-1',
        changes: [
          { channel: 'whatsapp', endpoint: '+55 21 99999-1234', purpose_scope: 'commercial', state: 'blocked' },
          { channel: 'whatsapp', endpoint: '5521999991234', purpose_scope: 'commercial', state: 'allowed' },
        ],
      },
      actor: { actorId },
    });

    expect(result?.error_code).toBe('INVALID_INPUT');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('forwards atomic bulk changes including per-item concurrency tokens', async () => {
    const { client, rpc } = makeSupabase({ success: true, count: 1, ambiguous_lead_matches: 1 });
    await executeMcpContactPermissionWriteAction({
      supabase: client,
      toolName: 'kifer_bulk_set_contact_permission',
      arguments: {
        client_request_id: 'permission-bulk-2',
        changes: [{
          channel: 'email',
          endpoint: 'person@example.com',
          purpose_scope: 'global',
          state: 'blocked',
          expected_updated_at: updatedAt,
          evidence: { ticket_id: 'support-123' },
        }],
      },
      actor: { actorId },
    });

    expect(rpc).toHaveBeenCalledWith('mcp_bulk_set_contact_permission', {
      p_actor_user_id: actorId,
      p_client_request_id: 'permission-bulk-2',
      p_changes: [{
        channel: 'email',
        endpoint: 'person@example.com',
        purpose_scope: 'global',
        state: 'blocked',
        expected_updated_at: updatedAt,
        lead_id: undefined,
        reason: undefined,
        evidence: { ticket_id: 'support-123' },
      }],
    });
  });

  it('rejects invalid leads and timestamps before database writes', async () => {
    const { client, rpc } = makeSupabase();
    const result = await executeMcpContactPermissionWriteAction({
      supabase: client,
      toolName: 'kifer_set_contact_permission',
      arguments: {
        client_request_id: 'permission-invalid',
        channel: 'whatsapp',
        endpoint: '5521999991234',
        purpose_scope: 'commercial',
        state: 'allowed',
        lead_id: 'not-a-uuid',
        expected_updated_at: 'yesterday',
      },
      actor: { actorId },
    });

    expect(result?.success).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});
