/* eslint-disable @typescript-eslint/no-explicit-any */
export type AiProvider = 'openai' | 'gemini' | 'claude';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

export type AiTask = 'rewrite_message' | 'follow_up_generation' | 'follow_up_analysis' | 'whatsapp_audio_transcription' | 'follow_up_agenda_organization' | 'attendance_critique' | 'autonomous_attendance';

type ProviderSettings = {
  enabled: boolean;
  apiKey: string;
  defaultModelText: string;
  defaultModelTranscription: string;
  baseUrl: string;
};

type TaskRouting = {
  provider: AiProvider;
  model: string;
  fallbackToOpenAi: boolean;
};

type AiRuntimeConfig = {
  providers: Record<AiProvider, ProviderSettings>;
  routing: Record<AiTask, TaskRouting>;
  fallbackEnabled: boolean;
  fallbackProvider: AiProvider;
};

type ProviderCallParams = {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  task: AiTask;
};

type OpenAiMessage = {
  role: 'system' | 'user';
  content: string;
};

type OpenAiTokenParameter = 'max_tokens' | 'max_completion_tokens';
type OpenAiReasoningEffort = 'none' | 'minimal';

type OpenAiChatRequestBody = {
  model: string;
  messages: OpenAiMessage[];
  temperature?: number;
  reasoning_effort?: OpenAiReasoningEffort;
  max_tokens?: number;
  max_completion_tokens?: number;
};

type IntegrationRow = {
  slug: string;
  settings: Record<string, unknown> | null;
};

type GenerateTextWithRoutingOptions = {
  supabaseAdmin: any;
  task: AiTask;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  preferDefaultModel?: boolean;
};

type TranscribeAudioWithRoutingOptions = {
  supabaseAdmin: any;
  audioBlob: Blob;
  fileName?: string;
  mimeType?: string;
  prompt?: string;
};

export type GenerateTextWithRoutingResult = {
  text: string;
  provider: AiProvider;
  model: string;
  fallbackUsed: boolean;
};

export type TranscribeAudioWithRoutingResult = {
  text: string;
  provider: AiProvider;
  model: string;
  fallbackUsed: boolean;
};

// ============================================================
// Telemetry types
// ============================================================

export type ProviderUsage = {
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  totalTokens: number | null;
};

export type ProviderCallResult = {
  text: string;
  usage: ProviderUsage;
};

export type ModelResolutionSource = 'feature' | 'ai_routing' | 'provider_default' | 'fallback';

export type ResolvedModel = {
  provider: AiProvider;
  model: string;
  source: ModelResolutionSource;
};

export type AiCallLogContext = {
  featureKey: string;
  aiTask: AiTask;
  edgeFunction?: string;
  leadId?: string;
  chatId?: string;
  messageId?: string;
};

export type GenerateTextForFeatureOptions = {
  supabaseAdmin: any;
  featureKey: string;
  task: AiTask;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  edgeFunction?: string;
  leadId?: string;
  chatId?: string;
  messageId?: string;
};

export type GenerateTextForFeatureResult = {
  text: string;
  provider: AiProvider;
  model: string;
  source: ModelResolutionSource;
  fallbackUsed: boolean;
  usage: ProviderUsage;
  durationMs: number;
  estimatedCostUsd: number | null;
  callLogId: string | null;
};

const LEGACY_GPT_SLUG = 'gpt_transcription';
const OPENAI_SLUG = 'ai_provider_openai';
const GEMINI_SLUG = 'ai_provider_gemini';
const CLAUDE_SLUG = 'ai_provider_claude';
const AI_ROUTING_SLUG = 'ai_routing';

const OPENAI_DEFAULT_TEXT_MODEL = 'gpt-4o-mini';
const OPENAI_DEFAULT_TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe';
const GEMINI_DEFAULT_TEXT_MODEL = 'gemini-2.0-flash';
const GEMINI_DEFAULT_TRANSCRIPTION_MODEL = GEMINI_DEFAULT_TEXT_MODEL;
const CLAUDE_DEFAULT_TEXT_MODEL = 'claude-3-5-sonnet-latest';
const CLAUDE_DEFAULT_TRANSCRIPTION_MODEL = CLAUDE_DEFAULT_TEXT_MODEL;

const AI_TASKS: AiTask[] = ['rewrite_message', 'follow_up_generation', 'follow_up_analysis', 'whatsapp_audio_transcription', 'follow_up_agenda_organization', 'attendance_critique', 'autonomous_attendance'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toTrimmedString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const normalizeModelName = (value: string): string => value.trim().toLowerCase();

const isOpenAiTranscriptionModel = (model: string): boolean => {
  const normalized = normalizeModelName(model);
  return normalized === 'whisper-1' || normalized.includes('transcribe');
};

const isOpenAiTextModel = (model: string): boolean => {
  const normalized = normalizeModelName(model);
  return Boolean(normalized) && !isOpenAiTranscriptionModel(normalized);
};

const toBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  return fallback;
};

const isAiProvider = (value: string): value is AiProvider => value === 'openai' || value === 'gemini' || value === 'claude';

export const getAiProviderApiKey = (provider: AiProvider): string => {
  const secretName =
    provider === 'openai'
      ? 'OPENAI_API_KEY'
      : provider === 'gemini'
        ? 'GEMINI_API_KEY'
        : 'ANTHROPIC_API_KEY';

  return Deno.env.get(secretName)?.trim() || '';
};

const getTaskDefaultModel = (task: AiTask, provider: AiProvider, settings: ProviderSettings): string => {
  if (task === 'whatsapp_audio_transcription') {
    if (provider === 'openai') {
      return settings.defaultModelTranscription || OPENAI_DEFAULT_TRANSCRIPTION_MODEL;
    }

    return settings.defaultModelTranscription || settings.defaultModelText;
  }

  return settings.defaultModelText;
};

