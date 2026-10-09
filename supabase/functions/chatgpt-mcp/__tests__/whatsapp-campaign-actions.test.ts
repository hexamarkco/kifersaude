import { describe, expect, it, vi } from 'vitest';
import {
  campaignReadAuditSummary,
  executeMcpWhatsAppCampaignWriteAction,
  MCP_WHATSAPP_CAMPAIGN_READ_TOOL_NAMES,
  MCP_WHATSAPP_CAMPAIGN_TOOLS,
  MCP_WHATSAPP_CAMPAIGN_WRITE_TOOL_NAMES,
} from '../whatsapp-campaign-actions';

const actorId = '7b09577d-49ec-4f00-a54a-56bf370e5179';
const campaignId = '42c47f2e-c306-493f-8d7d-c08495017974';
const updatedAt = '2026-09-15T12:00:00.000Z';

const makeSupabase = (response: unknown = { success: true, replayed: false }) => {
  const rpc = vi.fn().mockResolvedValue({ data: response, error: null });
  const invoke = vi.fn().mockResolvedValue({ data: { success: true, status: 'queued', campaignId }, error: null });
  return { client: { rpc, functions: { invoke } } as never, rpc, invoke };
};

describe('MCP WhatsApp campaign actions', () => {
  it('builds audit metadata for list queries without requiring campaign identifiers', () => {
    expect(campaignReadAuditSummary({ page: 1, page_size: 1 })).toEqual({
      campaign_id: null, target_id: null, argument_keys: ['page', 'page_size'], page: 1, page_size: 1,
    });
    expect(campaignReadAuditSummary({ campaign_id: ` ${campaignId} `, target_id: 'invalid', search: 'private-name' })).toMatchObject({
      campaign_id: campaignId, target_id: null, argument_keys: ['campaign_id', 'search', 'target_id'],
    });
    expect(JSON.stringify(campaignReadAuditSummary({ search: 'private-name' }))).not.toContain('private-name');
  });

  it('declares the complete campaign surface without follow-up-flow aliases', () => {
    const names = MCP_WHATSAPP_CAMPAIGN_TOOLS.map(({ name }) => name);
    expect(names).toHaveLength(15);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(expect.arrayContaining([
      ...MCP_WHATSAPP_CAMPAIGN_READ_TOOL_NAMES,
      ...MCP_WHATSAPP_CAMPAIGN_WRITE_TOOL_NAMES,
    ]));
    expect(names.some((name) => name.includes('followup'))).toBe(false);
  });

  it('publishes closed schemas with explicit safety annotations', () => {
    for (const tool of MCP_WHATSAPP_CAMPAIGN_TOOLS) {
      expect(tool.inputSchema).toMatchObject({ type: 'object', additionalProperties: false });
      expect(tool.annotations).toMatchObject({ openWorldHint: false });
    }

    for (const toolName of MCP_WHATSAPP_CAMPAIGN_READ_TOOL_NAMES) {
      expect(MCP_WHATSAPP_CAMPAIGN_TOOLS.find(({ name }) => name === toolName)?.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
      });
    }

    for (const toolName of MCP_WHATSAPP_CAMPAIGN_WRITE_TOOL_NAMES) {
      const tool = MCP_WHATSAPP_CAMPAIGN_TOOLS.find(({ name }) => name === toolName);
      expect(tool?.annotations).toMatchObject({ readOnlyHint: false, openWorldHint: false });
      expect(typeof tool?.annotations?.destructiveHint).toBe('boolean');
      expect((tool?.inputSchema as { required?: string[] }).required).toContain('client_request_id');
    }
  });

  it('creates a draft through the existing campaign RPC and never invokes the worker', async () => {
    const campaign = { id: campaignId, name: 'Reativação', status: 'draft', created_by: actorId };
    const { client, rpc, invoke } = makeSupabase({ success: true, replayed: false, campaign });
    const result = await executeMcpWhatsAppCampaignWriteAction({
      supabase: client,
      toolName: 'kifer_create_whatsapp_campaign',
      actorId,
      arguments: { name: 'Reativação', message: 'Olá {{primeiro_nome}}', client_request_id: 'campaign:create:1', create_leads_from_csv: true },
    });

    expect(result).toMatchObject({ success: true, campaign: { id: campaignId, status: 'draft' } });
    expect(rpc).toHaveBeenCalledWith('mcp_comm_whatsapp_campaign_mutation', expect.objectContaining({
      p_operation: 'create',
      p_client_request_id: 'campaign:create:1',
      p_payload: { name: 'Reativação', message: 'Olá {{primeiro_nome}}' },
    }));
    expect(invoke).not.toHaveBeenCalled();
  });

  it('forwards optimistic concurrency and safe update fields', async () => {
    const { client, rpc } = makeSupabase({ success: true, replayed: false, campaign: { id: campaignId, status: 'draft' } });
    await executeMcpWhatsAppCampaignWriteAction({
      supabase: client,
      toolName: 'kifer_update_whatsapp_campaign',
      actorId,
      arguments: { campaign_id: campaignId, expected_updated_at: updatedAt, client_request_id: 'campaign:update:1', name: 'Nova campanha', message: 'Bom dia {{nome}}', stop_on_reply: true },
    });

    expect(rpc).toHaveBeenCalledWith('mcp_comm_whatsapp_campaign_mutation', expect.objectContaining({
      p_operation: 'update',
      p_campaign_id: campaignId,
      p_expected_updated_at: updatedAt,
      p_payload: { name: 'Nova campanha', message: 'Bom dia {{nome}}', stop_on_reply: true },
    }));
  });

  it('imports batches as contacts and does not translate them into leads', async () => {
    const { client, rpc } = makeSupabase({ success: true, inserted: 1, duplicate: 1, invalid_phone: 1, blocked: 0, failed: 0, replayed: false });
    await executeMcpWhatsAppCampaignWriteAction({
      supabase: client,
      toolName: 'kifer_import_whatsapp_campaign_contacts',
      actorId,
      arguments: {
        campaign_id: campaignId,
        client_request_id: 'campaign:import:1',
        contacts: [
          { phone: '+55 (21) 99999-1234', name: 'Maria', custom_fields: { origem: 'mcp' } },
          { phone: '5521999991234', name: 'Duplicada' },
          { phone: '123', name: 'Inválida' },
        ],
      },
    });

    expect(rpc).toHaveBeenCalledWith('mcp_comm_whatsapp_campaign_mutation', expect.objectContaining({
      p_operation: 'import_contacts',
      p_payload: { contacts: [
        { phone: '+55 (21) 99999-1234', name: 'Maria', custom_fields: { origem: 'mcp' } },
        { phone: '5521999991234', name: 'Duplicada', custom_fields: {} },
        { phone: '123', name: 'Inválida', custom_fields: {} },
      ] },
    }));
    expect(rpc.mock.calls[0][1].p_payload.contacts[0]).not.toHaveProperty('lead_id');
  });

  it('requires idempotency and optimistic concurrency before touching the database', async () => {
    const { client, rpc } = makeSupabase();
    const missingVersion = await executeMcpWhatsAppCampaignWriteAction({
      supabase: client,
      toolName: 'kifer_pause_whatsapp_campaign',
      actorId,
      arguments: { campaign_id: campaignId, client_request_id: 'campaign:pause:1' },
    });
    const invalidRequestId = await executeMcpWhatsAppCampaignWriteAction({
      supabase: client,
      toolName: 'kifer_activate_whatsapp_campaign',
      actorId,
      arguments: { campaign_id: campaignId, expected_updated_at: updatedAt, client_request_id: 'bad id' },
    });

    expect(missingVersion).toMatchObject({ success: false, error_code: 'EXPECTED_UPDATED_AT_REQUIRED' });
    expect(invalidRequestId).toMatchObject({ success: false, error_code: 'CLIENT_REQUEST_ID_INVALID' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('delegates activation to the existing worker exactly once for a fresh request', async () => {
    const { client, invoke } = makeSupabase({ success: true, replayed: false, campaign_id: campaignId, status: 'paused', activation_prepared: true });
    const result = await executeMcpWhatsAppCampaignWriteAction({
      supabase: client,
      toolName: 'kifer_activate_whatsapp_campaign',
      actorId,
      arguments: { campaign_id: campaignId, expected_updated_at: updatedAt, client_request_id: 'campaign:activate:1' },
    });

    expect(result).toMatchObject({ success: true, activation: { status: 'queued' } });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('comm-whatsapp-campaign-worker', { body: { action: 'activate', campaignId, source: 'api' } });
  });

  it('does not invoke the worker again when the database returns an idempotent replay', async () => {
    const { client, invoke } = makeSupabase({ success: true, replayed: true, campaign_id: campaignId, status: 'paused', activation_prepared: true });
    const result = await executeMcpWhatsAppCampaignWriteAction({
      supabase: client,
      toolName: 'kifer_activate_whatsapp_campaign',
      actorId,
      arguments: { campaign_id: campaignId, expected_updated_at: updatedAt, client_request_id: 'campaign:activate:1' },
    });

    expect(result).toMatchObject({ success: true, replayed: true });
    expect(invoke).not.toHaveBeenCalled();
  });
});
