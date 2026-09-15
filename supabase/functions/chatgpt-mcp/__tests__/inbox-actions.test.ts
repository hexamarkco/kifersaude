import { describe, expect, it, vi } from 'vitest';
import {
  executeMcpInboxAction,
  MCP_INBOX_TOOLS,
  MCP_INBOX_WRITE_TOOL_NAMES,
} from '../inbox-actions';

const actorId = '7b09577d-49ec-4f00-a54a-56bf370e5179';
const chatId = '42c47f2e-c306-493f-8d7d-c08495017974';
const leadId = 'c3e99ca5-9470-46c7-bf9b-50b4e971e950';
const messageId = 'd6353fe2-773c-44cb-8da3-f7a5f0843f3b';
const expectedUpdatedAt = '2026-09-15T12:00:00.123456+00:00';
const seenAt = '2026-09-15T12:01:23.654321+00:00';

const chatState = {
  chat_id: chatId,
  updated_at: expectedUpdatedAt,
  status: 'open',
  is_archived: false,
  archived_at: null,
  is_muted: false,
  muted_at: null,
  is_pinned: false,
  pinned_at: null,
  manual_unread: false,
  manual_unread_at: null,
  unread_count: 2,
  last_read_at: null,
  lead_id: null,
  lead_link_source: null,
  lead_linked_at: null,
  phone_number: '5511999999999',
};

const makeSupabase = (response: unknown = { success: true, operation: 'chat.archived.set', chat: chatState, replayed: false }) => {
  const rpc = vi.fn().mockResolvedValue({ data: response, error: null });
  return { client: { rpc } as never, rpc };
};

const commonArgs = {
  chat_id: chatId,
  expected_updated_at: expectedUpdatedAt,
  client_request_id: 'inbox-action:test-1',
};

