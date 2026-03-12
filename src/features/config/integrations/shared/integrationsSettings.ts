import type { IntegrationSetting } from "../../../../lib/supabase";

export const LEGACY_GPT_SLUG = "gpt_transcription";
export const AI_PROVIDER_OPENAI_SLUG = "ai_provider_openai";
export const AI_PROVIDER_GEMINI_SLUG = "ai_provider_gemini";
export const AI_PROVIDER_CLAUDE_SLUG = "ai_provider_claude";
export const AI_ROUTING_SLUG = "ai_routing";
export const AI_FOLLOW_UP_PROMPT_SLUG = "ai_follow_up_prompt";
export const META_PIXEL_SLUG = "meta_pixel";
export const GTM_SLUG = "google_tag_manager";

export const OPENAI_DEFAULT_TEXT_MODEL = "gpt-4o-mini";
export const OPENAI_DEFAULT_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
export const GEMINI_DEFAULT_TEXT_MODEL = "gemini-2.0-flash";
export const CLAUDE_DEFAULT_TEXT_MODEL = "claude-3-5-sonnet-latest";

export type MessageState = { type: "success" | "error"; text: string } | null;
export type AiProvider = "openai" | "gemini" | "claude";
export type AiTaskKey =
  | "rewrite_message"
  | "follow_up_generation"
  | "whatsapp_audio_transcription";
export type ModelOption = { value: string; label: string };

export type AiProviderFormState = {
  enabled: boolean;
  apiKey: string;
};

export type AiTaskRouteState = {
  provider: AiProvider;
  model: string;
  fallbackToOpenAi: boolean;
};

export type AiRoutingFormState = Record<AiTaskKey, AiTaskRouteState>;

export type AiProviderMeta = {
  slug: string;
  name: string;
  description: string;
};

export type AiProviderModelsState = {
  loading: boolean;
  options: ModelOption[];
  error: string | null;
};

export const AI_PROVIDER_ORDER: AiProvider[] = ["openai", "gemini", "claude"];

export const AI_PROVIDER_META: Record<AiProvider, AiProviderMeta> = {
  openai: {
    slug: AI_PROVIDER_OPENAI_SLUG,
    name: "OpenAI",
    description:
      "Use modelos GPT para reescrita, follow-up e futuras tarefas de IA.",
  },
  gemini: {
    slug: AI_PROVIDER_GEMINI_SLUG,
    name: "Google Gemini",
    description: "Conecte sua API key do Gemini para usar modelos da Google.",
  },
  claude: {
    slug: AI_PROVIDER_CLAUDE_SLUG,
    name: "Claude (Anthropic)",
    description: "Conecte sua API key da Anthropic para usar modelos Claude.",
  },
};

export const AI_TASKS: Array<{
  key: AiTaskKey;
  label: string;
  description: string;
}> = [
  {
    key: "rewrite_message",
    label: "Reescrita de mensagem",
    description: "Usado no WhatsApp para reescrever mensagens antes de enviar.",
  },
  {
    key: "follow_up_generation",
    label: "Geracao de follow-up",
    description: "Usado em lembretes para sugerir mensagens de follow-up.",
  },
  {
    key: "whatsapp_audio_transcription",
    label: "Transcricao de audio",
    description:
      "Usado para transcrever audios recebidos no WhatsApp e reaproveitar a transcricao no chat.",
  },
];

export const AI_PROVIDER_OPTIONS = AI_PROVIDER_ORDER.map((provider) => ({
  value: provider,
  label: AI_PROVIDER_META[provider].name,
}));

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const toTrimmedString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

export const isAiProvider = (value: string): value is AiProvider =>
  value === "openai" || value === "gemini" || value === "claude";

export const normalizeModelOptions = (value: unknown): ModelOption[] => {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const options: ModelOption[] = [];

  for (const item of value) {
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      options.push({ value: trimmed, label: trimmed });
      continue;
    }

    if (!isRecord(item)) continue;

    const modelValue =
      toTrimmedString(item.value) ||
      toTrimmedString(item.id) ||
      toTrimmedString(item.name);
    if (!modelValue || seen.has(modelValue)) continue;

    const modelLabel =
      toTrimmedString(item.label) ||
      toTrimmedString(item.displayName) ||
      modelValue;

    seen.add(modelValue);
    options.push({ value: modelValue, label: modelLabel || modelValue });
  }

  return options;
};

export const createDefaultProviderModelsState = (): Record<
  AiProvider,
  AiProviderModelsState
