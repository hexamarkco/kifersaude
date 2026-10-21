import { describe, expect, it, vi } from 'vitest';
import {
  campaignReadAuditSummary,
  executeMcpWhatsAppCampaignReadAction,
  executeMcpWhatsAppCampaignWriteAction,
  metricsFromTargetStatusCounts,
  MCP_WHATSAPP_CAMPAIGN_READ_TOOL_NAMES,
  MCP_WHATSAPP_CAMPAIGN_TOOLS,
  MCP_WHATSAPP_CAMPAIGN_WRITE_TOOL_NAMES,
} from '../whatsapp-campaign-actions';

const actorId = '7b09577d-49ec-4f00-a54a-56bf370e5179';
const campaignId = '42c47f2e-c306-493f-8d7d-c08495017974';
const updatedAt = '2026-09-15T12:00:00.000Z';

const makeSupabase = (
  response: unknown = { success: true, replayed: false },
  readiness: unknown = { ready: true, reason_codes: [], total_targets: 1, eligible_targets: 1, pending_targets: 0 },
) => {
  const rpc = vi.fn().mockImplementation(async (name: string) => ({
    data: name === 'get_comm_whatsapp_campaign_marketing_readiness' ? readiness : response,
    error: null,
  }));
  const invoke = vi.fn().mockResolvedValue({ data: { success: true, status: 'queued', campaignId }, error: null });
  return { client: { rpc, functions: { invoke } } as never, rpc, invoke };
};

