import { describe, expect, it, vi } from 'vitest';
import {
  executeMcpIdentityConflictResolution,
  MCP_IDENTITY_CONFLICT_TOOLS,
} from '../identity-conflict-actions';

const actorId = '7b09577d-49ec-4f00-a54a-56bf370e5179';
const conflictId = '1e933e11-169d-4f79-a68e-288a2dc1610e';
const leadId = 'c3e99ca5-9470-46c7-bf9b-50b4e971e950';
const expectedConflictUpdatedAt = '2026-09-15T12:00:00.123456+00:00';
const expectedChatUpdatedAt = '2026-09-15T12:01:00.654321+00:00';
const args = {
  conflict_id: conflictId,
  lead_id: leadId,
  expected_updated_at: expectedConflictUpdatedAt,
  expected_chat_updated_at: expectedChatUpdatedAt,
  client_request_id: 'identity-resolution:test-1',
};

const makeSupabase = (response: unknown = { success: true, status: 'resolved', replayed: false }) => {
  const rpc = vi.fn().mockResolvedValue({ data: response, error: null });
  return { client: { rpc } as never, rpc };
};

describe('MCP identity conflict resolution', () => {
  it('declares a single closed-schema tool requiring persisted versions and idempotency', () => {
    expect(MCP_IDENTITY_CONFLICT_TOOLS).toHaveLength(1);
    expect(MCP_IDENTITY_CONFLICT_TOOLS[0].name).toBe('kifer_resolve_identity_conflict');
    expect(MCP_IDENTITY_CONFLICT_TOOLS[0].inputSchema.additionalProperties).toBe(false);
    expect(MCP_IDENTITY_CONFLICT_TOOLS[0].inputSchema.required).toEqual(expect.arrayContaining([
      'expected_updated_at', 'expected_chat_updated_at', 'client_request_id',
    ]));
  });

  it('calls the checked database resolution with actor, selected candidate and both versions', async () => {
    const { client, rpc } = makeSupabase();
    const result = await executeMcpIdentityConflictResolution({
      supabase: client,
      toolName: 'kifer_resolve_identity_conflict',
      arguments: args,
      actorId,
    });

    expect(result).toMatchObject({ success: true, status: 'resolved' });
    expect(rpc).toHaveBeenCalledWith('mcp_resolve_whatsapp_identity_conflict', {
      p_actor_user_id: actorId,
      p_conflict_id: conflictId,
      p_lead_id: leadId,
      p_expected_conflict_updated_at: expectedConflictUpdatedAt,
      p_expected_chat_updated_at: expectedChatUpdatedAt,
      p_client_request_id: 'identity-resolution:test-1',
    });
  });

  it('rejects malformed input and extra proof fields before database access', async () => {
    const { client, rpc } = makeSupabase();
    const result = await executeMcpIdentityConflictResolution({
      supabase: client,
      toolName: 'kifer_resolve_identity_conflict',
      arguments: { ...args, round_trip_verified: true },
      actorId,
    });
    expect(result).toMatchObject({ success: false, error_code: 'INVALID_INPUT' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('reports unsupported external identity evidence as requires_review', async () => {
    const { client } = makeSupabase({
      success: false,
      status: 'requires_review',
      reason: 'identity_evidence_requires_server_revalidation',
    });
    const result = await executeMcpIdentityConflictResolution({
      supabase: client,
      toolName: 'kifer_resolve_identity_conflict',
      arguments: args,
      actorId,
    });
    expect(result).toMatchObject({ success: false, error_code: 'REQUIRES_REVIEW', status: 'requires_review' });
  });

  it('preserves stale-write signals from the database', async () => {
    const { client } = makeSupabase({
      success: false,
      status: 'stale',
      error_code: 'STALE_WRITE',
      current_conflict_updated_at: '2026-09-15T13:00:00Z',
      current_chat_updated_at: '2026-09-15T13:01:00Z',
    });
    const result = await executeMcpIdentityConflictResolution({
      supabase: client,
      toolName: 'kifer_resolve_identity_conflict',
      arguments: args,
      actorId,
    });
    expect(result).toMatchObject({ success: false, error_code: 'STALE_WRITE', status: 'stale' });
  });
});