const getCompatibleTaskModel = (
  task: AiTask,
  provider: AiProvider,
  settings: ProviderSettings,
  model: string,
): string => {
  const candidate = toTrimmedString(model) || getTaskDefaultModel(task, provider, settings);

  if (provider !== 'openai') {
    return candidate;
  }

  if (task === 'whatsapp_audio_transcription') {
    return isOpenAiTranscriptionModel(candidate) ? candidate : OPENAI_DEFAULT_TRANSCRIPTION_MODEL;
  }

  return isOpenAiTextModel(candidate) ? candidate : OPENAI_DEFAULT_TEXT_MODEL;
};

const normalizeProviderSettings = (
  provider: AiProvider,
  settings: Record<string, unknown>,
  legacySettings: Record<string, unknown>,
): ProviderSettings => {
  const legacyTextModel =
    toTrimmedString(legacySettings.textModel) || toTrimmedString(legacySettings.model) || OPENAI_DEFAULT_TEXT_MODEL;

  const apiKey = getAiProviderApiKey(provider);

  const defaultModelText =
    toTrimmedString(settings.defaultModelText) ||
    toTrimmedString(settings.textModel) ||
    toTrimmedString(settings.model) ||
    (provider === 'openai'
      ? legacyTextModel
      : provider === 'gemini'
        ? GEMINI_DEFAULT_TEXT_MODEL
        : CLAUDE_DEFAULT_TEXT_MODEL);

  const defaultModelTranscription =
    toTrimmedString(settings.defaultModelTranscription) ||
    toTrimmedString(settings.transcriptionModel) ||
    (provider === 'openai'
      ? OPENAI_DEFAULT_TRANSCRIPTION_MODEL
      : provider === 'gemini'
        ? GEMINI_DEFAULT_TRANSCRIPTION_MODEL
        : CLAUDE_DEFAULT_TRANSCRIPTION_MODEL);

  const baseUrl = toTrimmedString(settings.baseUrl) || 'https://api.openai.com/v1';

  const hasApiKey = apiKey.length > 0;
  const enabled =
    typeof settings.enabled === 'boolean'
      ? settings.enabled
      : provider === 'openai'
        ? hasApiKey
        : toBoolean(settings.enabled, false);

  return {
    enabled,
    apiKey,
    defaultModelText,
    defaultModelTranscription,
    baseUrl,
  };
};

const normalizeTaskRouting = (
  task: AiTask,
  value: unknown,
  providers: Record<AiProvider, ProviderSettings>,
  fallbackEnabled: boolean,
): TaskRouting => {
  const settings = isRecord(value) ? value : {};
  const providerCandidate = toTrimmedString(settings.provider).toLowerCase();
  const provider = isAiProvider(providerCandidate) ? providerCandidate : 'openai';

  const modelCandidate = toTrimmedString(settings.model) || toTrimmedString(settings.textModel);
  const model = modelCandidate || getTaskDefaultModel(task, provider, providers[provider]);
  const fallbackToOpenAi =
    typeof settings.fallbackToOpenAi === 'boolean' ? settings.fallbackToOpenAi : fallbackEnabled;

  return {
    provider,
    model,
    fallbackToOpenAi,
  };
};

const loadAiRuntimeConfig = async (supabaseAdmin: any): Promise<AiRuntimeConfig> => {
  const { data, error } = await supabaseAdmin
    .from('integration_settings')
    .select('slug, settings')
    .in('slug', [OPENAI_SLUG, GEMINI_SLUG, CLAUDE_SLUG, AI_ROUTING_SLUG, LEGACY_GPT_SLUG]);

  if (error) {
    throw new Error(`Falha ao carregar configuracoes de IA: ${error.message}`);
  }

  const integrationMap = new Map<string, Record<string, unknown>>();
  for (const row of (data ?? []) as IntegrationRow[]) {
    integrationMap.set(row.slug, isRecord(row.settings) ? row.settings : {});
  }

  const legacySettings = integrationMap.get(LEGACY_GPT_SLUG) ?? {};

  const providers: Record<AiProvider, ProviderSettings> = {
    openai: normalizeProviderSettings('openai', integrationMap.get(OPENAI_SLUG) ?? {}, legacySettings),
    gemini: normalizeProviderSettings('gemini', integrationMap.get(GEMINI_SLUG) ?? {}, legacySettings),
    claude: normalizeProviderSettings('claude', integrationMap.get(CLAUDE_SLUG) ?? {}, legacySettings),
  };

  const routingSettings = integrationMap.get(AI_ROUTING_SLUG) ?? {};
  const fallbackEnabled = toBoolean(routingSettings.fallbackEnabled, true);
  const fallbackProviderCandidate = toTrimmedString(routingSettings.fallbackProvider).toLowerCase();
  const fallbackProvider = isAiProvider(fallbackProviderCandidate) ? fallbackProviderCandidate : 'openai';

  const rawTasks = isRecord(routingSettings.tasks) ? routingSettings.tasks : {};

  const routing: Record<AiTask, TaskRouting> = {
    rewrite_message: normalizeTaskRouting('rewrite_message', rawTasks.rewrite_message, providers, fallbackEnabled),
    follow_up_generation: normalizeTaskRouting('follow_up_generation', rawTasks.follow_up_generation, providers, fallbackEnabled),
    follow_up_analysis: normalizeTaskRouting('follow_up_analysis', rawTasks.follow_up_analysis, providers, fallbackEnabled),
    follow_up_agenda_organization: normalizeTaskRouting(
      'follow_up_agenda_organization',
      rawTasks.follow_up_agenda_organization,
      providers,
      fallbackEnabled,
    ),
    whatsapp_audio_transcription: normalizeTaskRouting(
      'whatsapp_audio_transcription',
      rawTasks.whatsapp_audio_transcription,
      providers,
      fallbackEnabled,
    ),
    attendance_critique: normalizeTaskRouting(
      'attendance_critique',
      rawTasks.attendance_critique,
      providers,
      fallbackEnabled,
    ),
    autonomous_attendance: normalizeTaskRouting(
      'autonomous_attendance',
      rawTasks.autonomous_attendance,
      providers,
      fallbackEnabled,
    ),
  };

  return {
    providers,
    routing,
    fallbackEnabled,
    fallbackProvider,
  };
};

