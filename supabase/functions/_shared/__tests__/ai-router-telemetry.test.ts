import { describe, expect, it } from 'vitest';

import { calculateCost, logAiCall } from '../ai-router.ts';

describe('AI call telemetry', () => {
  it('charges cached tokens at the input rate when no discounted rate is known', () => {
    const usage = { inputTokens: 1000, cachedInputTokens: 800, outputTokens: 100,
      reasoningTokens: 0, totalTokens: 1100 };
    const price = { provider: 'openai', model: 'gpt-6-luna', input_per_million: 0.1,
      cached_input_per_million: null, output_per_million: 0.5,
      is_transcription: false, transcription_per_minute: null };
    expect(calculateCost('openai', 'gpt-6-luna', usage, new Map([['openai/gpt-6-luna', price]])))
      .toBeCloseTo(0.00015);
    expect(calculateCost('openai', 'gpt-6-luna', usage,
      new Map([['openai/gpt-6-luna', { ...price, cached_input_per_million: 0.01 }]])))
      .toBeCloseTo(0.000078);
  });
  it('updates the original logical call row instead of inserting a second summary row', async () => {
    const inserts: Array<Record<string, unknown>> = [];
    const updates: Array<{ payload: Record<string, unknown>; column: string; value: string }> = [];
    const supabaseAdmin = {
      from: (table: string) => {
        expect(table).toBe('ai_call_logs');
        return {
          insert: (payload: Record<string, unknown>) => {
            inserts.push(payload);
            return {
              select: () => ({
                maybeSingle: async () => ({ data: { id: 'call-1' } }),
              }),
            };
          },
          update: (payload: Record<string, unknown>) => ({
            eq: async (column: string, value: string) => {
              updates.push({ payload, column, value });
              return { error: null };
            },
          }),
        };
      },
    };

    const callId = await logAiCall(supabaseAdmin, {
      featureKey: 'followup.analysis',
      aiTask: 'follow_up_analysis',
      edgeFunction: 'comm-whatsapp-generate-follow-up',
    }, {
      success: false,
      fallbackUsed: false,
      attemptsCount: 0,
    });

    await logAiCall(supabaseAdmin, {
      featureKey: 'followup.analysis',
      aiTask: 'follow_up_analysis',
      edgeFunction: 'comm-whatsapp-generate-follow-up',
    }, {
      success: true,
      finalProvider: 'openai',
      finalModel: 'gpt-4.1-mini',
      fallbackUsed: true,
      attemptsCount: 2,
      totalDurationMs: 76_000,
      retryCount: 1,
      stopReason: 'completed_after_retry',
    }, callId);

    expect(inserts).toHaveLength(1);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      column: 'id',
      value: 'call-1',
      payload: {
        success: true,
        attempts_count: 2,
        retry_count: 1,
        stop_reason: 'completed_after_retry',
        final_model: 'gpt-4.1-mini',
      },
    });
  });
});
