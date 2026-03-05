type AiProvider = 'openai' | 'gemini' | 'claude';

export type AiTask = 'rewrite_message' | 'follow_up_generation' | 'whatsapp_audio_transcription';

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
};

export type GenerateTextWithRoutingResult = {
  text: string;
  provider: AiProvider;
  model: string;
  fallbackUsed: boolean;
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

const AI_TASKS: AiTask[] = ['rewrite_message', 'follow_up_generation', 'whatsapp_audio_transcription'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toTrimmedString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

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

const getTaskDefaultModel = (task: AiTask, provider: AiProvider, settings: ProviderSettings): string => {
  if (task === 'whatsapp_audio_transcription') {
    if (provider === 'openai') {
      return settings.defaultModelTranscription || OPENAI_DEFAULT_TRANSCRIPTION_MODEL;
    }

    return settings.defaultModelTranscription || settings.defaultModelText;
  }

  return settings.defaultModelText;
};

const normalizeProviderSettings = (
  provider: AiProvider,
  settings: Record<string, unknown>,
  legacySettings: Record<string, unknown>,
): ProviderSettings => {
  const legacyApiKey = toTrimmedString(legacySettings.apiKey);
  const legacyTextModel =
    toTrimmedString(legacySettings.textModel) || toTrimmedString(legacySettings.model) || OPENAI_DEFAULT_TEXT_MODEL;

  const apiKey =
    toTrimmedString(settings.apiKey) || (provider === 'openai' ? legacyApiKey : '');

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
    whatsapp_audio_transcription: normalizeTaskRouting(
      'whatsapp_audio_transcription',
      rawTasks.whatsapp_audio_transcription,
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

const callOpenAi = async (settings: ProviderSettings, params: ProviderCallParams): Promise<string> => {
  const endpointBase = settings.baseUrl.replace(/\/+$/, '');
  const endpoint = `${endpointBase}/chat/completions`;

  const messages = [] as Array<{ role: 'system' | 'user'; content: string }>;
  if (params.systemPrompt.trim()) {
    messages.push({ role: 'system', content: params.systemPrompt });
  }
  messages.push({ role: 'user', content: params.userPrompt });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI retornou erro HTTP ${response.status}: ${errorText}`);
  }

  const payload = await response.json().catch(() => ({}));
  const text = extractOpenAiText(payload);
  if (!text) {
    throw new Error('OpenAI retornou resposta vazia.');
  }

  return text;
};

const callClaude = async (settings: ProviderSettings, params: ProviderCallParams): Promise<string> => {
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

  return text;
};

const callGemini = async (settings: ProviderSettings, params: ProviderCallParams): Promise<string> => {
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

  return text;
};

const callProvider = async (
  provider: AiProvider,
  settings: ProviderSettings,
  params: ProviderCallParams,
): Promise<string> => {
  if (provider === 'openai') {
    return callOpenAi(settings, params);
  }

  if (provider === 'gemini') {
    return callGemini(settings, params);
  }

  return callClaude(settings, params);
};

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
  const preferredModel = taskRoute.model || getTaskDefaultModel(options.task, preferredProvider, preferredProviderSettings);

  const attempts: Array<{ provider: AiProvider; model: string }> = [
    { provider: preferredProvider, model: preferredModel },
  ];

  const allowFallback = taskRoute.fallbackToOpenAi;
  const fallbackProvider = runtime.fallbackProvider;
  if (allowFallback && fallbackProvider !== preferredProvider) {
    const fallbackSettings = runtime.providers[fallbackProvider];
    attempts.push({
      provider: fallbackProvider,
      model: getTaskDefaultModel(options.task, fallbackProvider, fallbackSettings),
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
      const text = await callProvider(attempt.provider, providerSettings, {
        model: attempt.model,
        systemPrompt: options.systemPrompt,
        userPrompt: options.userPrompt,
        temperature: options.temperature ?? 0.4,
        maxTokens: options.maxTokens ?? 900,
      });

      return {
        text,
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

export const aiProviderSlugByProvider: Record<AiProvider, string> = {
  openai: OPENAI_SLUG,
  gemini: GEMINI_SLUG,
  claude: CLAUDE_SLUG,
};

export const aiRoutingSlug = AI_ROUTING_SLUG;
export const legacyGptSlug = LEGACY_GPT_SLUG;
export const aiTasks = AI_TASKS;
