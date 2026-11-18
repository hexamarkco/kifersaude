import { expect, test } from 'vitest';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import { groupV2ReplyMessages } from '../autonomous-attendance-v2/domain/rollout.ts';
import { resolveRuntimeModelProfile } from '../ai-router.ts';
import { V2_MODEL_PROFILE, V2_STYLE_LIBRARY } from '../autonomous-attendance-v2/deployment.ts';

const start = '2026-11-15T20:00:00Z';

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
test('an active compatible pinned profile resolves without changing the active feature config', async () => {
  const tables: string[] = [];
  const query = { select: () => query, eq: () => query,
    maybeSingle: async () => ({ data: { active: true, deprecated_at: null, capabilities: ['text', 'reasoning'] }, error: null }) };
  const client = { from: (table: string) => { tables.push(table); return query; } } as unknown as SupabaseClient;
  await expect(resolveRuntimeModelProfile(client, V2_MODEL_PROFILE)).resolves.toMatchObject({ model: 'gpt-6-luna', reasoningEffort: 'medium' });
  expect(tables).toEqual(['ai_models']);
});
