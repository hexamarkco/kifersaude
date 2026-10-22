import { describe, expect, it, vi } from 'vitest';
import { executeMcpAgendaWriteAction } from '../agenda-actions';

const actor = { actor: 'chatgpt:test', actorId: '11111111-1111-4111-8111-111111111111' };
const id = '22222222-2222-4222-8222-222222222222';
const item = { reminder_id: id, expected_ultima_modificacao: '2026-10-22T00:00:00Z', data_lembrete: '2026-10-22T09:00:00-03:00' };
const run = (name: string, args: Record<string, unknown>, rpc = vi.fn().mockResolvedValue({ data: { success: true, changed_count: 1 }, error: null })) => ({ rpc, result: executeMcpAgendaWriteAction({ supabase: { rpc } as never, toolName: name, arguments: args, actor }) });

describe('MCP agenda actions', () => {
  it('normalizes explicit local times and sends versioned reschedules to the atomic RPC', async () => {
    const { rpc, result } = run('kifer_reschedule_reminders', { items: [item], dry_run: true });
    expect(await result).toMatchObject({ success: true });
    expect(rpc).toHaveBeenCalledWith('mcp_mutate_agenda_reminders', { p_actor_user_id: actor.actorId, p_operation: 'reschedule', p_items: [{ ...item, data_lembrete: '2026-10-22T12:00:00.000Z' }], p_dry_run: true });
  });
  it('rejects duplicate IDs, missing versions and dates without timezone before accessing the database', async () => {
    for (const items of [[item, item], [{ reminder_id: id, data_lembrete: item.data_lembrete }], [{ ...item, data_lembrete: '2026-10-22T09:00:00' }]]) {
      const { rpc, result } = run('kifer_reschedule_reminders', { items });
      expect(await result).toMatchObject({ success: false, error_code: 'INVALID_INPUT' });
      expect(rpc).not.toHaveBeenCalled();
    }
  });
  it('requires explicit deletion and supports reopening without changing the date', async () => {
    const denied = run('kifer_delete_reminders', { items: [{ reminder_id: id, expected_ultima_modificacao: null }] });
    expect(await denied.result).toMatchObject({ error_code: 'CONFIRMATION_REQUIRED' });
    expect(denied.rpc).not.toHaveBeenCalled();
    const reopened = run('kifer_reopen_reminder', { reminder_id: id, expected_ultima_modificacao: null });
    expect(await reopened.result).toMatchObject({ success: true });
    expect(reopened.rpc).toHaveBeenCalledWith('mcp_mutate_agenda_reminders', expect.objectContaining({ p_operation: 'reopen', p_items: [{ reminder_id: id, expected_ultima_modificacao: null }] }));
  });
});
