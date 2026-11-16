import { expect, test } from 'vitest';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import { inV2Rollout, groupV2ReplyMessages, selectAutonomousEngine } from '../autonomous-attendance-v2/domain/rollout.ts';
import { resolveRuntimeModelProfile } from '../ai-router.ts';
import { V2_MODEL_PROFILE, V2_STYLE_LIBRARY, V2_ROLLOUT } from '../autonomous-attendance-v2/deployment.ts';
const start = '2026-11-15T20:00:00Z';
const input = { leadId: 'new-lead', leadCreatedAt: start, chatCreatedAt: start, phone: '5521999999999',
  rollout: { enabledAt: start, percentage: 100, ddd: '21' } };

test('rollout is opt-in and only covers new leads and new DDD21 chats', () => {
  expect(inV2Rollout(input)).toBe(true);
  expect(inV2Rollout({ ...input, phone: '(21) 99999-9999' })).toBe(true);
  for (const change of [{ phone: '5511999999999' }, { phone: null }, { leadCreatedAt: null }, { legacyStarted: true },
    { leadCreatedAt: '2026-11-14T00:00:00Z' }, { chatCreatedAt: '2026-11-14T00:00:00Z' },
    { rollout: { ...input.rollout, enabledAt: null } }, { rollout: { ...input.rollout, percentage: 0 } },
    { rollout: { ...input.rollout, percentage: 101 } }]) expect(inV2Rollout({ ...input, ...change })).toBe(false);
});
test('assignment is stable across workers and a larger cohort contains the smaller cohort', () => {
  const assignments = Array.from({ length: 1000 }, (_, i) => ({ ...input, leadId: `lead-${i}` }));
  const pick = (percentage: number) => assignments.filter(row => inV2Rollout({ ...row, rollout: { ...row.rollout, percentage } })).map(row => row.leadId);
  expect(pick(10)).toEqual(pick(10));
  expect(pick(10).length).toBeGreaterThan(0);
  expect(pick(10).every(id => pick(25).includes(id))).toBe(true);
});
test('existing-chat mode is only enabled explicitly and only resumes on a fresh inbound, never from backlog', () => {
  const old = { ...input, leadCreatedAt: '2026-01-01T00:00:00Z', chatCreatedAt: '2026-01-01T00:00:00Z', legacyStarted: true };
  expect(inV2Rollout(old)).toBe(false);
  const resume = { ...old, rollout: { ...input.rollout, includeExisting: true }, messageReceivedAt: start };
  expect(inV2Rollout(resume)).toBe(true);
  expect(inV2Rollout({ ...resume, messageReceivedAt: '2026-11-14T00:00:00Z' })).toBe(false);
  expect(inV2Rollout({ ...resume, messageReceivedAt: undefined })).toBe(false);
  expect(inV2Rollout({ ...resume, hasV2State: true, messageReceivedAt: undefined })).toBe(true);
  expect(inV2Rollout({ ...resume, phone: '5511999999999' })).toBe(false);
});
test('grouping restores split turns for the cooldown without crossing inbound or different source boundaries', () => {
  const rows = [
    { id: '1', role: 'ai' as const, content: 'Entendi o contexto.', deliveryGroup: 'g1' },
    { id: '2', role: 'ai' as const, content: 'Qual é a idade?', deliveryGroup: 'g1' },
    { id: '3', role: 'lead' as const, content: '35 anos' },
    { id: '4', role: 'ai' as const, content: 'Em que cidade e bairro mora?', deliveryGroup: 'g2' },
    { id: '5', role: 'ai' as const, content: 'Outra origem.', deliveryGroup: 'g3' },
  ];
  expect(groupV2ReplyMessages(rows).map(row => row.content)).toEqual([
    'Entendi o contexto.\n\nQual é a idade?', '35 anos', 'Em que cidade e bairro mora?', 'Outra origem.',
  ]);
  expect(rows[0].content).toBe('Entendi o contexto.');
  expect(groupV2ReplyMessages(rows.slice(1, 3))[0].content).toBe('Qual é a idade?');
});

test('the published replacement covers every region and legacy chat on the next inbound', () => {
  expect(V2_ROLLOUT).toMatchObject({ percentage: 100, ddd: null, includeExisting: true });
  for (const phone of ['5521999999999', '5511999999999', '5531999999999', '5581999999999', '5548999999999', '+351912345678', null]) {
    expect(selectAutonomousEngine({ ...input, phone, leadCreatedAt: '2020-01-01T00:00:00Z',
      chatCreatedAt: '2020-01-01T00:00:00Z', legacyStarted: true, rollout: V2_ROLLOUT,
      paused: false, messageReceivedAt: V2_ROLLOUT.enabledAt! })).toBe('v2');
  }
});

test('full replacement pauses or waits for a new inbound without invoking the legacy engine', () => {
  const global = { ...input, rollout: V2_ROLLOUT, paused: false, legacyStarted: true,
    messageReceivedAt: V2_ROLLOUT.enabledAt! };
  expect(selectAutonomousEngine(global)).toBe('v2');
  expect(selectAutonomousEngine({ ...global, paused: true, allowlisted: true })).toBe('wait');
  expect(selectAutonomousEngine({ ...global, messageReceivedAt: start })).toBe('wait');
  expect(selectAutonomousEngine({ ...global, messageReceivedAt: undefined })).toBe('wait');
  expect(selectAutonomousEngine({ ...global, hasV2State: true, messageReceivedAt: undefined })).toBe('v2');
  expect(selectAutonomousEngine({ ...global, hasV2State: true, paused: true })).toBe('wait');
});

test('the former limited pilot retains its explicit legacy routing outside the cohort', () => {
  expect(selectAutonomousEngine({ ...input, paused: false, phone: '5511999999999' })).toBe('legacy');
  expect(selectAutonomousEngine({ ...input, paused: false, phone: '5511999999999', allowlisted: true })).toBe('v2');
  expect(selectAutonomousEngine({ ...input, paused: true, hasV2State: true })).toBe('wait');
});
test('the cloud candidate pins the same model and reviewed style version as the local bench', () => {
  expect(V2_MODEL_PROFILE).toMatchObject({ model: 'gpt-6-luna', reasoningEffort: 'medium' });
  expect(V2_STYLE_LIBRARY.version).toBe('kifer-human-546c3e1ad04e');
  expect(V2_STYLE_LIBRARY.examples).toHaveLength(17);
});
test.each([
  { active: false, deprecated_at: null, capabilities: ['text'] },
  { active: true, deprecated_at: start, capabilities: ['text'] },
  { active: true, deprecated_at: null, capabilities: [] },
  null,
])('a missing, inactive, deprecated or incompatible pinned model fails without silently choosing another model', async row => {
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: row, error: null }) };
  const client = { from: () => query } as unknown as SupabaseClient;
  await expect(resolveRuntimeModelProfile(client, V2_MODEL_PROFILE)).rejects.toThrow('catálogo');
});
test('an active compatible pinned profile resolves without changing the active legacy feature config', async () => {
  const tables: string[] = [];
  const query = { select: () => query, eq: () => query,
    maybeSingle: async () => ({ data: { active: true, deprecated_at: null, capabilities: ['text', 'reasoning'] }, error: null }) };
  const client = { from: (table: string) => { tables.push(table); return query; } } as unknown as SupabaseClient;
  await expect(resolveRuntimeModelProfile(client, V2_MODEL_PROFILE)).resolves.toMatchObject({ model: 'gpt-6-luna', reasoningEffort: 'medium' });
  expect(tables).toEqual(['ai_models']);
});