const extractOpenAiText = (payload: any): string => {
  const direct = payload?.choices?.[0]?.message?.content;
  if (typeof direct === 'string') {
    return direct.trim();
  }

  if (Array.isArray(direct)) {
    const joined = direct
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();
    if (joined) return joined;
  }

  return '';
};

const getPreferredOpenAiTokenParameter = (model: string): OpenAiTokenParameter => {
  const normalized = model.trim().toLowerCase();

  if (
    normalized.startsWith('gpt-5') ||
    normalized.startsWith('o1') ||
    normalized.startsWith('o3') ||
    normalized.startsWith('o4')
  ) {
    return 'max_completion_tokens';
  }

  return 'max_tokens';
};

const getAlternateOpenAiTokenParameter = (value: OpenAiTokenParameter): OpenAiTokenParameter =>
  value === 'max_tokens' ? 'max_completion_tokens' : 'max_tokens';

// Tarefas que precisam interpretar o contexto em varias etapas antes de
// escrever (ler a conversa, entender o momento, a pessoa, so entao decidir
// tom/abordagem) sofrem muito com reasoning_effort "none": o modelo pula
// direto para uma resposta plausivel na superficie sem executar o raciocinio
// que o prompt pede. Tarefas mais mecanicas (reescrever um texto dado,
// organizar agenda) continuam com esforco minimo por velocidade/custo.
const DEEP_REASONING_TASKS: ReadonlySet<AiTask> = new Set(['follow_up_generation', 'follow_up_analysis', 'attendance_critique', 'autonomous_attendance']);

const getPreferredOpenAiReasoningEffort = (model: string, task: AiTask): OpenAiReasoningEffort | undefined => {
  const normalized = model.trim().toLowerCase();
  const needsDeepReasoning = DEEP_REASONING_TASKS.has(task);

  if (
    normalized.startsWith('gpt-5.5') ||
    normalized.startsWith('gpt-5.4') ||
    normalized.startsWith('gpt-5.2') ||
    normalized.startsWith('gpt-5.1')
  ) {
    return needsDeepReasoning ? 'minimal' : 'none';
  }

  if (
    normalized === 'gpt-5' ||
    normalized.startsWith('gpt-5-') ||
    normalized.startsWith('o1') ||
    normalized.startsWith('o3') ||
    normalized.startsWith('o4')
  ) {
    return 'minimal';
  }

  return undefined;
};

const buildOpenAiChatRequestBody = (
  params: ProviderCallParams,
  messages: OpenAiMessage[],
  tokenParameter: OpenAiTokenParameter,
  includeTemperature: boolean,
  reasoningEffort?: OpenAiReasoningEffort,
): OpenAiChatRequestBody => {
  const body: OpenAiChatRequestBody = {
    model: params.model,
    messages,
  };

  if (includeTemperature) {
    body.temperature = params.temperature;
  }

  if (reasoningEffort) {
    body.reasoning_effort = reasoningEffort;
  }

  if (tokenParameter === 'max_completion_tokens') {
    body.max_completion_tokens = params.maxTokens;
  } else {
    body.max_tokens = params.maxTokens;
  }

  return body;
};

const isUnsupportedOpenAiParameterError = (errorText: string, parameter: string): boolean => {
  const normalized = errorText.toLowerCase();
  const expected = parameter.toLowerCase();
  const hasCompatibilityError =
    normalized.includes('unsupported parameter') ||
    normalized.includes('unsupported value') ||
    normalized.includes('"code":"unsupported_parameter"') ||
    normalized.includes('"code":"unsupported_value"');

  return (
    hasCompatibilityError &&
    (normalized.includes(`'${expected}'`) ||
      normalized.includes(`"${expected}"`) ||
      normalized.includes(`"param": "${expected}"`) ||
      normalized.includes(`"param":"${expected}"`))
  );
};

const extractClaudeText = (payload: any): string => {
  if (!Array.isArray(payload?.content)) {
    return '';
  }

  return payload.content
    .map((part: any) => (part?.type === 'text' && typeof part?.text === 'string' ? part.text : ''))
    .join('')
    .trim();
};

const extractGeminiText = (payload: any): string => {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    const collected = parts
      .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();

    if (collected) {
      return collected;
    }
  }

  return '';
};

