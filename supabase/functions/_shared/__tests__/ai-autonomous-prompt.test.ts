import { describe, expect, test, vi } from 'vitest';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import { loadGlobalConfig, type ResolvedAIFeatureConfig } from '../ai-config-resolver.ts';
import { buildAutonomousSystemPrompt, composeAutonomousPrompt, selectHumanStyleMessages, type AutonomousStyleMessage } from '../ai-autonomous-prompt.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const config: ResolvedAIFeatureConfig = {
  featureKey: 'autonomous.reply', provider: 'openai', model: 'gpt-6.1-sol', fallbackModel: null,
  modelOverrideEnabled: true, temperature: 0.6, maxOutputTokens: 1600, reasoningEffort: 'low',
  timeoutMs: null, retryCount: null, useGlobalInstructions: true, useGlobalStyle: true,
  featurePrompt: 'FEATURE', outputInstructions: 'OUTPUT', contextConfig: {}, version: 24,
};
const human: AutonomousStyleMessage = {
  id: 'human', direction: 'outbound', message_type: 'text', delivery_status: 'sent',
  text_content: 'Também podemos cotar sem CNPJ. Você já tem plano?', message_at: '2026-10-07T12:00:00Z',
  media_caption: null, transcription_text: null, created_by: 'operator', metadata: {},
};
const globals = {
  instructions: { key: 'global_instructions', content: 'GLOBAL INSTRUCTIONS', version: 1 },
  style: { key: 'global_style', content: 'GLOBAL STYLE', version: 2 },
};

describe('autonomous prompt assembly', () => {
  test('human references exclude unattended, AI and automation messages', () => {
    const samples = [human, { ...human, created_by: null }, { ...human, metadata: { provider: 'ai_autonomous' } }, { ...human, metadata: { automation: 'auto_contact' } }, { ...human, direction: 'inbound' as const }, { ...human, delivery_status: 'failed' }];
    expect(selectHumanStyleMessages(samples)).toEqual([human]);
  });

  test('global flags affect effective content and human style, preserving critical rules', () => {
    const params = { config, globals, styleMessages: [human], quickReplies: [] };
    const enabled = buildAutonomousSystemPrompt(params);
    expect(enabled).toContain('GLOBAL INSTRUCTIONS');
    expect(enabled).toContain('GLOBAL STYLE');
    expect(enabled).toContain(human.text_content);
    const disabled = buildAutonomousSystemPrompt({ ...params, config: { ...config, useGlobalInstructions: false, useGlobalStyle: false } });
    expect(disabled).not.toContain('GLOBAL INSTRUCTIONS');
    expect(disabled).not.toContain('GLOBAL STYLE');
    expect(disabled).not.toContain('EXEMPLOS REAIS');
    expect(disabled).toContain('BASE OBRIGATORIA');
    expect(enabled).toContain('uma conversa inteira de perguntas diretas');
  });

  test('global loader reads the actual key/value schema', async () => {
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { key: 'test-global-schema', value: 'Actual style', updated_at: '2026-10-07T12:00:00Z' }, error: null }) };
    const client = { from: vi.fn().mockReturnValue(query) } as unknown as SupabaseClient;
    const result = await loadGlobalConfig(client, 'test-global-schema', { noCache: true });
    expect(query.select).toHaveBeenCalledWith('key, value, updated_at');
    expect(query.eq).toHaveBeenCalledTimes(1);
    expect(result?.content).toBe('Actual style');
    expect(result?.version).toBe(Date.parse('2026-10-07T12:00:00Z'));
  });

  test('same effective prompt has a stable trace without logging content', async () => {
    const client = {} as SupabaseClient;
    const params = { supabaseAdmin: client, config: { ...config, useGlobalInstructions: false, useGlobalStyle: false }, styleMessages: [human], quickReplies: [] };
    const first = await composeAutonomousPrompt(params);
    const second = await composeAutonomousPrompt(params);
    expect(first.trace.systemPromptHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.trace).toEqual(second.trace);
    expect(JSON.stringify(first.trace)).not.toContain('FEATURE');
    expect(first.trace.humanStyleCount).toBe(0);
    const changed = await composeAutonomousPrompt({ ...params, config: { ...params.config, featurePrompt: 'CHANGED' } });
    expect(changed.trace.systemPromptHash).not.toBe(first.trace.systemPromptHash);
  });

  test('production and both sandboxes use the same composer and attributed references', () => {
    for (const name of ['ai-autonomous-reply-worker', 'ai-sandbox-chat', 'ai-sandbox-run-scenario']) {
      const source = readFileSync(resolve('supabase/functions', name, 'index.ts'), 'utf8');
      expect(source).toContain('composeAutonomousPrompt({');
      expect(source).toContain(".not('created_by', 'is', null)");
      expect(source).not.toContain('fetchSimilarSituations');
      expect(source).not.toContain('const systemPrompt = [');
    }
  });
});
