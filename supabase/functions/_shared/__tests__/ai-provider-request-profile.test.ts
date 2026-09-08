import { describe, expect, it } from 'vitest';

import {
  clampTemperature,
  resolveClaudeRequestProfile,
  resolveGeminiRequestProfile,
  resolveOpenAiRequestProfile,
} from '../ai-provider-request-profile.ts';

describe('AI provider request profiles', () => {
  it.each([
    ['gpt-4.1-mini', 'follow_up_generation', 'max_tokens', undefined, true],
    ['gpt-5.6-sol', 'follow_up_generation', 'max_completion_tokens', 'low', false],
    ['gpt-5.6-luna', 'rewrite_message', 'max_completion_tokens', 'none', true],
    ['gpt-5.7-future', 'follow_up_generation', 'max_completion_tokens', 'low', false],
    ['gpt-5.2-pro', 'follow_up_generation', 'max_completion_tokens', 'high', false],
    ['gpt-6-astra', 'follow_up_generation', 'max_completion_tokens', 'medium', false],
    ['gpt-6-astra', 'rewrite_message', 'max_completion_tokens', 'low', false],
    ['gpt-7-future', 'rewrite_message', 'max_completion_tokens', 'low', false],
    ['o3', 'follow_up_generation', 'max_completion_tokens', 'medium', false],
    ['o4-mini', 'rewrite_message', 'max_completion_tokens', 'low', false],
  ] as const)(
    'resolves OpenAI fields for %s / %s',
    (model, task, tokenParameter, reasoningEffort, supportsTemperature) => {
      expect(resolveOpenAiRequestProfile(model, task)).toEqual({
        tokenParameter,
        reasoningEffort,
        supportsTemperature,
      });
    },
  );

  it('keeps temperature for older Claude models and removes it for newer ones', () => {
    expect(resolveClaudeRequestProfile('claude-sonnet-4-6').supportsTemperature).toBe(true);
    expect(resolveClaudeRequestProfile('claude-opus-4-8').supportsTemperature).toBe(false);
    expect(resolveClaudeRequestProfile('claude-sonnet-5').supportsTemperature).toBe(false);
  });

  it('uses Gemini model configuration bounds', () => {
    expect(resolveGeminiRequestProfile('gemini-3.7-flash')).toEqual({
      supportsTemperature: true,
      maxTemperature: 2,
    });
    expect(clampTemperature(3, 2)).toBe(2);
    expect(clampTemperature(-1, 2)).toBe(0);
  });
});