const callOpenAi = async (settings: ProviderSettings, params: ProviderCallParams): Promise<ProviderCallResult> => {
  const endpointBase = settings.baseUrl.replace(/\/+$/, '');
  const endpoint = `${endpointBase}/chat/completions`;

  const messages: OpenAiMessage[] = [];
  if (params.systemPrompt.trim()) {
    messages.push({ role: 'system', content: params.systemPrompt });
  }
  messages.push({ role: 'user', content: params.userPrompt });

  let tokenParameter = getPreferredOpenAiTokenParameter(params.model);
  let includeTemperature = true;
  let reasoningEffort = getPreferredOpenAiReasoningEffort(params.model, params.task);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify(buildOpenAiChatRequestBody(params, messages, tokenParameter, includeTemperature, reasoningEffort)),
    });

    if (response.ok) {
      const payload = await response.json().catch(() => ({}));
      const text = extractOpenAiText(payload);
      if (!text) {
        throw new Error('OpenAI retornou resposta vazia.');
      }

      const usage = payload?.usage;
      return {
        text,
        usage: {
          inputTokens: usage?.prompt_tokens ?? null,
          cachedInputTokens: usage?.cached_tokens ?? null,
          outputTokens: usage?.completion_tokens ?? null,
          reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens ?? null,
          totalTokens: usage?.total_tokens ?? null,
        },
      };
    }

    const errorText = await response.text();

    if (response.status === 400) {
      if (isUnsupportedOpenAiParameterError(errorText, tokenParameter)) {
        tokenParameter = getAlternateOpenAiTokenParameter(tokenParameter);
        continue;
      }

      if (includeTemperature && isUnsupportedOpenAiParameterError(errorText, 'temperature')) {
        includeTemperature = false;
        continue;
      }

      if (reasoningEffort && isUnsupportedOpenAiParameterError(errorText, 'reasoning_effort')) {
        reasoningEffort = undefined;
        continue;
      }
    }

    throw new Error(`OpenAI retornou erro HTTP ${response.status}: ${errorText}`);
  }

  const fallbackTokenParameter = tokenParameter;
  const fallbackTemperatureStatus = includeTemperature ? 'com temperatura' : 'sem temperatura';
  const fallbackReasoningEffort = reasoningEffort ? `reasoning ${reasoningEffort}` : 'sem reasoning_effort';
  throw new Error(
    `OpenAI nao aceitou a combinacao de parametros enviada (${fallbackTokenParameter}, ${fallbackTemperatureStatus}, ${fallbackReasoningEffort}).`,
  );
};

const stripMimeParameters = (value: string): string => value.split(';')[0]?.trim() || value.trim();

const MIME_TO_EXT: Record<string, string> = {
  'audio/flac': '.flac',
  'audio/m4a': '.m4a',
  'audio/mp4': '.mp4',
  'audio/mpeg': '.mp3',
  'audio/mpga': '.mpga',
  'audio/oga': '.oga',
  'audio/ogg': '.ogg',
  'audio/wav': '.wav',
  'audio/wave': '.wav',
  'audio/webm': '.webm',
  'audio/x-m4a': '.m4a',
  'audio/x-wav': '.wav',
  'audio/aac': '.aac',
};

const mimeTypeToExtension = (mimeType: string): string => {
  const clean = stripMimeParameters(mimeType).toLowerCase();
  return MIME_TO_EXT[clean] || '.ogg';
};