describe('MCP WhatsApp campaign actions', () => {
  it('derives campaign metrics from live target states instead of stale saved counters', () => {
    expect(metricsFromTargetStatusCounts([
      { status: 'pending', total_count: 524, responded_count: 0 },
      { status: 'invalid', total_count: 54, responded_count: 0 },
    ])).toEqual({
      total: 578, valid: 524, invalid: 54, pending: 524,
      sent: 0, failed: 0, responded: 0, stopped: 0,
    });
  });

  it('returns live target counters in campaign lists when saved counters are stale', async () => {
    const storedCampaign = {
      id: campaignId,
      name: 'Amil Outubro',
      status: 'draft',
      total_targets: 578,
      valid_targets: 571,
      invalid_targets: 7,
      pending_targets: 571,
      sent_targets: 0,
      failed_targets: 0,
      responded_targets: 0,
      stopped_targets: 0,
    };
    const query = {
      select: () => query,
      eq: () => query,
      ilike: () => query,
      gte: () => query,
      lte: () => query,
      order: () => query,
      range: () => query,
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => (
        Promise.resolve({ data: [storedCampaign], error: null, count: 1 }).then(resolve, reject)
      ),
    };
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { status: 'pending', total_count: 524, responded_count: 0 },
        { status: 'invalid', total_count: 54, responded_count: 0 },
      ],
      error: null,
    });
    const client = { from: () => query, rpc } as never;

    const result = await executeMcpWhatsAppCampaignReadAction({
      supabase: client,
      toolName: 'kifer_list_whatsapp_campaigns',
      arguments: { page: 1, page_size: 20 },
    });

    expect(rpc).toHaveBeenCalledWith('get_comm_whatsapp_campaign_target_status_counts', { p_campaign_id: campaignId });
    expect(result).toMatchObject({
      campaigns: [{
        total_targets: 578,
        valid_targets: 524,
        invalid_targets: 54,
        pending_targets: 524,
        metrics: { total: 578, valid: 524, invalid: 54, pending: 524 },
      }],
    });
  });

  it('reports the missing Amil image even when the human review masks that readiness reason', async () => {
    const amilCampaignId = '663279e5-739c-4efc-916e-cdf13142a458';
    const campaign = {
      id: amilCampaignId,
      status: 'draft',
      audience_config: { exclude_opt_out: true },
      message_text: 'Oi {{primeiro_nome}}',
      scheduled_at: null,
      send_window_start: '09:00',
      send_window_end: '18:30',
      active_weekdays: [1, 2, 3, 4, 5],
      total_targets: 1,
      valid_targets: 1,
      invalid_targets: 0,
      pending_targets: 1,
    };
    const steps = [{
      step_index: 0,
      stage_index: 0,
      step_kind: 'message',
      message_text: 'Oi {{primeiro_nome}}',
      media_type: null,
      media_url: null,
      variant_label: 'ANY',
    }];
    const queryFor = (table: string) => {
      let columns = '';
      let head = false;
      const response = () => {
        if (table === 'comm_whatsapp_campaign_steps') return { data: steps, error: null };
        if (table === 'comm_whatsapp_campaign_targets' && head) return { data: null, count: 0, error: null };
        if (table === 'comm_whatsapp_campaign_targets' && columns === 'phone_digits') {
          return { data: [{ phone_digits: '5511999999999' }], error: null };
        }
        if (table === 'contact_permission_policies') return { data: [], error: null };
        return { data: [], error: null };
      };
      const query = {
        select: (value: string, options?: { head?: boolean }) => { columns = value; head = options?.head === true; return query; },
        eq: () => query,
        order: () => query,
        limit: () => query,
        or: () => query,
        in: () => query,
        maybeSingle: async () => ({ data: campaign, error: null }),
        then: (resolve: (value: ReturnType<typeof response>) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(response()).then(resolve, reject),
      };
      return query;
    };
    const client = {
      from: (table: string) => queryFor(table),
      rpc: async (name: string) => name === 'get_comm_whatsapp_campaign_target_status_counts'
        ? { data: [{ status: 'pending', total_count: 1, responded_count: 0 }], error: null }
        : { data: { ready: false, reason_codes: ['campaign_marketing_review_pending'], eligible_targets: 0, pending_targets: 1, duplicate_targets: 0 }, error: null },
    } as never;

    const result = await executeMcpWhatsAppCampaignReadAction({
      supabase: client,
      toolName: 'kifer_preview_whatsapp_campaign',
      arguments: { campaign_id: amilCampaignId, samples: [{ name: 'Ana' }] },
    });

    expect(result).toMatchObject({
      metrics: { total: 1, valid: 1, pending: 1 },
      validation: {
        marketing_review_ready: false,
        required_promotion_image_ready: false,
        contact_marketing_eligibility_ready: false,
        ready_to_activate: false,
      },
      message_sequence: [{ step_index: 0, media_attached: false, media_type: null }],
    });
  });

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

  it('passes campaign pacing through the persisted campaign mutation contract', async () => {
    const { client, rpc } = makeSupabase({ success: true, replayed: false, campaign: { id: campaignId, status: 'draft' } });
    await executeMcpWhatsAppCampaignWriteAction({
      supabase: client,
      toolName: 'kifer_update_whatsapp_campaign',
      actorId,
      arguments: {
        campaign_id: campaignId,
        expected_updated_at: updatedAt,
        client_request_id: 'campaign:pacing:1',
        contact_interval_minutes: null,
        inter_message_interval_minutes: 2,
      },
    });

    expect(rpc).toHaveBeenCalledWith('mcp_comm_whatsapp_campaign_mutation', expect.objectContaining({
      p_payload: expect.objectContaining({
        contact_interval_minutes: null,
        inter_message_interval_minutes: 2,
        audience_config: { __mcp_campaign_pacing: { contact_interval_minutes: null, inter_message_interval_minutes: 2 } },
      }),
    }));
  });

  it('rejects contact and bubble intervals outside the supported range', async () => {
    const { client, rpc } = makeSupabase({ success: true, replayed: false, campaign: { id: campaignId, status: 'draft' } });
    const result = await executeMcpWhatsAppCampaignWriteAction({
      supabase: client,
      toolName: 'kifer_update_whatsapp_campaign',
      actorId,
      arguments: {
        campaign_id: campaignId,
        expected_updated_at: updatedAt,
        client_request_id: 'campaign:pacing:invalid',
        inter_message_interval_minutes: 1441,
      },
    });

    expect(result).toMatchObject({ success: false, error_code: 'INVALID_INPUT' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('accepts a bucket-relative media object path without accepting arbitrary media URLs', async () => {
    const { client, rpc } = makeSupabase({ success: true, replayed: false, campaign: { id: campaignId, status: 'draft' } });
    const result = await executeMcpWhatsAppCampaignWriteAction({
      supabase: client,
      toolName: 'kifer_update_whatsapp_campaign',
      actorId,
      arguments: {
        campaign_id: campaignId,
        expected_updated_at: updatedAt,
        client_request_id: 'campaign:media:1',
        steps: [{ message: 'Olá', step_index: 0, media_storage_path: 'uploads/amil-outubro.png' }],
      },
    });

    expect(result).toMatchObject({ success: true });
    expect(rpc).toHaveBeenCalledWith('mcp_comm_whatsapp_campaign_mutation', expect.objectContaining({
      p_payload: { steps: [{ message: 'Olá', step_index: 0, media_storage_path: 'uploads/amil-outubro.png' }] },
    }));

    const malicious = await executeMcpWhatsAppCampaignWriteAction({
      supabase: client,
      toolName: 'kifer_update_whatsapp_campaign',
      actorId,
      arguments: {
        campaign_id: campaignId,
        expected_updated_at: updatedAt,
        client_request_id: 'campaign:media:2',
        steps: [{ message: 'Olá', media_url: 'https://example.invalid/payload' }],
      },
    });
    expect(malicious).toMatchObject({ success: false, error_code: 'INVALID_INPUT' });
    expect(rpc).toHaveBeenCalledTimes(1);
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

  it('does not mutate or invoke the worker when marketing readiness blocks activation', async () => {
    const { client, rpc, invoke } = makeSupabase(
      { success: true, replayed: false, campaign_id: campaignId, status: 'paused' },
      {
        ready: false,
        reason_codes: ['campaign_marketing_review_pending', 'campaign_promotion_image_pending'],
        total_targets: 20,
        eligible_targets: 0,
        pending_targets: 20,
        duplicate_targets: 0,
      },
    );
    const result = await executeMcpWhatsAppCampaignWriteAction({
      supabase: client,
      toolName: 'kifer_activate_whatsapp_campaign',
      actorId,
      arguments: { campaign_id: campaignId, expected_updated_at: updatedAt, client_request_id: 'campaign:activate:blocked' },
    });

    expect(result).toMatchObject({
      success: false,
      error_code: 'CAMPAIGN_NOT_READY',
      validation: {
        ready_to_activate: false,
        eligible_targets: 0,
        total_targets: 20,
        marketing_reason_codes: ['campaign_marketing_review_pending', 'campaign_promotion_image_pending'],
      },
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('get_comm_whatsapp_campaign_marketing_readiness', { p_campaign_id: campaignId });
    expect(invoke).not.toHaveBeenCalled();
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
