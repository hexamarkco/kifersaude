export type TextGenerationTask =
  | 'rewrite_message'
  | 'follow_up_generation'
  | 'follow_up_analysis'
  | 'whatsapp_audio_transcription'
  | 'follow_up_agenda_organization'
  | 'attendance_critique'
  | 'autonomous_attendance';

export type OpenAiTokenParameter = 'max_tokens' | 'max_completion_tokens';
export const AI_REASONING_EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
export type AiReasoningEffort = typeof AI_REASONING_EFFORTS[number];
export type OpenAiReasoningEffort = AiReasoningEffort;

export type OpenAiRequestProfile = {
  tokenParameter: OpenAiTokenParameter;
  reasoningEffort?: OpenAiReasoningEffort;
  supportedReasoningEfforts: readonly OpenAiReasoningEffort[];
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

const OPENAI_REASONING_EFFORTS = {
  gpt56: ['none', 'low', 'medium', 'high', 'xhigh', 'max'],
  modern: ['none', 'low', 'medium', 'high'],
  classic: ['minimal', 'low', 'medium', 'high'],
  future: ['low', 'medium', 'high', 'xhigh', 'max'],
  pro: ['high'],
} as const satisfies Record<string, readonly OpenAiReasoningEffort[]>;

export const getOpenAiSupportedReasoningEfforts = (model: string): readonly OpenAiReasoningEffort[] => {
  const normalized = normalizedModel(model);

  if (isOpenAiProModel(normalized)) return OPENAI_REASONING_EFFORTS.pro;
  if (normalized.startsWith('gpt-5.6') || normalized.startsWith('gpt-5.5')) {
    return OPENAI_REASONING_EFFORTS.gpt56;
  }
  if (isOpenAiModernReasoningModel(normalized)) return OPENAI_REASONING_EFFORTS.modern;
  if (/^gpt-(?:[6-9]|\d{2,})(?:[.-]|$)/.test(normalized)) return OPENAI_REASONING_EFFORTS.future;
  if (
    normalized === 'gpt-5' ||
    normalized.startsWith('gpt-5-') ||
    normalized.startsWith('o1') ||
    normalized.startsWith('o3') ||
    normalized.startsWith('o4')
  ) {
    return OPENAI_REASONING_EFFORTS.classic;
  }

  return [];
};

const chooseOpenAiReasoningEffort = (
  supported: readonly OpenAiReasoningEffort[],
  task: TextGenerationTask,
  requested?: AiReasoningEffort | null,
): OpenAiReasoningEffort | undefined => {
  if (requested && supported.includes(requested)) return requested;
  if (supported.length === 0) return undefined;
  if (supported.length === 1) return supported[0];
  if (!isDeepReasoningTask(task) && supported.includes('none')) return 'none';
  if (supported.includes('low')) return 'low';
  return supported[0];
};

/**
 * Resolves the request fields supported by an OpenAI model family before the
 * first HTTP request. Provider-error negotiation remains a compatibility net,
 * not the normal mechanism for discovering model parameters.
 */
export const resolveOpenAiRequestProfile = (
  model: string,
  task: TextGenerationTask,
  requestedReasoningEffort?: AiReasoningEffort | null,
): OpenAiRequestProfile => {
  const normalized = normalizedModel(model);
  const supportedReasoningEfforts = getOpenAiSupportedReasoningEfforts(normalized);
  const reasoningEffort = chooseOpenAiReasoningEffort(supportedReasoningEfforts, task, requestedReasoningEffort);

  if (isOpenAiProModel(normalized)) {
    return {
      tokenParameter: 'max_completion_tokens',
      reasoningEffort,
      supportedReasoningEfforts,
      supportsTemperature: false,
    };
  }

  if (/^gpt-(?:[6-9]|\d{2,})(?:[.-]|$)/.test(normalized)) {
    return {
      tokenParameter: 'max_completion_tokens',
      reasoningEffort,
      supportedReasoningEfforts,
      supportsTemperature: false,
    };
  }

  if (isOpenAiModernReasoningModel(normalized)) {
    return {
      tokenParameter: 'max_completion_tokens',
      reasoningEffort,
      supportedReasoningEfforts,
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
      reasoningEffort,
      supportedReasoningEfforts,
      supportsTemperature: false,
    };
  }

  return {
    tokenParameter: 'max_tokens',
    supportedReasoningEfforts,
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