const callOpenAiTranscription = async (
  settings: ProviderSettings,
  params: { model: string; audioBlob: Blob; fileName?: string; mimeType?: string; prompt?: string },
): Promise<string> => {
  const endpointBase = settings.baseUrl.replace(/\/+$/, '');
  const endpoint = `${endpointBase}/audio/transcriptions`;
  const formData = new FormData();

  const rawMimeType = params.mimeType?.trim() || params.audioBlob.type || 'audio/ogg';
  const cleanMimeType = stripMimeParameters(rawMimeType).toLowerCase();
  const mimeType = cleanMimeType === 'audio/oga' ? 'audio/ogg' : cleanMimeType;
  const baseFileName = params.fileName?.trim() || `whatsapp-audio`;
  const rawFileName = /\.\w+$/.test(baseFileName) ? baseFileName : `${baseFileName}${mimeTypeToExtension(mimeType)}`;
  const fileName = /\.oga$/i.test(rawFileName) ? rawFileName.replace(/\.oga$/i, '.ogg') : rawFileName;
  const normalizedBlob = params.audioBlob.slice(0, params.audioBlob.size, mimeType);

  formData.append('file', normalizedBlob, fileName);
  formData.append('model', params.model);

  if (params.prompt?.trim()) {
    formData.append('prompt', params.prompt.trim());
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI retornou erro HTTP ${response.status}: ${errorText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const payload = await response.json().catch(() => ({}));
    const text =
      typeof payload?.text === 'string'
        ? payload.text.trim()
        : typeof payload?.transcript === 'string'
          ? payload.transcript.trim()
          : '';

    if (!text) {
      throw new Error('OpenAI retornou transcricao vazia.');
    }

    return text;
  }

  const text = (await response.text()).trim();
  if (!text) {
    throw new Error('OpenAI retornou transcricao vazia.');
  }

  return text;
};

const callClaude = async (settings: ProviderSettings, params: ProviderCallParams): Promise<ProviderCallResult> => {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens,
      temperature: params.temperature,
      system: params.systemPrompt,
      messages: [{ role: 'user', content: params.userPrompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude retornou erro HTTP ${response.status}: ${errorText}`);
  }

  const payload = await response.json().catch(() => ({}));
  const text = extractClaudeText(payload);
  if (!text) {
    throw new Error('Claude retornou resposta vazia.');
  }

  const usage = payload?.usage;
  return {
    text,
    usage: {
      inputTokens: usage?.input_tokens ?? null,
      cachedInputTokens: usage?.cache_read_input_tokens ?? null,
      outputTokens: usage?.output_tokens ?? null,
      reasoningTokens: null,
      totalTokens: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
    },
  };
};

const callGemini = async (settings: ProviderSettings, params: ProviderCallParams): Promise<ProviderCallResult> => {
  const normalizedModel = params.model.startsWith('models/') ? params.model : `models/${params.model}`;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/${normalizedModel}:generateContent?key=${encodeURIComponent(
    settings.apiKey,
  )}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: params.systemPrompt
        ? {
            parts: [{ text: params.systemPrompt }],
          }
        : undefined,
      contents: [
        {
          role: 'user',
          parts: [{ text: params.userPrompt }],
        },
      ],
      generationConfig: {
        temperature: params.temperature,
        maxOutputTokens: params.maxTokens,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini retornou erro HTTP ${response.status}: ${errorText}`);
  }

  const payload = await response.json().catch(() => ({}));
  const text = extractGeminiText(payload);
  if (!text) {
    throw new Error('Gemini retornou resposta vazia.');
  }

  const usage = payload?.usageMetadata;
  return {
    text,
    usage: {
      inputTokens: usage?.promptTokenCount ?? null,
      cachedInputTokens: null,
      outputTokens: usage?.candidatesTokenCount ?? null,
      reasoningTokens: null,
      totalTokens: usage?.totalTokenCount ?? null,
    },
  };
};

const callProvider = async (
  provider: AiProvider,
  settings: ProviderSettings,
  params: ProviderCallParams,
): Promise<ProviderCallResult> => {
  if (provider === 'openai') {
    return callOpenAi(settings, params);
  }

  if (provider === 'gemini') {
    return callGemini(settings, params);
  }

  return callClaude(settings, params);
};

const callProviderTranscription = async (
  provider: AiProvider,
  settings: ProviderSettings,
  params: { model: string; audioBlob: Blob; fileName?: string; mimeType?: string; prompt?: string },
): Promise<string> => {
  if (provider === 'openai') {
    return callOpenAiTranscription(settings, params);
  }

  throw new Error(`Transcricao de audio nao suportada pelo provedor ${provider}.`);
};

// ============================================================
// Pricing cache + cost calculation
// ============================================================

type ModelPricingRow = {
  model: string;
  provider: string;
  input_per_million: number;
  cached_input_per_million: number | null;
  output_per_million: number;
  is_transcription: boolean;
  transcription_per_minute: number | null;
};

const PRICING_CACHE_TTL_MS = 300_000; // 5 minutes
let pricingCache: Map<string, ModelPricingRow> = new Map();
let pricingCacheExpiresAt = 0;

const loadPricingCache = async (supabaseAdmin: any): Promise<Map<string, ModelPricingRow>> => {
  if (pricingCache.size > 0 && Date.now() < pricingCacheExpiresAt) {
    return pricingCache;
  }

  try {
    const { data } = await supabaseAdmin
      .from('ai_model_pricing')
      .select('model, provider, input_per_million, cached_input_per_million, output_per_million, is_transcription, transcription_per_minute')
      .eq('active', true);

    const newCache = new Map<string, ModelPricingRow>();
    for (const row of (data ?? []) as ModelPricingRow[]) {
      const key = `${row.provider}/${row.model}`;
      newCache.set(key, row);
    }
    pricingCache = newCache;
    pricingCacheExpiresAt = Date.now() + PRICING_CACHE_TTL_MS;
  } catch {
    // Pricing query failed — continue without cost calculation
  }

  return pricingCache;
};

export const calculateCost = (
  provider: AiProvider,
  model: string,
  usage: ProviderUsage,
  pricing: Map<string, ModelPricingRow>,
): number | null => {
  const key = `${provider}/${model}`;
  const p = pricing.get(key);
  if (!p) return null;

  if (p.is_transcription) {
    // For transcription, we don't have duration in token-based usage.
    // Return null — caller should track duration separately if needed.
    return null;
  }

  const inputTokens = usage.inputTokens ?? 0;
  const cachedTokens = usage.cachedInputTokens ?? 0;
  const nonCachedInput = Math.max(0, inputTokens - cachedTokens);
  const outputTokens = usage.outputTokens ?? 0;

  const inputCost = (nonCachedInput / 1_000_000) * Number(p.input_per_million);
  const cachedCost = cachedTokens > 0 && p.cached_input_per_million
    ? (cachedTokens / 1_000_000) * Number(p.cached_input_per_million)
    : 0;
  const outputCost = (outputTokens / 1_000_000) * Number(p.output_per_million);

  return inputCost + cachedCost + outputCost;
};

// ============================================================
// Model resolution for features
// ============================================================

export const resolveModelForFeature = async (
  supabaseAdmin: any,
  featureKey: string,
  task: AiTask,
): Promise<ResolvedModel> => {
  const runtime = await loadAiRuntimeConfig(supabaseAdmin);
  const taskRoute = runtime.routing[task];

  // 1. Check feature override
  try {
    const { data: feature } = await supabaseAdmin
      .from('ai_features')
      .select('id')
      .eq('key', featureKey)
      .maybeSingle();

    if (feature) {
      const { data: config } = await supabaseAdmin
        .from('ai_feature_configs')
        .select('provider, model, model_override_enabled')
        .eq('feature_id', feature.id)
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (config?.model_override_enabled && config.provider && config.model) {
        const provider = isAiProvider(config.provider) ? config.provider : 'openai';
        return {
          provider,
          model: config.model,
          source: 'feature',
        };
      }
    }
  } catch {
    // Feature config lookup failed — fall through to ai_routing
  }

  // 2. ai_routing
  const provider = taskRoute.provider;
  const providerSettings = runtime.providers[provider];

  if (taskRoute.model) {
    return {
      provider,
      model: getCompatibleTaskModel(task, provider, providerSettings, taskRoute.model),
      source: 'ai_routing',
    };
  }

  // 3. Provider default
  return {
    provider,
    model: getTaskDefaultModel(task, provider, providerSettings),
    source: 'provider_default',
  };
};

// ============================================================
// Telemetry persistence
// ============================================================

const logAiCallAttempt = async (
  supabaseAdmin: any,
  callId: string,
  attemptNumber: number,
  provider: AiProvider,
  model: string,
  source: ModelResolutionSource,
  usage: ProviderUsage,
  durationMs: number,
  success: boolean,
  costUsd: number | null,
  error?: { code?: string; message?: string },
): Promise<void> => {
  try {
    await supabaseAdmin.from('ai_call_attempts').insert({
      call_id: callId,
      attempt_number: attemptNumber,
      provider,
      model,
      resolution_source: source,
      input_tokens: usage.inputTokens,
      cached_input_tokens: usage.cachedInputTokens,
      output_tokens: usage.outputTokens,
      reasoning_tokens: usage.reasoningTokens,
      total_tokens: usage.totalTokens,
      duration_ms: durationMs,
      success,
      estimated_cost_usd: costUsd,
      error_code: error?.code ?? null,
      error_message: error?.message ?? null,
    });
  } catch {
    // Telemetry failure must not break the call
  }
};

const logAiCall = async (
  supabaseAdmin: any,
  ctx: AiCallLogContext,
  result: {
    success: boolean;
    finalProvider?: AiProvider;
    finalModel?: string;
    fallbackUsed: boolean;
    attemptsCount: number;
    totalInputTokens?: number;
    totalCachedTokens?: number;
    totalOutputTokens?: number;
    totalReasoningTokens?: number;
    totalTokens?: number;
    totalDurationMs?: number;
    totalCostUsd?: number | null;
  },
): Promise<string | null> => {
  try {
    const { data } = await supabaseAdmin
      .from('ai_call_logs')
      .insert({
        feature_key: ctx.featureKey,
        ai_task: ctx.aiTask,
        edge_function: ctx.edgeFunction ?? null,
        success: result.success,
        final_provider: result.finalProvider ?? null,
        final_model: result.finalModel ?? null,
        fallback_used: result.fallbackUsed,
        attempts_count: result.attemptsCount,
        total_input_tokens: result.totalInputTokens ?? null,
        total_cached_tokens: result.totalCachedTokens ?? null,
        total_output_tokens: result.totalOutputTokens ?? null,
        total_reasoning_tokens: result.totalReasoningTokens ?? null,
        total_tokens: result.totalTokens ?? null,
        total_duration_ms: result.totalDurationMs ?? null,
        total_estimated_cost_usd: result.totalCostUsd ?? null,
        lead_id: ctx.leadId ?? null,
        chat_id: ctx.chatId ?? null,
        message_id: ctx.messageId ?? null,
      })
      .select('id')
      .maybeSingle();

    return data?.id ?? null;
  } catch {
    return null;
  }
};

// ============================================================
// Provider calls with usage extraction
// ============================================================

const canUseProvider = (provider: ProviderSettings): { ok: boolean; reason: string } => {
  if (!provider.enabled) {
    return { ok: false, reason: 'provedor desativado' };
  }

  if (!provider.apiKey.trim()) {
    return { ok: false, reason: 'chave de API nao configurada' };
  }

  return { ok: true, reason: '' };
};

export const generateTextWithRouting = async (
  options: GenerateTextWithRoutingOptions,
): Promise<GenerateTextWithRoutingResult> => {
  const runtime = await loadAiRuntimeConfig(options.supabaseAdmin);
  const taskRoute = runtime.routing[options.task];

  const preferredProvider = taskRoute.provider;
  const preferredProviderSettings = runtime.providers[preferredProvider];
  const preferredDefaultModel = getTaskDefaultModel(options.task, preferredProvider, preferredProviderSettings);
  const preferredModel = options.preferDefaultModel
    ? preferredDefaultModel
    : getCompatibleTaskModel(
        options.task,
        preferredProvider,
        preferredProviderSettings,
        taskRoute.model,
      );

  const attempts: Array<{ provider: AiProvider; model: string }> = [
    { provider: preferredProvider, model: preferredModel },
  ];

  if (
    preferredProvider === 'openai' &&
    preferredModel !== preferredDefaultModel &&
    isOpenAiTextModel(preferredDefaultModel)
  ) {
    attempts.push({ provider: preferredProvider, model: preferredDefaultModel });
  }

  const allowFallback = taskRoute.fallbackToOpenAi;
  const fallbackProvider = runtime.fallbackProvider;
  if (allowFallback && fallbackProvider !== preferredProvider) {
    const fallbackSettings = runtime.providers[fallbackProvider];
    const fallbackModel = getCompatibleTaskModel(
      options.task,
      fallbackProvider,
      fallbackSettings,
      getTaskDefaultModel(options.task, fallbackProvider, fallbackSettings),
    );
    attempts.push({
      provider: fallbackProvider,
      model: fallbackModel,
    });
  }

  const failures: string[] = [];

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];
    const providerSettings = runtime.providers[attempt.provider];
    const providerStatus = canUseProvider(providerSettings);

    if (!providerStatus.ok) {
      failures.push(`${attempt.provider}: ${providerStatus.reason}`);
      continue;
    }

    try {
      const result = await callProvider(attempt.provider, providerSettings, {
        model: attempt.model,
        systemPrompt: options.systemPrompt,
        userPrompt: options.userPrompt,
        temperature: options.temperature ?? 0.4,
        maxTokens: options.maxTokens ?? 900,
        task: options.task,
      });

      if (!result.text) {
        throw new Error('Resposta vazia do provider.');
      }

      return {
        text: result.text,
        provider: attempt.provider,
        model: attempt.model,
        fallbackUsed: index > 0,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${attempt.provider}: ${message}`);
    }
  }

  throw new Error(`Nao foi possivel gerar resposta por IA. Tentativas: ${failures.join(' | ')}`);
};

export const transcribeAudioWithRouting = async (
  options: TranscribeAudioWithRoutingOptions,
): Promise<TranscribeAudioWithRoutingResult> => {
  const startTime = Date.now();
  const runtime = await loadAiRuntimeConfig(options.supabaseAdmin);
  const taskRoute = runtime.routing.whatsapp_audio_transcription;

  const preferredProvider = taskRoute.provider;
  const preferredProviderSettings = runtime.providers[preferredProvider];
  const preferredModel = getCompatibleTaskModel(
    'whatsapp_audio_transcription',
    preferredProvider,
    preferredProviderSettings,
    taskRoute.model,
  );
  const preferredDefaultModel = getTaskDefaultModel('whatsapp_audio_transcription', preferredProvider, preferredProviderSettings);

  const attempts: Array<{ provider: AiProvider; model: string; source: ModelResolutionSource }> = [
    { provider: preferredProvider, model: preferredModel, source: 'ai_routing' },
  ];

  if (
    preferredProvider === 'openai' &&
    preferredModel !== preferredDefaultModel &&
    isOpenAiTranscriptionModel(preferredDefaultModel)
  ) {
    attempts.push({ provider: preferredProvider, model: preferredDefaultModel, source: 'provider_default' });
  }

  if (taskRoute.fallbackToOpenAi && runtime.fallbackProvider !== preferredProvider) {
    const fallbackProvider = runtime.fallbackProvider;
    const fallbackSettings = runtime.providers[fallbackProvider];
    const fallbackModel = getCompatibleTaskModel(
      'whatsapp_audio_transcription',
      fallbackProvider,
      fallbackSettings,
      getTaskDefaultModel('whatsapp_audio_transcription', fallbackProvider, fallbackSettings),
    );
    attempts.push({
      provider: fallbackProvider,
      model: fallbackModel,
      source: 'fallback',
    });
  }

  const failures: string[] = [];
  const emptyUsage: ProviderUsage = { inputTokens: null, cachedInputTokens: null, outputTokens: null, reasoningTokens: null, totalTokens: null };

  // Create call log (fire-and-forget)
  const callLogId = await logAiCall(options.supabaseAdmin, {
    featureKey: 'audio.transcribe',
    aiTask: 'whatsapp_audio_transcription',
    edgeFunction: null,
  }, {
    success: false,
    fallbackUsed: false,
    attemptsCount: 0,
    totalDurationMs: 0,
  }).catch(() => null);

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];
    const providerSettings = runtime.providers[attempt.provider];
    const providerStatus = canUseProvider(providerSettings);

    if (!providerStatus.ok) {
      failures.push(`${attempt.provider}: ${providerStatus.reason}`);
      continue;
    }

    const attemptStart = Date.now();
    try {
      const text = await callProviderTranscription(attempt.provider, providerSettings, {
        model: attempt.model,
        audioBlob: options.audioBlob,
        fileName: options.fileName,
        mimeType: options.mimeType,
        prompt: options.prompt,
      });

      const attemptDuration = Date.now() - attemptStart;
      const totalDuration = Date.now() - startTime;

      // Persist attempt (fire-and-forget)
      logAiCallAttempt(
        options.supabaseAdmin, callLogId!, index + 1,
        attempt.provider, attempt.model, attempt.source,
        emptyUsage, attemptDuration, true, null,
      ).catch(() => {});

      // Update call log with success (fire-and-forget)
      logAiCall(options.supabaseAdmin, {
        featureKey: 'audio.transcribe',
        aiTask: 'whatsapp_audio_transcription',
        edgeFunction: null,
      }, {
        success: true,
        finalProvider: attempt.provider,
        finalModel: attempt.model,
        fallbackUsed: index > 0,
        attemptsCount: index + 1,
        totalDurationMs: totalDuration,
        totalCostUsd: null,
      }).catch(() => {});

      return {
        text,
        provider: attempt.provider,
        model: attempt.model,
        fallbackUsed: index > 0,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${attempt.provider}: ${message}`);

      const attemptDuration = Date.now() - attemptStart;

      // Persist failed attempt (fire-and-forget)
      logAiCallAttempt(
        options.supabaseAdmin, callLogId!, index + 1,
        attempt.provider, attempt.model, attempt.source,
        emptyUsage, attemptDuration, false, null,
        { message },
      ).catch(() => {});
    }
  }

  throw new Error(`Nao foi possivel transcrever audio por IA. Tentativas: ${failures.join(' | ')}`);
};

