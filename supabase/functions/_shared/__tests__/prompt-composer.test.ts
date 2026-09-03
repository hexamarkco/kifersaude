import { describe, expect, it } from 'vitest';
import { listAvailableVariables } from '../prompt-composer.ts';
import { AI_FEATURES, AI_FEATURE_META, type AIFeatureKey } from '../ai-feature-registry.ts';

describe('Prompt Composer — listAvailableVariables', () => {
  it('returns variables for followup.generate', () => {
    const vars = listAvailableVariables(AI_FEATURES.FOLLOWUP_GENERATE);
    expect(vars.length).toBeGreaterThan(0);
    const keys = vars.map((v) => v.key);
    expect(keys).toContain('transcript');
    expect(keys).toContain('temporal_facts');
    expect(keys).toContain('lead_context');
  });

  it('returns empty array for transcription (no template vars)', () => {
    const vars = listAvailableVariables(AI_FEATURES.AUDIO_TRANSCRIBE);
    expect(vars).toHaveLength(0);
  });

  it('returns variables for message.rewrite', () => {
    const vars = listAvailableVariables(AI_FEATURES.MESSAGE_REWRITE);
    const keys = vars.map((v) => v.key);
    expect(keys).toContain('original_text');
    expect(keys).toContain('adjustment');
    expect(keys).toContain('tone');
  });

  it('returns variables for autonomous.reply', () => {
    const vars = listAvailableVariables(AI_FEATURES.AUTONOMOUS_REPLY);
    const keys = vars.map((v) => v.key);
    expect(keys).toContain('transcript');
    expect(keys).toContain('lead_context');
    expect(keys).toContain('style_profile');
  });

  it('returns empty for unknown feature key', () => {
    const vars = listAvailableVariables('unknown.feature' as AIFeatureKey);
    expect(vars).toHaveLength(0);
  });

  it('every variable has key, label, and description', () => {
    const allKeys = Object.values(AI_FEATURES);
    for (const featureKey of allKeys) {
      const vars = listAvailableVariables(featureKey);
      for (const v of vars) {
        expect(typeof v.key).toBe('string');
        expect(v.key.length).toBeGreaterThan(0);
        expect(typeof v.label).toBe('string');
        expect(v.label.length).toBeGreaterThan(0);
        expect(typeof v.description).toBe('string');
        expect(v.description.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('AI Feature Meta — consistency checks', () => {
  it('all features map to valid ai-router tasks', () => {
    const validTasks = new Set([
      'rewrite_message',
      'follow_up_generation',
      'follow_up_analysis',
      'whatsapp_audio_transcription',
      'follow_up_agenda_organization',
      'attendance_critique',
      'autonomous_attendance',
    ]);

    const allKeys = Object.values(AI_FEATURES);
    for (const featureKey of allKeys) {
      const meta = AI_FEATURE_META[featureKey];
      expect(validTasks.has(meta.aiTask)).toBe(true);
    }
  });

  it('temperature is always between 0 and 1 for text features', () => {
    const allKeys = Object.values(AI_FEATURES);
    for (const featureKey of allKeys) {
      const meta = AI_FEATURE_META[featureKey];
      if (meta.taskType !== 'transcription') {
        expect(meta.defaultTemperature).toBeGreaterThanOrEqual(0);
        expect(meta.defaultTemperature).toBeLessThanOrEqual(1);
      }
    }
  });

  it('maxOutputTokens is positive for text features', () => {
    const allKeys = Object.values(AI_FEATURES);
    for (const featureKey of allKeys) {
      const meta = AI_FEATURE_META[featureKey];
      if (meta.taskType !== 'transcription') {
        expect(meta.defaultMaxTokens).toBeGreaterThan(0);
      }
    }
  });

  it('defaultContextConfig is a non-empty object for non-transcription features', () => {
    const allKeys = Object.values(AI_FEATURES);
    for (const featureKey of allKeys) {
      const meta = AI_FEATURE_META[featureKey];
      if (meta.taskType !== 'transcription') {
        expect(Object.keys(meta.defaultContextConfig).length).toBeGreaterThan(0);
      }
    }
  });
});
