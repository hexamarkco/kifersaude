import { beforeEach, expect, test, vi } from 'vitest';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import { generateSandboxReply } from '../ai-sandbox-attendance.ts';
import { generateAttendanceTurn } from '../autonomous-attendance-v2/generate-turn.ts';
import { V2_MODEL_PROFILE, V2_STYLE_LIBRARY } from '../autonomous-attendance-v2/deployment.ts';

vi.mock('../autonomous-attendance-v2/generate-turn.ts', () => ({ generateAttendanceTurn: vi.fn() }));
type Row = { id: string; role: 'ai' | 'lead'; content: string; created_at: string; handoff_code: string | null };
const row = (id: string, role: Row['role'], content: string): Row => ({ id, role, content, created_at: '2026-11-16T12:00:00Z', handoff_code: null });
function fixture(rows: Row[] = [], memory: unknown = {}) {
  const rpc = vi.fn(async () => ({ data: 'saved', error: null }));
  const pages: number[] = [];
  const tables: string[] = [];
  const client = { rpc, from: (table: string) => {
    tables.push(table);
    if (!['ai_sandbox_conversations', 'ai_sandbox_messages', 'integration_settings'].includes(table)) throw new Error(`Unexpected table ${table}`);
    const query = { select: () => query, eq: () => query, order: () => query,
      maybeSingle: async () => ({ data: table === 'ai_sandbox_conversations' ? { attendance_state: memory } : { settings: {} }, error: null }),
      range: async (from: number, to: number) => { pages.push(from); return { data: rows.slice(from, to + 1), error: null }; },
    };
    return query;
  } } as unknown as SupabaseClient;
  return { client, rpc, tables, pages };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(generateAttendanceTurn).mockResolvedValue({ messages: ['Entendi, será só para você.', 'Qual é a sua idade?'],
    handoffCode: null, durationMs: 1, retryCount: 0, estimatedCostUsd: 0.001,
    memory: {}, memoryAfterSend: { source_message_id: 'last', attendanceV2: { asked: { beneficiaries: 1 } } } });
});

test('an empty chat uses the configured approach and never calls a model or WhatsApp', async () => {
  const f = fixture();
  const result = await generateSandboxReply({ client: f.client, conversationId: 'test', startWithApproach: true });
  expect(result.messages[0]).toContain('Luiza Kifer');
  expect(result.engine).toBe('v2');
  expect(generateAttendanceTurn).not.toHaveBeenCalled();
  expect(f.tables).toContain('integration_settings');
  expect(f.rpc.mock.calls[0][0]).toBe('commit_ai_sandbox_turn');
});

test('fragmented client messages and persistent memory reach the exact production pipeline and published profile', async () => {
  const memory = { source_message_id: 'older', attendanceV2: { facts: { city: { value: 'Niterói' } } } };
  const f = fixture([row('older', 'lead', 'Só para mim'), row('a1', 'ai', 'Entendi, será só para você.'),
    row('a2', 'ai', 'Qual é a sua idade?'), row('m1', 'lead', '35'), row('last', 'lead', 'tenho MEI')], memory);
  const result = await generateSandboxReply({ client: f.client, conversationId: 'test' });
  const args = vi.mocked(generateAttendanceTurn).mock.calls[0][0];
  expect(args.previousMemory).toEqual(memory);
  expect(args.messages.map(m => m.content)).toEqual(['Só para mim', 'Entendi, será só para você.\n\nQual é a sua idade?', '35', 'tenho MEI']);
  expect(args).toMatchObject({ sandbox: true, sourceId: 'last',
    deployment: { modelProfile: V2_MODEL_PROFILE, styleLibrary: V2_STYLE_LIBRARY, splitReplies: true } });
  expect(f.rpc.mock.calls[0]).toEqual(['commit_ai_sandbox_turn', expect.objectContaining({
    p_expected_state: memory, p_source_message_id: 'last',
    p_state: { source_message_id: 'last', attendanceV2: { asked: { beneficiaries: 1 } } },
  })]);
  expect(result.messages).toHaveLength(2);
  expect(result.model).toBe(V2_MODEL_PROFILE.model);
});

test('a stale generation returns no bubbles and does not pretend the customer requested a person', async () => {
  const f = fixture([row('last', 'lead', '35')]);
  f.rpc.mockResolvedValue({ data: 'stale', error: null });
  const result = await generateSandboxReply({ client: f.client, conversationId: 'test' });
  expect(result).toMatchObject({ skipped: true, alreadyHandedOff: false, messages: [], handoffCode: null });
});

test('handoff or a previously answered turn makes no new model calls', async () => {
  for (const handedOff of [false, true]) {
    const ai = { ...row('ai', 'ai', 'Já tenho os dados.'), handoff_code: handedOff ? 'QUALIFICACAO_COMPLETA' : null };
    const f = fixture([ai, ...(handedOff ? [row('last', 'lead', 'Obrigado')] : [])]);
    const result = await generateSandboxReply({ client: f.client, conversationId: 'test' });
    expect(result.alreadyHandedOff).toBe(handedOff);
    expect(f.rpc).not.toHaveBeenCalled();
  }
  expect(generateAttendanceTurn).not.toHaveBeenCalled();
});

test('history is paginated beyond the old 100-message limit without silently losing early facts', async () => {
  const f = fixture(Array.from({ length: 501 }, (_, i) => row(`${i}`, 'lead', `Texto ${i}`)));
  await generateSandboxReply({ client: f.client, conversationId: 'test' });
  expect(f.pages).toEqual([0, 500]);
  expect(vi.mocked(generateAttendanceTurn).mock.calls[0][0].messages).toHaveLength(501);
});
