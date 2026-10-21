import { describe, expect, it, vi } from 'vitest';
import {
  executeMcpUserAccessWriteAction,
  MCP_USER_ACCESS_READ_TOOL_NAMES,
  MCP_USER_ACCESS_TOOLS,
  MCP_USER_ACCESS_WRITE_TOOL_NAMES,
} from '../user-access-actions';

const actorId = '7b09577d-49ec-4f00-a54a-56bf370e5179';
const invitedId = '856a9e20-841d-4868-939c-738e39ddbb1a';

describe('MCP user and access administration', () => {
  it('publishes the CRM user and access management actions without password inputs', () => {
    expect(MCP_USER_ACCESS_READ_TOOL_NAMES).toEqual([
      'kifer_list_users', 'kifer_list_access_profiles', 'kifer_list_access_profile_permissions',
    ]);
    expect(MCP_USER_ACCESS_WRITE_TOOL_NAMES).toContain('kifer_invite_user');
    expect(MCP_USER_ACCESS_WRITE_TOOL_NAMES).toContain('kifer_set_access_profile_permission');
    const userTools = MCP_USER_ACCESS_TOOLS.filter((tool) => tool.name.includes('user'));
    const inputPropertyNames = userTools.flatMap((tool) => Object.keys((tool.inputSchema as { properties?: Record<string, unknown> }).properties ?? {}));
    expect(inputPropertyNames).not.toContain('password');
    expect(MCP_USER_ACCESS_TOOLS.find((tool) => tool.name === 'kifer_delete_user')?.annotations?.destructiveHint).toBe(true);
    expect(MCP_USER_ACCESS_TOOLS.find((tool) => tool.name === 'kifer_send_user_password_reset')?.annotations?.openWorldHint).toBe(true);
  });

  it('requires explicit confirmation and permission consistency before changing access', async () => {
    const insertAudit = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn(() => ({ insert: insertAudit })) } as never;
    const actor = { actor: 'chatgpt:admin@kifer.test', actorId };

    const invite = await executeMcpUserAccessWriteAction({
      supabase, actor, toolName: 'kifer_invite_user',
      arguments: { email: 'person@example.test', username: 'person', role: 'observer' },
    });
    const permission = await executeMcpUserAccessWriteAction({
      supabase, actor, toolName: 'kifer_set_access_profile_permission',
      arguments: { role: 'observer', module: 'leads', can_view: false, can_edit: true, expected_updated_at: null },
    });

    expect(invite).toMatchObject({ success: false, error_code: 'INVALID_INPUT' });
    expect(permission).toMatchObject({ success: false, error_code: 'INVALID_INPUT' });
    expect(insertAudit).toHaveBeenCalledTimes(2);
  });

  it('sends an explicit invite without putting the email or username in the MCP audit payload', async () => {
    const auditInsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'mcp_action_audit_log') return { insert: auditInsert };
        if (table === 'access_profiles') return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'profile-1', slug: 'observer', is_admin: false }, error: null }) }) }),
        };
        if (table === 'user_profiles') {
          let updateMode = false;
          const query: Record<string, unknown> = {};
          query.select = vi.fn(() => query);
          query.eq = vi.fn(() => query);
          query.limit = vi.fn(() => query);
          query.maybeSingle = vi.fn(async () => updateMode ? { data: { id: invitedId }, error: null } : { data: null, error: null });
          query.update = vi.fn(() => { updateMode = true; return query; });
          return query;
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
      auth: {
        admin: {
          inviteUserByEmail: vi.fn(async () => ({ data: { user: { id: invitedId } }, error: null })),
          deleteUser: vi.fn(async () => ({ error: null })),
        },
      },
    } as never;

    const result = await executeMcpUserAccessWriteAction({
      supabase, actor: { actor: 'chatgpt:admin@kifer.test', actorId }, toolName: 'kifer_invite_user',
      arguments: { email: 'person@example.test', username: 'person', role: 'observer', confirm_send_invite: true },
    });

    expect(result).toEqual({ success: true, user_id: invitedId, invited: true });
    const auditPayload = JSON.stringify(auditInsert.mock.calls[0]?.[0]);
    expect(auditPayload).not.toContain('person@example.test');
    expect(auditPayload).not.toContain('person');
    expect(auditPayload).toContain('observer');
  });
});