> => ({
  openai: { loading: false, options: [], error: null },
  gemini: { loading: false, options: [], error: null },
  claude: { loading: false, options: [], error: null },
});

export const getDefaultTaskModel = (
  task: AiTaskKey,
  provider: AiProvider,
): string => {
  if (provider === "openai") {
    if (task === "whatsapp_audio_transcription") {
      return OPENAI_DEFAULT_TRANSCRIPTION_MODEL;
    }

    return OPENAI_DEFAULT_TEXT_MODEL;
  }

  if (provider === "gemini") {
    return GEMINI_DEFAULT_TEXT_MODEL;
  }

  return CLAUDE_DEFAULT_TEXT_MODEL;
};

export const getPreferredTaskModel = (
  task: AiTaskKey,
  provider: AiProvider,
  providerOptions: ModelOption[],
): string => {
  const defaultModel = getDefaultTaskModel(task, provider);

  if (providerOptions.some((option) => option.value === defaultModel)) {
    return defaultModel;
  }

  return providerOptions[0]?.value ?? defaultModel;
};

export const createDefaultProviderForms = (): Record<
  AiProvider,
  AiProviderFormState
> => ({
  openai: { enabled: false, apiKey: "" },
  gemini: { enabled: false, apiKey: "" },
  claude: { enabled: false, apiKey: "" },
});

export const createDefaultRoutingForm = (): AiRoutingFormState => ({
  rewrite_message: {
    provider: "openai",
    model: getDefaultTaskModel("rewrite_message", "openai"),
    fallbackToOpenAi: true,
  },
  follow_up_generation: {
    provider: "openai",
    model: getDefaultTaskModel("follow_up_generation", "openai"),
    fallbackToOpenAi: true,
  },
  whatsapp_audio_transcription: {
    provider: "openai",
    model: getDefaultTaskModel("whatsapp_audio_transcription", "openai"),
    fallbackToOpenAi: true,
  },
});

export const normalizeProviderSettings = (
  provider: AiProvider,
  integration: IntegrationSetting | null,
  legacyIntegration: IntegrationSetting | null,
): AiProviderFormState => {
  const settings = isRecord(integration?.settings) ? integration.settings : {};
  const legacySettings = isRecord(legacyIntegration?.settings)
    ? legacyIntegration.settings
    : {};
  const legacyApiKey =
    provider === "openai" ? toTrimmedString(legacySettings.apiKey) : "";
  const apiKey = toTrimmedString(settings.apiKey) || legacyApiKey;

  const enabled =
    typeof settings.enabled === "boolean"
      ? settings.enabled
      : provider === "openai"
        ? apiKey.length > 0
        : false;

  return {
    enabled,
    apiKey,
  };
};

export const normalizeRoutingSettings = (
  integration: IntegrationSetting | null,
): AiRoutingFormState => {
  const defaults = createDefaultRoutingForm();
  const settings = isRecord(integration?.settings) ? integration.settings : {};
  const tasks = isRecord(settings.tasks) ? settings.tasks : {};

  return AI_TASKS.reduce((accumulator, task) => {
    const rawTask: Record<string, unknown> = isRecord(tasks[task.key])
      ? (tasks[task.key] as Record<string, unknown>)
      : {};
    const providerCandidate = toTrimmedString(rawTask.provider).toLowerCase();
    const provider = isAiProvider(providerCandidate)
      ? providerCandidate
      : defaults[task.key].provider;
    const model = toTrimmedString(rawTask.model) || defaults[task.key].model;
    const fallbackToOpenAi =
      typeof rawTask.fallbackToOpenAi === "boolean"
        ? rawTask.fallbackToOpenAi
        : defaults[task.key].fallbackToOpenAi;

    accumulator[task.key] = {
      provider,
      model,
      fallbackToOpenAi,
    };

    return accumulator;
  }, createDefaultRoutingForm());
};

export const normalizeFollowUpInstructions = (
  integration: IntegrationSetting | null,
) => {
  const settings = isRecord(integration?.settings) ? integration.settings : {};
  return toTrimmedString(settings.instructions);
};

export const INTEGRATIONS_SECTION_SHELL_CLASS =
  "rounded-2xl border border-[color:var(--panel-border-subtle)] bg-[var(--panel-surface)] p-6 shadow-sm";

export const INTEGRATIONS_SECTION_INSET_CLASS =
  "rounded-2xl border border-[color:var(--panel-border-subtle)] bg-[var(--panel-surface-soft)] p-4";
