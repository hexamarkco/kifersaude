import { describe, expect, it, vi } from 'vitest';
import {
  executeMcpOpportunityReadAction,
  executeMcpOpportunityWriteAction,
  MCP_OPPORTUNITY_TOOLS,
} from '../opportunity-actions';

const actorId = '7b09577d-49ec-4f00-a54a-56bf370e5179';
const opportunityId = '42c47f2e-c306-493f-8d7d-c08495017974';
const updatedAt = '2026-09-15T12:00:00.000Z';

const makeSupabase = (response: unknown = { success: true }) => {
  const rpc = vi.fn().mockResolvedValue({ data: response, error: null });
  return { client: { rpc } as never, rpc };
};

describe('MCP opportunity actions', () => {
  it('declares eight unique opportunity tools', () => {
    const names = MCP_OPPORTUNITY_TOOLS.map(({ name }) => name);
    expect(names).toHaveLength(8);
    expect(new Set(names).size).toBe(names.length);
  });

  it('rejects mass assignment before calling the database', async () => {
    const { client, rpc } = makeSupabase();
    const result = await executeMcpOpportunityWriteAction({
      supabase: client,
      toolName: 'kifer_update_opportunity',
      arguments: {
        opportunity_id: opportunityId,
        expected_updated_at: updatedAt,
        changes: { status: 'won', created_by: actorId },
      },
      actor: { actorId },
    });

    expect(result?.success).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('forwards a narrow update with optimistic concurrency', async () => {
    const { client, rpc } = makeSupabase({ success: true, opportunity: { id: opportunityId } });
    const result = await executeMcpOpportunityWriteAction({
      supabase: client,
      toolName: 'kifer_update_opportunity',
      arguments: {
        opportunity_id: opportunityId,
        expected_updated_at: updatedAt,
        changes: { status: 'proposal', notes: 'Cotação solicitada' },
      },
      actor: { actorId },
    });

    expect(result?.success).toBe(true);
    expect(rpc).toHaveBeenCalledWith('mcp_update_opportunity', {
      p_actor_user_id: actorId,
      p_opportunity_id: opportunityId,
      p_expected_updated_at: updatedAt,
      p_patch: { status: 'proposal', notes: 'Cotação solicitada' },
    });
  });

  it('sends the OAuth actor to reads so SQL can recheck authorization', async () => {
    const { client, rpc } = makeSupabase({ success: true, opportunity: { id: opportunityId } });
    await executeMcpOpportunityReadAction({
      supabase: client,
      toolName: 'kifer_get_opportunity_360',
      arguments: { opportunity_id: opportunityId },
      actorId,
    });

    expect(rpc).toHaveBeenCalledWith('mcp_get_opportunity_360', {
      p_actor_user_id: actorId,
      p_opportunity_id: opportunityId,
    });
  });
});