// ============================================================
// generateTextForFeature — central entry point for all AI features
// ============================================================

/**
 * Central entry point for all AI feature calls.
 *
 * Resolves model via: feature override > ai_routing > provider default > fallback.
 * Executes up to 3 attempts (preferred, default model, fallback provider).
 * Logs every attempt and the summary call to ai_call_attempts / ai_call_logs.
 *
 * Uses preferDefaultModel only when explicitly passed (for legacy non-feature paths
 * like campaign.intent and agenda.organize that still need it).
 */
export const generateTextForFeature = async (
  options: GenerateTextForFeatureOptions,
): Promise<GenerateTextForFeatureResult> => {
  const startTime = Date.now();
  const runtime = await loadAiRuntimeConfig(options.supabaseAdmin);

  // Resolve model with precedence: feature > ai_routing > provider default
  const resolved = await resolveModelForFeature(options.supabaseAdmin, options.featureKey, options.task);
  const taskRoute = runtime.routing[options.task];

  // Build attempt list following the same fallback chain as generateTextWithRouting
  const preferredProvider = resolved.provider;
  const preferredProviderSettings = runtime.providers[preferredProvider];
  const preferredDefaultModel = getTaskDefaultModel(options.task, preferredProvider, preferredProviderSettings);

  const attempts: Array<{ provider: AiProvider; model: string; source: ModelResolutionSource }> = [
    { provider: preferredProvider, model: resolved.model, source: resolved.source },
  ];

  if (
    preferredProvider === 'openai' &&
    resolved.model !== preferredDefaultModel &&
    isOpenAiTextModel(preferredDefaultModel)
  ) {
    attempts.push({ provider: preferredProvider, model: preferredDefaultModel, source: 'provider_default' });
  }

  const allowFallback = taskRoute.fallbackToOpenAi;
  const fallbackProvider = runtime.fallbackProvider;
  if (allowFallback && fallbackProvider !== preferredProvider) {
    const fallbackSettings = runtime.providers[fallbackProvider];
    const fallbackModel = getCompatibleTaskModel(
      options.task,
      fallbackProvider,
      fallbackSettings,
      getTaskDefaultModel(options.task, fallbackProvider, fallbackSettings),
    );
    attempts.push({ provider: fallbackProvider, model: fallbackModel, source: 'fallback' });
  }

  // Load pricing for cost calculation
  const pricing = await loadPricingCache(options.supabaseAdmin);

  // Create the call log entry
  const callLogId = await logAiCall(options.supabaseAdmin, {
    featureKey: options.featureKey,
    aiTask: options.task,
    edgeFunction: options.edgeFunction,
    leadId: options.leadId,
    chatId: options.chatId,
    messageId: options.messageId,
  }, {
    success: false,
    finalProvider: undefined,
    finalModel: undefined,
    fallbackUsed: false,
    attemptsCount: 0,
  });

  const failures: string[] = [];
  let totalCostUsd = 0;
  let totalInput = 0;
  let totalCached = 0;
  let totalOutput = 0;
  let totalReasoning = 0;
  let totalTokensSum = 0;

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];
    const providerSettings = runtime.providers[attempt.provider];
    const providerStatus = canUseProvider(providerSettings);

    if (!providerStatus.ok) {
      failures.push(`${attempt.provider}: ${providerStatus.reason}`);

      // Log failed attempt (no usage)
      await logAiCallAttempt(
        options.supabaseAdmin, callLogId!, index + 1,
        attempt.provider, attempt.model, attempt.source,
        { inputTokens: null, cachedInputTokens: null, outputTokens: null, reasoningTokens: null, totalTokens: null },
        0, false, null,
        { message: providerStatus.reason },
      );
      continue;
    }

    const attemptStart = Date.now();
    try {
      const result = await callProvider(attempt.provider, providerSettings, {
        model: attempt.model,
        systemPrompt: options.systemPrompt,
        userPrompt: options.userPrompt,
        temperature: options.temperature ?? 0.4,
        maxTokens: options.maxTokens ?? 900,
        task: options.task,
      });

      const attemptDuration = Date.now() - attemptStart;

      if (!result.text) {
        throw new Error('Resposta vazia do provider.');
      }

      // Calculate cost for this attempt
      const cost = calculateCost(attempt.provider, attempt.model, result.usage, pricing);

      // Persist attempt telemetry (fire-and-forget)
      logAiCallAttempt(
        options.supabaseAdmin, callLogId!, index + 1,
        attempt.provider, attempt.model, attempt.source,
        result.usage, attemptDuration, true, cost,
      ).catch(() => {});

      // Accumulate totals
      if (cost !== null) totalCostUsd += cost;
      if (result.usage.inputTokens !== null) totalInput += result.usage.inputTokens;
      if (result.usage.cachedInputTokens !== null) totalCached += result.usage.cachedInputTokens;
      if (result.usage.outputTokens !== null) totalOutput += result.usage.outputTokens;
      if (result.usage.reasoningTokens !== null) totalReasoning += result.usage.reasoningTokens;
      if (result.usage.totalTokens !== null) totalTokensSum += result.usage.totalTokens;

      // Update call log with success
      logAiCall(options.supabaseAdmin, {
        featureKey: options.featureKey,
        aiTask: options.task,
        edgeFunction: options.edgeFunction,
        leadId: options.leadId,
        chatId: options.chatId,
        messageId: options.messageId,
      }, {
        success: true,
        finalProvider: attempt.provider,
        finalModel: attempt.model,
        fallbackUsed: index > 0,
        attemptsCount: index + 1,
        totalInputTokens: totalInput,
        totalCachedTokens: totalCached,
        totalOutputTokens: totalOutput,
        totalReasoningTokens: totalReasoning,
        totalTokens: totalTokensSum,
        totalDurationMs: Date.now() - startTime,
        totalCostUsd: totalCostUsd > 0 ? totalCostUsd : null,
      }).catch(() => {});

      return {
        text: result.text,
        provider: attempt.provider,
        model: attempt.model,
        source: attempt.source,
        fallbackUsed: index > 0,
        usage: result.usage,
        durationMs: Date.now() - startTime,
        estimatedCostUsd: cost,
        callLogId,
      };
    } catch (error) {
      const attemptDuration = Date.now() - attemptStart;
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${attempt.provider}: ${message}`);

      // Log failed attempt
      logAiCallAttempt(
        options.supabaseAdmin, callLogId!, index + 1,
        attempt.provider, attempt.model, attempt.source,
        { inputTokens: null, cachedInputTokens: null, outputTokens: null, reasoningTokens: null, totalTokens: null },
        attemptDuration, false, null,
        { message },
      ).catch(() => {});
    }
  }

  // All attempts failed — update call log
  logAiCall(options.supabaseAdmin, {
    featureKey: options.featureKey,
    aiTask: options.task,
    edgeFunction: options.edgeFunction,
    leadId: options.leadId,
    chatId: options.chatId,
    messageId: options.messageId,
  }, {
    success: false,
    finalProvider: attempts[attempts.length - 1]?.provider,
    finalModel: attempts[attempts.length - 1]?.model,
    fallbackUsed: attempts.length > 1,
    attemptsCount: attempts.length,
    totalInputTokens: totalInput,
    totalCachedTokens: totalCached,
    totalOutputTokens: totalOutput,
    totalReasoningTokens: totalReasoning,
    totalTokens: totalTokensSum,
    totalDurationMs: Date.now() - startTime,
    totalCostUsd: totalCostUsd > 0 ? totalCostUsd : null,
  }).catch(() => {});

  throw new Error(`Nao foi possivel gerar resposta por IA. Tentativas: ${failures.join(' | ')}`);
};

export const aiProviderSlugByProvider: Record<AiProvider, string> = {
  openai: OPENAI_SLUG,
  gemini: GEMINI_SLUG,
  claude: CLAUDE_SLUG,
};

export const aiRoutingSlug = AI_ROUTING_SLUG;
export const legacyGptSlug = LEGACY_GPT_SLUG;
export const aiTasks = AI_TASKS;
