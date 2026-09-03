import { describe, expect, it } from 'vitest';
import {
  AI_FEATURES,
  AI_FEATURE_META,
  getAllFeatureKeys,
  getFeatureMeta,
  requireFeatureMeta,
  isValidFeatureKey,
  type AIFeatureKey,
} from '../ai-feature-registry.ts';

describe('AI Feature Registry', () => {
  it('contains all 12 expected features', () => {
    const keys = getAllFeatureKeys();
    expect(keys).toHaveLength(12);
  });

  it('has metadata for every feature key', () => {
    const keys = getAllFeatureKeys();
    for (const key of keys) {
      const meta = getFeatureMeta(key);
      expect(meta).toBeDefined();
      expect(meta!.key).toBe(key);
      expect(meta!.name).toBeTruthy();
      expect(meta!.description).toBeTruthy();
      expect(meta!.aiTask).toBeTruthy();
      expect(meta!.defaultModel).toBeTruthy();
      expect(meta!.defaultTemperature).toBeGreaterThanOrEqual(0);
      if (meta!.taskType !== 'transcription') {
        expect(meta!.defaultMaxTokens).toBeGreaterThan(0);
      }
    }
  });

  it('requireFeatureMeta throws for unknown key', () => {
    expect(() => requireFeatureMeta('unknown.feature' as AIFeatureKey)).toThrow();
  });

  it('isValidFeatureKey returns true for valid keys', () => {
    expect(isValidFeatureKey('followup.generate')).toBe(true);
    expect(isValidFeatureKey('message.rewrite')).toBe(true);
    expect(isValidFeatureKey('audio.transcribe')).toBe(true);
  });

  it('isValidFeatureKey returns false for invalid keys', () => {
    expect(isValidFeatureKey('invalid')).toBe(false);
    expect(isValidFeatureKey('')).toBe(false);
  });

  it('each feature has at least one available variable or is transcription', () => {
    const keys = getAllFeatureKeys();
    for (const key of keys) {
      const meta = getFeatureMeta(key)!;
      if (meta.taskType === 'transcription') {
        expect(meta.availableVariables).toHaveLength(0);
      } else {
        expect(meta.availableVariables.length).toBeGreaterThan(0);
        expect(meta.defaultMaxTokens).toBeGreaterThan(0);
      }
    }
  });

  it('feature keys are stable strings (not numbers or symbols)', () => {
    const keys = getAllFeatureKeys();
    for (const key of keys) {
      expect(typeof key).toBe('string');
      expect(key).toMatch(/^[a-z]+\.[a-z_]+$/);
    }
  });

  it('FOLLOWUP_GENERATE defaults match current production values', () => {
    const meta = AI_FEATURE_META[AI_FEATURES.FOLLOWUP_GENERATE];
    expect(meta.defaultProvider).toBe('openai');
    expect(meta.defaultModel).toBe('gpt-4o-mini');
    expect(meta.defaultTemperature).toBe(0.5);
    expect(meta.defaultMaxTokens).toBe(520);
  });

  it('FOLLOWUP_ANALYSIS defaults match current production values', () => {
    const meta = AI_FEATURE_META[AI_FEATURES.FOLLOWUP_ANALYSIS];
    expect(meta.defaultProvider).toBe('openai');
    expect(meta.defaultTemperature).toBe(0.3);
    expect(meta.defaultMaxTokens).toBe(900);
  });

  it('AUDIO_TRANSCRIBE has empty variables (transcription has no template vars)', () => {
    const meta = AI_FEATURE_META[AI_FEATURES.AUDIO_TRANSCRIBE];
    expect(meta.taskType).toBe('transcription');
    expect(meta.availableVariables).toHaveLength(0);
  });

  it('CAMPAIGN_INTENT uses low temperature for classification', () => {
    const meta = AI_FEATURE_META[AI_FEATURES.CAMPAIGN_INTENT];
    expect(meta.defaultTemperature).toBe(0.1);
  });

  it('AGENDA_ORGANIZE has high maxTokens for batch scoring', () => {
    const meta = AI_FEATURE_META[AI_FEATURES.AGENDA_ORGANIZE];
    expect(meta.defaultMaxTokens).toBe(1800);
  });
});
