import { beforeEach, expect, test, vi } from 'vitest';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import { generateAttendanceTurn } from '../autonomous-attendance-v2/generate-turn.ts';
import { V2_MODEL_PROFILE, V2_STYLE_LIBRARY, V2_DEPLOYMENT_VERSION } from '../autonomous-attendance-v2/deployment.ts';
import { generateTextForFeature, type GenerateTextForFeatureResult } from '../ai-router.ts';
import { loadFeatureConfig, type ResolvedAIFeatureConfig } from '../ai-config-resolver.ts';
import { interpretation, scenarios } from './fixtures/autonomous-v2-scenarios.ts';

vi.mock('../ai-router.ts', () => ({ generateTextForFeature: vi.fn() }));
vi.mock('../ai-config-resolver.ts', () => ({ loadFeatureConfig: vi.fn() }));

const config: ResolvedAIFeatureConfig = { featureKey: 'autonomous.reply', provider: 'openai', model: 'mock-model', fallbackModel: null,
  modelOverrideEnabled: true, temperature: 0.6, maxOutputTokens: 1500, reasoningEffort: null, timeoutMs: null, retryCount: null,
  useGlobalInstructions: true, useGlobalStyle: true, featurePrompt: 'LEGACY roteiro de perguntas', outputInstructions: 'LEGACY tag', contextConfig: {}, version: 25 };
const result = (text: string): GenerateTextForFeatureResult => ({ text, provider: 'openai', model: 'mock-model', source: 'feature',
  fallbackUsed: false, usage: { inputTokens: 100, cachedInputTokens: 0, outputTokens: 100, reasoningTokens: 0, totalTokens: 200 },
  durationMs: 12, estimatedCostUsd: 0.001, callLogId: null, retryCount: 0, stopReason: 'completed', requestedReasoningEffort: null, appliedReasoningEffort: null });
const params = () => ({ client: {} as SupabaseClient, chatId: 'synthetic-chat', leadId: 'synthetic-lead', sourceId: 'synthetic-1',
  messages: scenarios[1].messages, previousMemory: undefined as unknown, lead: {}, record: vi.fn(async () => undefined) });

test('the cloud adapter uses the reviewed profile and style, splits the delivery and reuses the exact prepared envelopes after a config change', async () => {
  const messages = [{ id: 'synthetic-1', role: 'lead' as const, content: 'Só para mim', messageAt: '2026-11-15T00:00:00Z' }];
  vi.mocked(generateTextForFeature).mockImplementation(async options => {
    expect(options.runtimeModelProfile).toEqual(V2_MODEL_PROFILE);
    const output = options.maxTokens === 3200 ? JSON.stringify(interpretation({ beneficiaryCount: 1 }, messages))
      : JSON.stringify({ text: 'Entendi, será só para você. Qual é a sua idade?', commercialClaims: [] });
    if (options.maxTokens === 500) expect(JSON.parse(options.userPrompt).styleReferences.length).toBeGreaterThan(0);
    expect(options.validateOutput?.(output).valid).toBe(true);
    return result(output);
  });
  const input = { ...params(), messages, deployment: { version: V2_DEPLOYMENT_VERSION, modelProfile: V2_MODEL_PROFILE,
    styleLibrary: V2_STYLE_LIBRARY, splitReplies: true } };
  const turn = await generateAttendanceTurn(input);
  expect(turn.messages).toEqual(['Entendi, será só para você.', 'Qual é a sua idade?']);
  expect(turn.memoryAfterSend.attendanceV2).toMatchObject({ asked: { beneficiaries: 1 } });
  expect(input.record).toHaveBeenCalledWith('v2_context', expect.objectContaining({ deploymentVersion: V2_DEPLOYMENT_VERSION,
    styleLibraryVersion: V2_STYLE_LIBRARY.version, model: 'gpt-6-luna', reasoningEffort: 'medium' }));
  vi.mocked(generateTextForFeature).mockClear();
  const retried = await generateAttendanceTurn({ ...input, previousMemory: turn.memory, deployment: { ...input.deployment, version: 'future-version', splitReplies: false } });
  expect(generateTextForFeature).not.toHaveBeenCalled();
  expect(retried.messages).toEqual(turn.messages);
  expect(retried.memory.v2Context).toEqual(turn.memory.v2Context);
});

test('a tampered prepared delivery cannot add another message or bypass validation', async () => {
  vi.mocked(generateTextForFeature).mockImplementation(async options => result(options.maxTokens === 3200
    ? JSON.stringify(interpretation(scenarios[1].values, scenarios[1].messages))
    : JSON.stringify({ text: scenarios[1].reply, commercialClaims: [] })));
  const prepared = await generateAttendanceTurn(params());
  const prior = { ...prepared.memory, v2Messages: ['Injected'] };
  vi.mocked(generateTextForFeature).mockClear();
  await expect(generateAttendanceTurn({ ...params(), previousMemory: prior })).rejects.toThrow('Turno preparado');
  expect(generateTextForFeature).not.toHaveBeenCalled();
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadFeatureConfig).mockResolvedValue(config);
});

