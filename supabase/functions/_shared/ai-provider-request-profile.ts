export type TextGenerationTask =
  | 'rewrite_message'
  | 'follow_up_generation'
  | 'follow_up_analysis'
  | 'whatsapp_audio_transcription'
  | 'follow_up_agenda_organization'
  | 'attendance_critique'
  | 'autonomous_attendance';

export type OpenAiTokenParameter = 'max_tokens' | 'max_completion_tokens';
export type OpenAiReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export type OpenAiRequestProfile = {
  tokenParameter: OpenAiTokenParameter;
  reasoningEffort?: OpenAiReasoningEffort;
  supportsTemperature: boolean;
};

export type ClaudeRequestProfile = {
  supportsTemperature: boolean;
};

export type GeminiRequestProfile = {
  supportsTemperature: boolean;
  maxTemperature: number;
};

const DEEP_REASONING_TASKS: ReadonlySet<TextGenerationTask> = new Set([
  'follow_up_generation',
  'follow_up_analysis',
  'attendance_critique',
  'autonomous_attendance',
]);

const normalizedModel = (model: string): string => model.trim().toLowerCase();

const isDeepReasoningTask = (task: TextGenerationTask): boolean => DEEP_REASONING_TASKS.has(task);

const isOpenAiProModel = (model: string): boolean =>
  /(^|-)pro($|-)/.test(model) && (model.startsWith('gpt-5') || /^o[134]/.test(model));

const isOpenAiModernReasoningModel = (model: string): boolean =>
  /^gpt-5\.(?:[1-9]\d*)(?:-|$)/.test(model);

/**
 * Resolves the request fields supported by an OpenAI model family before the
 * first HTTP request. Provider-error negotiation remains a compatibility net,
 * not the normal mechanism for discovering model parameters.
 */
export const resolveOpenAiRequestProfile = (
  model: string,
  task: TextGenerationTask,
): OpenAiRequestProfile => {
  const normalized = normalizedModel(model);

  if (isOpenAiProModel(normalized)) {
    return {
      tokenParameter: 'max_completion_tokens',
      reasoningEffort: 'high',
      supportsTemperature: false,
    };
  }

  if (/^gpt-(?:[6-9]|\d{2,})(?:[.-]|$)/.test(normalized)) {
    return {
      tokenParameter: 'max_completion_tokens',
      reasoningEffort: isDeepReasoningTask(task) ? 'medium' : 'low',
      supportsTemperature: false,
    };
  }

  if (isOpenAiModernReasoningModel(normalized)) {
    const reasoningEffort: OpenAiReasoningEffort = isDeepReasoningTask(task) ? 'low' : 'none';
    return {
      tokenParameter: 'max_completion_tokens',
      reasoningEffort,
      supportsTemperature: reasoningEffort === 'none',
    };
  }

  if (
    normalized === 'gpt-5' ||
    normalized.startsWith('gpt-5-') ||
    normalized.startsWith('o1') ||
    normalized.startsWith('o3') ||
    normalized.startsWith('o4')
  ) {
    return {
      tokenParameter: 'max_completion_tokens',
      reasoningEffort: isDeepReasoningTask(task) ? 'medium' : 'low',
      supportsTemperature: false,
    };
  }

  return {
    tokenParameter: 'max_tokens',
    supportsTemperature: true,
  };
};

/** Claude deprecated sampling controls and newer families reject custom values. */
export const resolveClaudeRequestProfile = (model: string): ClaudeRequestProfile => {
  const normalized = normalizedModel(model);
  const isNewSamplingApi =
    /^claude-(?:opus-)?4[.-](?:7|8)(?:-|$)/.test(normalized) ||
    /^claude-(?:sonnet|opus|haiku|fable|mythos)-5(?:-|$)/.test(normalized) ||
    /^claude-5(?:-|$)/.test(normalized);

  return { supportsTemperature: !isNewSamplingApi };
};

/** Gemini's generateContent API accepts temperature up to the model-reported cap. */
export const resolveGeminiRequestProfile = (_model: string): GeminiRequestProfile => ({
  supportsTemperature: true,
  maxTemperature: 2,
});

export const clampTemperature = (temperature: number, maximum: number): number =>
  Math.min(maximum, Math.max(0, temperature));