describe('MCP Inbox actions', () => {
  it('declares ten unique mutation tools with closed input schemas', () => {
    const names = MCP_INBOX_TOOLS.map(({ name }) => name);
    expect(names).toHaveLength(10);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(expect.arrayContaining([...MCP_INBOX_WRITE_TOOL_NAMES]));
    expect(MCP_INBOX_TOOLS.every((tool) => tool.inputSchema.additionalProperties === false)).toBe(true);
  });

  it('maps all ten tools to the seven actor-aware RPCs with concurrency and idempotency arguments', async () => {
    const cases = [
      ['kifer_archive_whatsapp_chat', 'mcp_comm_whatsapp_set_chat_archived', 'chat.archived.set', { p_is_archived: true }, {}],
      ['kifer_unarchive_whatsapp_chat', 'mcp_comm_whatsapp_set_chat_archived', 'chat.archived.set', { p_is_archived: false }, {}],
      ['kifer_pin_whatsapp_chat', 'mcp_comm_whatsapp_set_chat_pinned', 'chat.pinned.set', { p_is_pinned: true }, {}],
      ['kifer_unpin_whatsapp_chat', 'mcp_comm_whatsapp_set_chat_pinned', 'chat.pinned.set', { p_is_pinned: false }, {}],
      ['kifer_mute_whatsapp_chat', 'mcp_comm_whatsapp_set_chat_muted', 'chat.muted.set', { p_is_muted: true }, {}],
      ['kifer_unmute_whatsapp_chat', 'mcp_comm_whatsapp_set_chat_muted', 'chat.muted.set', { p_is_muted: false }, {}],
      ['kifer_mark_whatsapp_chat_unread', 'mcp_comm_whatsapp_set_chat_unread', 'chat.unread.set', { p_is_unread: true }, {}],
      ['kifer_mark_whatsapp_chat_read', 'mcp_comm_whatsapp_mark_chat_read', 'chat.read', { p_last_seen_message_at: seenAt, p_last_seen_message_id: messageId }, { last_seen_message_at: seenAt, last_seen_message_id: messageId }],
      ['kifer_link_chat_to_lead', 'mcp_comm_whatsapp_link_chat_lead', 'chat.lead.link', { p_lead_id: leadId }, { lead_id: leadId }],
      ['kifer_unlink_chat_from_lead', 'mcp_comm_whatsapp_unlink_chat_lead', 'chat.lead.unlink', {}, {}],
    ] as const;

    for (const [toolName, rpcName, operation, specificRpcArgs, specificToolArgs] of cases) {
      const { client, rpc } = makeSupabase({ success: true, operation, chat: chatState, replayed: false });
      const result = await executeMcpInboxAction({
        supabase: client,
        toolName,
        arguments: { ...commonArgs, ...specificToolArgs },
        actor: { actorId },
      });

      expect(result?.success).toBe(true);
      expect(rpc).toHaveBeenCalledWith(rpcName, {
        p_actor_user_id: actorId,
        p_chat_id: chatId,
        p_expected_updated_at: expectedUpdatedAt,
        p_client_request_id: commonArgs.client_request_id,
        ...specificRpcArgs,
      });
    }
  });

  it('keeps microsecond timestamps intact and returns only the safe state projection', async () => {
    const { client } = makeSupabase({
      success: true,
      operation: 'chat.archived.set',
      chat: chatState,
      replayed: true,
    });
    const result = await executeMcpInboxAction({
      supabase: client,
      toolName: 'kifer_archive_whatsapp_chat',
      arguments: commonArgs,
      actor: { actorId },
    });

    expect(result).toMatchObject({ success: true, replayed: true, chat: { updated_at: expectedUpdatedAt } });
    expect(result && 'phone_number' in (result.chat as Record<string, unknown>)).toBe(false);
  });

  it('returns a stable stale-write result for optimistic concurrency conflicts', async () => {
    const { client } = makeSupabase({
      success: false,
      operation: 'chat.muted.set',
      error: { code: 'STALE_WRITE', message: 'Reload required.', current_updated_at: expectedUpdatedAt },
      chat: chatState,
      replayed: false,
    });
    const result = await executeMcpInboxAction({
      supabase: client,
      toolName: 'kifer_mute_whatsapp_chat',
      arguments: commonArgs,
      actor: { actorId },
    });

    expect(result).toMatchObject({
      success: false,
      error_code: 'STALE_WRITE',
      current_updated_at: expectedUpdatedAt,
      chat: { chat_id: chatId },
    });
  });

  it('rejects invalid actors, IDs, timestamps, and request keys before the RPC', async () => {
    const invalidCases = [
      { arguments: commonArgs, actor: { actorId: 'not-a-uuid' } },
      { arguments: { ...commonArgs, chat_id: 'not-a-uuid' }, actor: { actorId } },
      { arguments: { ...commonArgs, expected_updated_at: '2026-09-15' }, actor: { actorId } },
      { arguments: { ...commonArgs, expected_updated_at: '2026-02-29T12:00:00.000Z' }, actor: { actorId } },
      { arguments: { ...commonArgs, client_request_id: 'contains spaces' }, actor: { actorId } },
      { arguments: { ...commonArgs, is_archived: false }, actor: { actorId } },
    ];
    for (const invalidCase of invalidCases) {
      const { client, rpc } = makeSupabase();
      const result = await executeMcpInboxAction({
        supabase: client,
        toolName: 'kifer_archive_whatsapp_chat',
        arguments: invalidCase.arguments,
        actor: invalidCase.actor,
      });
      expect(result?.success).toBe(false);
      expect(rpc).not.toHaveBeenCalled();
    }
  });

  it('validates optional mark-read cursor values and sends explicit nulls when absent', async () => {
    const { client, rpc } = makeSupabase({ success: true, operation: 'chat.read', chat: chatState, replayed: false });
    const result = await executeMcpInboxAction({
      supabase: client,
      toolName: 'kifer_mark_whatsapp_chat_read',
      arguments: commonArgs,
      actor: { actorId },
    });
    expect(result?.success).toBe(true);
    expect(rpc).toHaveBeenCalledWith('mcp_comm_whatsapp_mark_chat_read', expect.objectContaining({
      p_last_seen_message_at: null,
      p_last_seen_message_id: null,
    }));

    const { client: invalidClient, rpc: invalidRpc } = makeSupabase();
    const invalidResult = await executeMcpInboxAction({
      supabase: invalidClient,
      toolName: 'kifer_mark_whatsapp_chat_read',
      arguments: { ...commonArgs, last_seen_message_id: 'not-a-uuid' },
      actor: { actorId },
    });
    expect(invalidResult?.success).toBe(false);
    expect(invalidRpc).not.toHaveBeenCalled();
  });

  it('maps database authorization and idempotency errors without leaking raw messages', async () => {
    const unauthorized = makeSupabase();
    unauthorized.rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'MCP_ADMIN_REQUIRED details' } });
    const unauthorizedResult = await executeMcpInboxAction({
      supabase: unauthorized.client,
      toolName: 'kifer_archive_whatsapp_chat',
      arguments: commonArgs,
      actor: { actorId },
    });
    expect(unauthorizedResult).toEqual({ success: false, error_code: 'UNAUTHORIZED', message: 'A ação exige uma conta administradora ativa.' });

    const conflict = makeSupabase();
    conflict.rpc.mockResolvedValueOnce({ data: null, error: { code: '22023', message: 'MCP_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD' } });
    const conflictResult = await executeMcpInboxAction({
      supabase: conflict.client,
      toolName: 'kifer_archive_whatsapp_chat',
      arguments: commonArgs,
      actor: { actorId },
    });
    expect(conflictResult).toMatchObject({ success: false, error_code: 'IDEMPOTENCY_CONFLICT' });
    expect(JSON.stringify(conflictResult)).not.toContain('MCP_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD');
  });

  it('returns null for a tool owned by another MCP action module', async () => {
    const { client, rpc } = makeSupabase();
    const result = await executeMcpInboxAction({
      supabase: client,
      toolName: 'kifer_send_whatsapp_message',
      arguments: {},
      actor: { actorId },
    });
    expect(result).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
});