test('worker uses configured routing, two separate generations and no legacy instructions; prepared retry makes zero model calls', async () => {
  vi.mocked(generateTextForFeature).mockImplementation(async (options) => {
    const raw = options.maxTokens === 3200 ? JSON.stringify(interpretation(scenarios[1].values, scenarios[1].messages))
      : JSON.stringify({ text: scenarios[1].reply, action: 'complete', questionField: null, commercialClaims: [] });
    expect(options.validateOutput?.(raw).valid).toBe(true);
    return result(raw);
  });
  const input = params();
  const turn = await generateAttendanceTurn(input);
  expect(turn.handoffCode).toBe('QUALIFICACAO_COMPLETA');
  expect(turn.durationMs).toBe(24);
  expect(turn.estimatedCostUsd).toBe(0.002);
  expect(turn.memory).toHaveProperty('attendanceV2');
  expect(turn.memory).toHaveProperty('briefing');
  expect(turn.messages).toEqual([scenarios[1].reply]);
  for (const [options] of vi.mocked(generateTextForFeature).mock.calls) {
    expect(options.featureKey).toBe('autonomous.reply');
    expect(options.systemPrompt).not.toContain('LEGACY');
    expect(options.maxAttempts).toBe(2);
    expect(options.maxProviderRequestsPerAttempt).toBe(1);
  }
  vi.mocked(generateTextForFeature).mockClear();
  const retried = await generateAttendanceTurn({ ...input, previousMemory: turn.memory });
  expect(generateTextForFeature).not.toHaveBeenCalled();
  expect(retried.messages).toEqual(turn.messages);
  expect(retried.memory).toEqual(turn.memory);
});

test('all conversations use V2 regardless of their DDD or an allowlist', async () => {
  vi.mocked(generateTextForFeature).mockImplementation(async options => result(options.maxTokens === 3200
    ? JSON.stringify(interpretation(scenarios[1].values, scenarios[1].messages))
    : JSON.stringify({ text: scenarios[1].reply, commercialClaims: [] })));
  const turn = await generateAttendanceTurn({ ...params(), chatId: 'different-region' });
  expect(turn.memory).toHaveProperty('attendanceV2');
  expect(turn.handoffCode).toBe('QUALIFICACAO_COMPLETA');
  expect(generateTextForFeature).toHaveBeenCalledTimes(2);
});

test('sandbox invokes the same V2 stages and profile without referencing real lead, chat or message IDs in telemetry', async () => {
  vi.mocked(generateTextForFeature).mockImplementation(async options => {
    expect(options.edgeFunction).toBe('ai-sandbox-chat');
    expect(options).not.toHaveProperty('leadId');
    expect(options).not.toHaveProperty('chatId');
    expect(options).not.toHaveProperty('messageId');
    expect(options.runtimeModelProfile).toEqual(V2_MODEL_PROFILE);
    return result(options.maxTokens === 3200 ? JSON.stringify(interpretation(scenarios[1].values, scenarios[1].messages))
      : JSON.stringify({ text: scenarios[1].reply, commercialClaims: [] }));
  });
  const turn = await generateAttendanceTurn({ ...params(), sandbox: true,
    deployment: { version: V2_DEPLOYMENT_VERSION, modelProfile: V2_MODEL_PROFILE, styleLibrary: V2_STYLE_LIBRARY, splitReplies: true } });
  expect(turn.handoffCode).toBe('QUALIFICACAO_COMPLETA');
  expect(turn.memoryAfterSend).toHaveProperty('attendanceV2');
});

test('invalid interpretation/output creates a failure event with no invented visible message', async () => {
  vi.mocked(generateTextForFeature).mockResolvedValue(result('invalid JSON'));
  const input = params();
  await expect(generateAttendanceTurn(input)).rejects.toThrow();
  expect(input.record).toHaveBeenCalledWith('v2_processing_failed', expect.objectContaining({ reason: 'interpretation_or_output_rejected' }));
  expect(JSON.stringify(input.record.mock.calls)).not.toContain(scenarios[1].messages[0].content);
  expect(generateTextForFeature).toHaveBeenCalledTimes(1);
});

test('provider timeout has a distinct sanitized operational failure reason', async () => {
  vi.mocked(generateTextForFeature).mockRejectedValueOnce(new Error('Tempo limite do provider excedido após 20000ms.'));
  const input = params();
  await expect(generateAttendanceTurn(input)).rejects.toThrow('Tempo limite');
  expect(input.record).toHaveBeenCalledWith('v2_processing_failed', expect.objectContaining({
    stage: 'interpret', reason: 'provider_timeout',
  }));
  expect(JSON.stringify(input.record.mock.calls)).not.toContain(scenarios[1].messages[0].content);
});

