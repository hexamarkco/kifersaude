import { useCallback, useEffect, useState } from "react";
import {
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Plug,
  Save,
  ShieldCheck,
  Facebook,
  Tag,
} from "lucide-react";

import { configService } from "../../../lib/configService";
import { supabase, type IntegrationSetting } from "../../../lib/supabase";
import FilterSingleSelect from "../../../components/FilterSingleSelect";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import VariableAutocompleteTextarea from "../../../components/ui/VariableAutocompleteTextarea";
import { IntegrationsSkeleton } from "../../../components/ui/panelSkeletons";
import { useAdaptiveLoading } from "../../../hooks/useAdaptiveLoading";
import { PanelAdaptiveLoadingFrame } from "../../../components/ui/panelLoading";
import { WHATSAPP_FOLLOW_UP_VARIABLE_SUGGESTIONS } from "../../../lib/templateVariableSuggestions";
import WhatsAppApiSettingsPanel from "./components/WhatsAppApiSettingsPanel";

const LEGACY_GPT_SLUG = "gpt_transcription";
const AI_PROVIDER_OPENAI_SLUG = "ai_provider_openai";
const AI_PROVIDER_GEMINI_SLUG = "ai_provider_gemini";
const AI_PROVIDER_CLAUDE_SLUG = "ai_provider_claude";
const AI_ROUTING_SLUG = "ai_routing";
const AI_FOLLOW_UP_PROMPT_SLUG = "ai_follow_up_prompt";

const META_PIXEL_SLUG = "meta_pixel";
const GTM_SLUG = "google_tag_manager";

const OPENAI_DEFAULT_TEXT_MODEL = "gpt-4o-mini";
const GEMINI_DEFAULT_TEXT_MODEL = "gemini-2.0-flash";
const CLAUDE_DEFAULT_TEXT_MODEL = "claude-3-5-sonnet-latest";

type MessageState = { type: "success" | "error"; text: string } | null;
type AiProvider = "openai" | "gemini" | "claude";
type AiTaskKey =
  | "rewrite_message"
  | "follow_up_generation"
  | "whatsapp_audio_transcription";
type ModelOption = { value: string; label: string };

type AiProviderFormState = {
  enabled: boolean;
  apiKey: string;
};

type AiTaskRouteState = {
  provider: AiProvider;
  model: string;
  fallbackToOpenAi: boolean;
};

type AiRoutingFormState = Record<AiTaskKey, AiTaskRouteState>;

type AiProviderMeta = {
  slug: string;
  name: string;
  description: string;
};

type AiProviderModelsState = {
  loading: boolean;
  options: ModelOption[];
  error: string | null;
};

const AI_PROVIDER_ORDER: AiProvider[] = ["openai", "gemini", "claude"];

const AI_PROVIDER_META: Record<AiProvider, AiProviderMeta> = {
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

const AI_TASKS: Array<{ key: AiTaskKey; label: string; description: string }> =
  [
    {
      key: "rewrite_message",
      label: "Reescrita de mensagem",
      description:
        "Usado no WhatsApp para reescrever mensagens antes de enviar.",
    },
    {
      key: "follow_up_generation",
      label: "Geração de follow-up",
      description: "Usado em lembretes para sugerir mensagens de follow-up.",
    },
    {
      key: "whatsapp_audio_transcription",
      label: "Transcrição de áudio do WhatsApp",
      description: "Usado no inbox para transcrever notas de voz e áudios sob demanda.",
    },
  ];

const AI_PROVIDER_OPTIONS = AI_PROVIDER_ORDER.map((provider) => ({
  value: provider,
  label: AI_PROVIDER_META[provider].name,
}));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toTrimmedString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const isAiProvider = (value: string): value is AiProvider =>
  value === "openai" || value === "gemini" || value === "claude";

const normalizeModelOptions = (value: unknown): ModelOption[] => {
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

const createDefaultProviderModelsState = (): Record<
  AiProvider,
  AiProviderModelsState
> => ({
  openai: {
    loading: false,
    options: [],
    error: null,
  },
  gemini: {
    loading: false,
    options: [],
    error: null,
  },
  claude: {
    loading: false,
    options: [],
    error: null,
  },
});

const getDefaultTaskModel = (provider: AiProvider): string => {
  if (provider === "openai") {
    return OPENAI_DEFAULT_TEXT_MODEL;
  }

  if (provider === "gemini") {
    return GEMINI_DEFAULT_TEXT_MODEL;
  }

  return CLAUDE_DEFAULT_TEXT_MODEL;
};

const getPreferredTaskModel = (
  provider: AiProvider,
  providerOptions: ModelOption[],
): string => {
  const defaultModel = getDefaultTaskModel(provider);

  if (providerOptions.some((option) => option.value === defaultModel)) {
    return defaultModel;
  }

  return providerOptions[0]?.value ?? defaultModel;
};

const createDefaultProviderForms = (): Record<
  AiProvider,
  AiProviderFormState
> => ({
  openai: {
    enabled: false,
    apiKey: "",
  },
  gemini: {
    enabled: false,
    apiKey: "",
  },
  claude: {
    enabled: false,
    apiKey: "",
  },
});

const createDefaultRoutingForm = (): AiRoutingFormState => ({
  rewrite_message: {
    provider: "openai",
    model: getDefaultTaskModel("openai"),
    fallbackToOpenAi: true,
  },
  follow_up_generation: {
    provider: "openai",
    model: getDefaultTaskModel("openai"),
    fallbackToOpenAi: true,
  },
  whatsapp_audio_transcription: {
    provider: "openai",
    model: getDefaultTaskModel("openai"),
    fallbackToOpenAi: true,
  },
});

const normalizeProviderSettings = (
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

const normalizeRoutingSettings = (
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

    const model =
      toTrimmedString(rawTask.model) ||
      toTrimmedString(rawTask.textModel) ||
      getDefaultTaskModel(provider);

    const fallbackToOpenAi =
      typeof rawTask.fallbackToOpenAi === "boolean"
        ? rawTask.fallbackToOpenAi
        : true;

    accumulator[task.key] = {
      provider,
      model,
      fallbackToOpenAi,
    };

    return accumulator;
  }, {} as AiRoutingFormState);
};

const normalizeFollowUpInstructions = (
  integration: IntegrationSetting | null,
) => {
  const settings = isRecord(integration?.settings) ? integration.settings : {};
  return typeof settings.instructions === "string" ? settings.instructions : "";
};

const sectionShellClass =
  "rounded-2xl border border-[color:var(--panel-border-subtle)] bg-[var(--panel-surface)] p-5 shadow-sm";

const sectionInsetClass =
  "rounded-2xl border border-[color:var(--panel-border-subtle)] bg-[var(--panel-surface-soft)] p-4";

export default function IntegrationsScreen() {
  const [aiProviderIntegrations, setAiProviderIntegrations] = useState<
    Record<AiProvider, IntegrationSetting | null>
  >({
    openai: null,
    gemini: null,
    claude: null,
  });
  const [aiProviderForms, setAiProviderForms] = useState<
    Record<AiProvider, AiProviderFormState>
  >(() => createDefaultProviderForms());
  const [aiRoutingIntegration, setAiRoutingIntegration] =
    useState<IntegrationSetting | null>(null);
  const [aiRoutingForm, setAiRoutingForm] = useState<AiRoutingFormState>(() =>
    createDefaultRoutingForm(),
  );
  const [aiFollowUpPromptIntegration, setAiFollowUpPromptIntegration] =
    useState<IntegrationSetting | null>(null);
  const [aiFollowUpInstructions, setAiFollowUpInstructions] = useState("");
  const [aiProviderModels, setAiProviderModels] = useState<
    Record<AiProvider, AiProviderModelsState>
  >(() => createDefaultProviderModelsState());
  const [loadingAi, setLoadingAi] = useState(true);
  const [savingAiProvider, setSavingAiProvider] = useState<
    Record<AiProvider, boolean>
  >({
    openai: false,
    gemini: false,
    claude: false,
  });
  const [savingAiRouting, setSavingAiRouting] = useState(false);
  const [savingAiFollowUpPrompt, setSavingAiFollowUpPrompt] = useState(false);
  const [aiMessage, setAiMessage] = useState<MessageState>(null);
  const [showProviderApiKey, setShowProviderApiKey] = useState<
    Record<AiProvider, boolean>
  >({
    openai: false,
    gemini: false,
    claude: false,
  });

  const [metaPixelIntegration, setMetaPixelIntegration] =
    useState<IntegrationSetting | null>(null);
  const [metaPixelId, setMetaPixelId] = useState("");
  const [loadingMetaPixel, setLoadingMetaPixel] = useState(true);
  const [savingMetaPixel, setSavingMetaPixel] = useState(false);
  const [metaPixelMessage, setMetaPixelMessage] = useState<MessageState>(null);

  const [gtmIntegration, setGtmIntegration] =
    useState<IntegrationSetting | null>(null);
  const [gtmId, setGtmId] = useState("");
  const [loadingGtm, setLoadingGtm] = useState(true);
  const [savingGtm, setSavingGtm] = useState(false);
  const [gtmMessage, setGtmMessage] = useState<MessageState>(null);

  const loadingUi = useAdaptiveLoading(loadingAi);

  const loadProviderModels = useCallback(async (provider: AiProvider, apiKey: string) => {
    const normalizedApiKey = apiKey.trim();

    if (!normalizedApiKey) {
      setAiProviderModels((prev) => ({
        ...prev,
        [provider]: {
          loading: false,
          options: [],
          error: null,
        },
      }));
      return;
    }

    setAiProviderModels((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        loading: true,
        error: null,
      },
    }));

    try {
      const { data, error } = await supabase.functions.invoke(
        "list-ai-models",
        {
          body: {
            provider,
            apiKey: normalizedApiKey,
          },
        },
      );

      if (error) {
        throw new Error(error.message || "Erro ao consultar modelos");
      }

      const payload = isRecord(data) ? data : {};
      const options = normalizeModelOptions(payload.models);

      setAiProviderModels((prev) => ({
        ...prev,
        [provider]: {
          loading: false,
          options,
          error:
            options.length === 0
              ? "Nenhum modelo retornado pela API do provedor."
              : null,
        },
      }));
    } catch (error) {
      console.error(`Erro ao carregar modelos de ${provider}:`, error);
      setAiProviderModels((prev) => ({
        ...prev,
        [provider]: {
          loading: false,
          options: [],
          error: "Não foi possível carregar os modelos da API do provedor.",
        },
      }));
    }
  }, []);

  const loadAiIntegrations = useCallback(async () => {
    setLoadingAi(true);
    setAiMessage(null);

    try {
      const [
        openaiIntegration,
        geminiIntegration,
        claudeIntegration,
        routingIntegration,
        followUpPromptIntegration,
        legacyGptIntegration,
      ] = await Promise.all([
        configService.getIntegrationSetting(AI_PROVIDER_OPENAI_SLUG),
        configService.getIntegrationSetting(AI_PROVIDER_GEMINI_SLUG),
        configService.getIntegrationSetting(AI_PROVIDER_CLAUDE_SLUG),
        configService.getIntegrationSetting(AI_ROUTING_SLUG),
        configService.getIntegrationSetting(AI_FOLLOW_UP_PROMPT_SLUG),
        configService.getIntegrationSetting(LEGACY_GPT_SLUG),
      ]);

      const nextProviderIntegrations: Record<
        AiProvider,
        IntegrationSetting | null
      > = {
        openai: openaiIntegration,
        gemini: geminiIntegration,
        claude: claudeIntegration,
      };

      const nextProviderForms: Record<AiProvider, AiProviderFormState> = {
        openai: normalizeProviderSettings(
          "openai",
          openaiIntegration,
          legacyGptIntegration,
        ),
        gemini: normalizeProviderSettings("gemini", geminiIntegration, null),
        claude: normalizeProviderSettings("claude", claudeIntegration, null),
      };

      setAiProviderIntegrations(nextProviderIntegrations);
      setAiProviderForms(nextProviderForms);
      setAiRoutingIntegration(routingIntegration);
      setAiRoutingForm(normalizeRoutingSettings(routingIntegration));
      setAiFollowUpPromptIntegration(followUpPromptIntegration);
      setAiFollowUpInstructions(
        normalizeFollowUpInstructions(followUpPromptIntegration),
      );
      setAiProviderModels(createDefaultProviderModelsState());

      for (const provider of AI_PROVIDER_ORDER) {
        const apiKey = nextProviderForms[provider].apiKey;
        if (apiKey.trim()) {
          void loadProviderModels(provider, apiKey);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar configurações de IA:", error);
      setAiMessage({
        type: "error",
        text: "Não foi possível carregar as configurações de IA.",
      });
    } finally {
      setLoadingAi(false);
    }
  }, [loadProviderModels]);

  const loadMetaPixel = useCallback(async () => {
    setLoadingMetaPixel(true);
    const data = await configService.getIntegrationSetting(META_PIXEL_SLUG);
    setMetaPixelIntegration(data);
    setMetaPixelId(toTrimmedString(data?.settings?.pixelId));
    setLoadingMetaPixel(false);
  }, []);

  const loadGtm = useCallback(async () => {
    setLoadingGtm(true);
    const data = await configService.getIntegrationSetting(GTM_SLUG);
    setGtmIntegration(data);
    setGtmId(toTrimmedString(data?.settings?.gtmId));
    setLoadingGtm(false);
  }, []);

  useEffect(() => {
    void loadAiIntegrations();
    void loadMetaPixel();
    void loadGtm();
  }, [loadAiIntegrations, loadGtm, loadMetaPixel]);

  void loadingMetaPixel;
  void loadingGtm;

  const handleSaveProvider = async (provider: AiProvider) => {
    const currentForm = aiProviderForms[provider];
    const providerMeta = AI_PROVIDER_META[provider];

    setSavingAiProvider((prev) => ({ ...prev, [provider]: true }));
    setAiMessage(null);

    const settingsPayload = {
      enabled: currentForm.enabled,
      apiKey: currentForm.apiKey.trim(),
    };

    const integration = aiProviderIntegrations[provider];

    const result = integration?.id
      ? await configService.updateIntegrationSetting(integration.id, {
          settings: settingsPayload,
        })
      : await configService.createIntegrationSetting({
          slug: providerMeta.slug,
          name: providerMeta.name,
          description: providerMeta.description,
          settings: settingsPayload,
        });

    if (result.error) {
      setAiMessage({
        type: "error",
        text: `Erro ao salvar configuração de ${providerMeta.name}.`,
      });
    } else {
      const savedIntegration = result.data ?? integration;
      if (savedIntegration) {
        setAiProviderIntegrations((prev) => ({
          ...prev,
          [provider]: savedIntegration,
        }));
      }

      setAiProviderForms((prev) => ({
        ...prev,
        [provider]: {
          enabled: settingsPayload.enabled,
          apiKey: settingsPayload.apiKey,
        },
      }));

      if (settingsPayload.apiKey) {
        void loadProviderModels(provider, settingsPayload.apiKey);
      } else {
        setAiProviderModels((prev) => ({
          ...prev,
          [provider]: {
            loading: false,
            options: [],
            error: null,
          },
        }));
      }

      setAiMessage({
        type: "success",
        text: `${providerMeta.name} atualizado com sucesso.`,
      });
    }

    setSavingAiProvider((prev) => ({ ...prev, [provider]: false }));
  };

  const handleSaveRouting = async () => {
    setSavingAiRouting(true);
    setAiMessage(null);

    const tasksPayload = AI_TASKS.reduce(
      (accumulator, task) => {
        const route = aiRoutingForm[task.key];
        const model =
          route.model.trim() || getDefaultTaskModel(route.provider);

        accumulator[task.key] = {
          provider: route.provider,
          model,
          fallbackToOpenAi: route.fallbackToOpenAi,
        };

        return accumulator;
      },
      {} as Record<
        AiTaskKey,
        { provider: AiProvider; model: string; fallbackToOpenAi: boolean }
      >,
    );

    const settingsPayload = {
      fallbackEnabled: true,
      fallbackProvider: "openai",
      tasks: tasksPayload,
    };

    const result = aiRoutingIntegration?.id
      ? await configService.updateIntegrationSetting(aiRoutingIntegration.id, {
          settings: settingsPayload,
        })
      : await configService.createIntegrationSetting({
          slug: AI_ROUTING_SLUG,
          name: "IA - Roteamento de Funcionalidades",
          description:
            "Define qual provedor/modelo cada funcionalidade de IA deve usar.",
          settings: settingsPayload,
        });

    if (result.error) {
      setAiMessage({
        type: "error",
        text: "Erro ao salvar roteamento de funcionalidades de IA.",
      });
    } else {
      setAiRoutingIntegration(result.data ?? aiRoutingIntegration);
      setAiRoutingForm((prev) =>
        AI_TASKS.reduce((accumulator, task) => {
          const route = prev[task.key];
          accumulator[task.key] = {
            ...route,
            model: tasksPayload[task.key].model,
          };
          return accumulator;
        }, {} as AiRoutingFormState),
      );
      setAiMessage({
        type: "success",
        text: "Roteamento de IA atualizado com sucesso.",
      });
    }

    setSavingAiRouting(false);
  };

  const handleSaveFollowUpPrompt = async () => {
    setSavingAiFollowUpPrompt(true);
    setAiMessage(null);

    const settingsPayload = {
      instructions: aiFollowUpInstructions.trim(),
    };

    const result = aiFollowUpPromptIntegration?.id
      ? await configService.updateIntegrationSetting(
          aiFollowUpPromptIntegration.id,
          {
            settings: settingsPayload,
          },
        )
      : await configService.createIntegrationSetting({
          slug: AI_FOLLOW_UP_PROMPT_SLUG,
          name: "IA - Instruções de follow-up",
          description:
            "Instrui a IA do WhatsApp sobre como gerar follow-ups a partir do histórico do chat.",
          settings: settingsPayload,
        });

    if (result.error) {
      setAiMessage({
        type: "error",
        text: "Erro ao salvar as instruções de follow-up.",
      });
    } else {
      const savedIntegration = result.data ?? aiFollowUpPromptIntegration;
      setAiFollowUpPromptIntegration(savedIntegration);
      setAiFollowUpInstructions(settingsPayload.instructions);
      setAiMessage({
        type: "success",
        text: "Instrucoes de follow-up atualizadas com sucesso.",
      });
    }

    setSavingAiFollowUpPrompt(false);
  };

  const handleSaveMetaPixel = async () => {
    setSavingMetaPixel(true);
    setMetaPixelMessage(null);

    if (!metaPixelIntegration?.id) {
      const { data, error } = await configService.createIntegrationSetting({
        slug: META_PIXEL_SLUG,
        name: "Meta Pixel",
        description: "Código do Meta Pixel (Facebook) para rastreamento",
        settings: { pixelId: metaPixelId.trim() },
      });
      if (error) {
        setMetaPixelMessage({
          type: "error",
          text: "Erro ao salvar. Tente novamente.",
        });
      } else {
        setMetaPixelIntegration(data);
        setMetaPixelMessage({
          type: "success",
          text: "Meta Pixel configurado com sucesso!",
        });
      }
    } else {
      const { data, error } = await configService.updateIntegrationSetting(
        metaPixelIntegration.id,
        {
          settings: { pixelId: metaPixelId.trim() },
        },
      );
      if (error) {
        setMetaPixelMessage({
          type: "error",
          text: "Erro ao salvar. Tente novamente.",
        });
      } else {
        setMetaPixelIntegration(data);
        setMetaPixelMessage({
          type: "success",
          text: "Meta Pixel atualizado com sucesso!",
        });
      }
    }
    setSavingMetaPixel(false);
  };

  const handleSaveGtm = async () => {
    setSavingGtm(true);
    setGtmMessage(null);

    if (!gtmIntegration?.id) {
      const { data, error } = await configService.createIntegrationSetting({
        slug: GTM_SLUG,
        name: "Google Tag Manager",
        description: "Código do GTM para rastreamento",
        settings: { gtmId: gtmId.trim() },
      });
      if (error) {
        setGtmMessage({
          type: "error",
          text: "Erro ao salvar. Tente novamente.",
        });
      } else {
        setGtmIntegration(data);
        setGtmMessage({
          type: "success",
          text: "GTM configurado com sucesso!",
        });
      }
    } else {
      const { data, error } = await configService.updateIntegrationSetting(
        gtmIntegration.id,
        {
          settings: { gtmId: gtmId.trim() },
        },
      );
      if (error) {
        setGtmMessage({
          type: "error",
          text: "Erro ao salvar. Tente novamente.",
        });
      } else {
        setGtmIntegration(data);
        setGtmMessage({ type: "success", text: "GTM atualizado com sucesso!" });
      }
    }
    setSavingGtm(false);
  };

  const hasIntegrationSnapshot =
    aiRoutingIntegration !== null ||
    aiFollowUpPromptIntegration !== null ||
    aiProviderIntegrations.openai !== null ||
    aiProviderIntegrations.gemini !== null ||
    aiProviderIntegrations.claude !== null ||
    metaPixelIntegration !== null ||
    gtmIntegration !== null;

  return (
    <PanelAdaptiveLoadingFrame
      loading={loadingAi}
      phase={loadingUi.phase}
      hasContent={hasIntegrationSnapshot}
      skeleton={<IntegrationsSkeleton />}
      stageLabel="Carregando integrações..."
      overlayLabel="Atualizando integrações..."
      stageClassName="min-h-[460px]"
    >
      <div className="panel-page-shell space-y-8">
        <section className="rounded-3xl border border-[color:var(--panel-border-subtle)] bg-[var(--panel-surface)] p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--panel-border-subtle)] bg-[var(--panel-surface-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--panel-text-muted)]">
                <Plug className="h-3.5 w-3.5 text-amber-600" />
                Integrações
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold text-[var(--panel-text)]">
                    Integrações e conectores
                  </h2>
                  <p className="max-w-3xl text-sm leading-6 text-[var(--panel-text-muted)]">
                    Conecte IA, WhatsApp e rastreamento em uma estrutura visual
                    compatível com as configurações gerais, com menos contraste
                    solto entre seções.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-[var(--panel-text)]">
              Integrações de IA
            </h2>
            <p className="text-sm text-[var(--panel-text-muted)]">
              Conecte OpenAI, Gemini e Claude e escolha qual provedor/modelo
              cada funcionalidade deve usar.
            </p>
          </div>

          {aiMessage && (
            <div
              className={`p-4 rounded-lg border flex items-center space-x-3 mb-4 ${
                aiMessage.type === "success"
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}
            >
              {aiMessage.type === "success" ? (
                <ShieldCheck className="w-5 h-5" />
              ) : (
                <Info className="w-5 h-5" />
              )}
              <p>{aiMessage.text}</p>
            </div>
          )}

          <div className="space-y-4">
            {AI_PROVIDER_ORDER.map((provider) => {
              const providerMeta = AI_PROVIDER_META[provider];
              const formState = aiProviderForms[provider];
              const providerModelsState = aiProviderModels[provider];
              const hasApiKey = formState.apiKey.trim().length > 0;

              const providerModelsHint = providerModelsState.loading
                ? "Carregando modelos da API para o roteamento..."
                : !hasApiKey
                  ? "Salve uma API key para carregar modelos no roteamento por funcionalidade."
                  : providerModelsState.error
                    ? providerModelsState.error
                    : providerModelsState.options.length > 0
                      ? `${providerModelsState.options.length} modelos carregados da API do provedor.`
                      : "Nenhum modelo retornado pela API do provedor.";

              return (
                <div key={provider} className={sectionShellClass}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-[var(--panel-text)]">
                        {providerMeta.name}
                      </h3>
                      <p className="text-sm text-[var(--panel-text-muted)]">
                        {providerMeta.description}
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--panel-border-subtle)] bg-[var(--panel-surface-soft)] px-3 py-2 text-sm text-[var(--panel-text-muted)]">
                      <input
                        type="checkbox"
                        checked={formState.enabled}
                        onChange={(event) =>
                          setAiProviderForms((prev) => ({
                            ...prev,
                            [provider]: {
                              ...prev[provider],
                              enabled: event.target.checked,
                            },
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      Ativo
                    </label>
                  </div>

                  <div className="mt-4">
                    <label className="mb-2 block text-sm font-medium text-[var(--panel-text)]">
                      API Key
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--panel-text-muted)]" />
                      <input
                        type={
                          showProviderApiKey[provider] ? "text" : "password"
                        }
                        value={formState.apiKey}
                        onChange={(event) =>
                          setAiProviderForms((prev) => ({
                            ...prev,
                            [provider]: {
                              ...prev[provider],
                              apiKey: event.target.value,
                            },
                          }))
                        }
                        className="w-full rounded-lg border border-[color:var(--panel-border-subtle)] bg-[var(--panel-surface-soft)] py-2 pl-10 pr-12 text-[var(--panel-text)] placeholder:text-[var(--panel-text-muted)]/70 focus:border-[var(--panel-accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--panel-accent)]/20"
                        placeholder="Informe a API key"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowProviderApiKey((prev) => ({
                            ...prev,
                            [provider]: !prev[provider],
                          }))
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--panel-text-muted)] hover:text-[var(--panel-text)]"
                      >
                        {showProviderApiKey[provider] ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-[var(--panel-text-muted)]">
                      {providerModelsHint}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-end border-t border-[color:var(--panel-border-subtle)] pt-4">
                    <Button
                      onClick={() => handleSaveProvider(provider)}
                      loading={savingAiProvider[provider]}
                    >
                      {!savingAiProvider[provider] && (
                        <Save className="w-4 h-4" />
                      )}
                      <span>
                        {savingAiProvider[provider]
                          ? "Salvando..."
                          : `Salvar ${providerMeta.name}`}
                      </span>
                    </Button>
                  </div>
                </div>
              );
            })}

            <div className={sectionShellClass}>
              <div className="mb-3">
                <h3 className="text-lg font-semibold text-[var(--panel-text)]">
                  Roteamento por funcionalidade
                </h3>
                <p className="text-sm text-[var(--panel-text-muted)]">
                  Escolha qual provedor/modelo cada funcionalidade de IA deve
                  usar. Se falhar, pode cair para OpenAI automaticamente.
                </p>
              </div>

              <div className="space-y-4">
                {AI_TASKS.map((task) => {
                  const routeState = aiRoutingForm[task.key];
                  const providerModelsState =
                    aiProviderModels[routeState.provider];
                  const providerApiKey =
                    aiProviderForms[routeState.provider].apiKey.trim();
                  const providerModelOptions = providerModelsState.options;
                  const routeModelInOptions = providerModelOptions.some(
                    (option) => option.value === routeState.model,
                  );
                  const modelOptions =
                    providerModelOptions.length > 0
                      ? [
                          ...(!routeModelInOptions && routeState.model
                            ? [
                                {
                                  value: routeState.model,
                                  label: routeState.model,
                                },
                              ]
                            : []),
                          ...providerModelOptions,
                        ]
                      : [];

                  const modelFieldPlaceholder = providerModelsState.loading
                    ? "Carregando modelos..."
                    : !providerApiKey
                      ? "Salve a API key do provedor"
                      : providerModelOptions.length > 0
                        ? "Selecione o modelo"
                        : "Nenhum modelo disponível";

                  return (
                    <div
                      key={task.key}
                      className={`${sectionInsetClass} space-y-3`}
                    >
                      <div>
                        <p className="text-sm font-semibold text-[var(--panel-text)]">
                          {task.label}
                        </p>
                        <p className="text-xs text-[var(--panel-text-muted)]">
                          {task.description}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[var(--panel-text-muted)]">
                            Provedor
                          </label>
                          <FilterSingleSelect
                            icon={Plug}
                            value={routeState.provider}
                            onChange={(value) => {
                              const nextProvider = isAiProvider(value)
                                ? value
                                : "openai";
                              const nextProviderModelsState =
                                aiProviderModels[nextProvider];
                              const nextProviderApiKey =
                                aiProviderForms[nextProvider].apiKey.trim();

                              if (
                                nextProviderApiKey &&
                                nextProviderModelsState.options.length === 0 &&
                                !nextProviderModelsState.loading
                              ) {
                                void loadProviderModels(
                                  nextProvider,
                                  nextProviderApiKey,
                                );
                              }

                              const nextModel = getPreferredTaskModel(
                                nextProvider,
                                nextProviderModelsState.options,
                              );

                              setAiRoutingForm((prev) => ({
                                ...prev,
                                [task.key]: {
                                  ...prev[task.key],
                                  provider: nextProvider,
                                  model: nextModel,
                                },
                              }));
                            }}
                            placeholder="Selecione o provedor"
                            includePlaceholderOption={false}
                            options={AI_PROVIDER_OPTIONS}
                            size="compact"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-[var(--panel-text-muted)]">
                            Modelo
                          </label>
                          <FilterSingleSelect
                            icon={Tag}
                            value={routeState.model}
                            onChange={(value) =>
                              setAiRoutingForm((prev) => ({
                                ...prev,
                                [task.key]: {
                                  ...prev[task.key],
                                  model: value,
                                },
                              }))
                            }
                            placeholder={modelFieldPlaceholder}
                            includePlaceholderOption={false}
                            options={modelOptions}
                            size="compact"
                            disabled={
                              providerModelsState.loading ||
                              modelOptions.length === 0
                            }
                          />
                          <p className="mt-1 text-[11px] text-[var(--panel-text-muted)]">
                            {providerModelsState.loading
                              ? "Consultando modelos na API do provedor..."
                              : !providerApiKey
                                ? "Configure e salve a API key deste provedor para carregar os modelos."
                                : providerModelsState.error
                                  ? providerModelsState.error
                                  : providerModelOptions.length > 0
                                    ? `${providerModelOptions.length} modelos disponíveis.`
                                    : "Nenhum modelo disponível para este provedor."}
                          </p>
                        </div>
                      </div>

                      <label className="inline-flex items-center gap-2 text-xs text-[var(--panel-text-muted)]">
                        <input
                          type="checkbox"
                          checked={routeState.fallbackToOpenAi}
                          onChange={(event) =>
                            setAiRoutingForm((prev) => ({
                              ...prev,
                              [task.key]: {
                                ...prev[task.key],
                                fallbackToOpenAi: event.target.checked,
                              },
                            }))
                          }
                          className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                        Se este provedor falhar, tentar OpenAI automaticamente.
                      </label>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-end border-t border-[color:var(--panel-border-subtle)] pt-4">
                <Button onClick={handleSaveRouting} loading={savingAiRouting}>
                  {!savingAiRouting && <Save className="w-4 h-4" />}
                  <span>
                    {savingAiRouting
                      ? "Salvando..."
                      : "Salvar roteamento de IA"}
                  </span>
                </Button>
              </div>
            </div>

            <div className={sectionShellClass}>
              <div className="mb-3">
                <h3 className="text-lg font-semibold text-[var(--panel-text)]">
                  Follow-up no WhatsApp
                </h3>
                <p className="text-sm text-[var(--panel-text-muted)]">
                  Defina instruções extras para a IA ao gerar follow-ups direto
                  do chat. O sistema continua enviando uma mensagem por linha.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--panel-text)]">
                    Instruções adicionais
                  </label>
                  <VariableAutocompleteTextarea
                    value={aiFollowUpInstructions}
                    onChange={setAiFollowUpInstructions}
                    rows={8}
                    suggestions={WHATSAPP_FOLLOW_UP_VARIABLE_SUGGESTIONS}
                    className="text-sm"
                    placeholder={
                      "Exemplo:\n" +
                      "- Fale como consultora de planos de saúde.\n" +
                      "- Seja objetiva e acolhedora.\n" +
                      "- Considere que agora em Brasília são {{hora_agora}} do dia {{data_hoje}}.\n" +
                      "- Evite texto longo.\n" +
                      "- Quando fizer sentido, termine com uma CTA simples."
                    }
                  />
                  <p className="mt-2 text-xs text-[var(--panel-text-muted)]">
                    Use este campo para orientar tom, abordagem comercial,
                    limites e preferências da sua operação. Variáveis
                    disponíveis: {"{{nome}}"}, {"{{primeiro_nome}}"},{" "}
                    {"{{data_hoje}}"}, {"{{hora_agora}}"} e{" "}
                    {"{{data_hora_atual_brasilia}}"}.
                  </p>
                  <p className="text-xs text-[var(--panel-text-muted)]">
                    As datas e horas são resolvidas no fuso de Brasília. Não
                    precisa repetir regras básicas do sistema.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end border-t border-[color:var(--panel-border-subtle)] pt-4">
                <Button
                  onClick={handleSaveFollowUpPrompt}
                  loading={savingAiFollowUpPrompt}
                >
                  {!savingAiFollowUpPrompt && <Save className="w-4 h-4" />}
                  <span>
                    {savingAiFollowUpPrompt
                      ? "Salvando..."
                      : "Salvar instruções de follow-up"}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-[var(--panel-text)]">
              WhatsApp (Whapi)
            </h2>
            <p className="text-sm text-[var(--panel-text-muted)]">
              Conecte o canal de WhatsApp para uso nos fluxos de automação.
            </p>
          </div>
          <div className={sectionShellClass}>
            <WhatsAppApiSettingsPanel />
          </div>
        </section>

        <section className="border-t border-[color:var(--panel-border-subtle)] pt-8">
          <div className="mb-6 space-y-1">
            <h2 className="text-xl font-semibold text-[var(--panel-text)]">
              Rastreamento - Landing Page
            </h2>
            <p className="text-sm text-[var(--panel-text-muted)] mt-1">
              Configure os códigos de rastreamento para a página de conversão
              (/lp)
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className={sectionShellClass}>
              <div className="flex items-center space-x-3 mb-4">
                <div className="rounded-full bg-amber-50 p-2 text-amber-700">
                  <Facebook className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--panel-text)]">
                    Meta Pixel
                  </h3>
                  <p className="text-sm text-[var(--panel-text-muted)]">
                    Código de rastreamento do Facebook/Instagram
                  </p>
                </div>
              </div>

              {metaPixelMessage && (
                <div
                  className={`p-3 rounded-lg border mb-4 ${
                    metaPixelMessage.type === "success"
                      ? "bg-green-50 border-green-200 text-green-800"
                      : "bg-red-50 border-red-200 text-red-800"
                  }`}
                >
                  <p className="text-sm">{metaPixelMessage.text}</p>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--panel-text)]">
                  Pixel ID
                </label>
                <Input
                  type="text"
                  value={metaPixelId}
                  onChange={(event) => setMetaPixelId(event.target.value)}
                  className="focus:ring-orange-500"
                  placeholder="1234567890"
                />
                <p className="mt-2 text-xs text-[var(--panel-text-muted)]">
                  Ex: 1234567890 (somente números)
                </p>
              </div>

              <Button
                onClick={handleSaveMetaPixel}
                loading={savingMetaPixel}
                fullWidth
                className="mt-4 border-amber-500 bg-amber-600 text-white hover:border-amber-600 hover:bg-amber-700"
              >
                {!savingMetaPixel && <Save className="w-4 h-4" />}
                <span>
                  {savingMetaPixel ? "Salvando..." : "Salvar Meta Pixel"}
                </span>
              </Button>
            </div>

            <div className={sectionShellClass}>
              <div className="flex items-center space-x-3 mb-4">
                <div className="rounded-full bg-amber-50 p-2 text-amber-700">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--panel-text)]">
                    Google Tag Manager
                  </h3>
                  <p className="text-sm text-[var(--panel-text-muted)]">
                    Container do GTM para a landing page
                  </p>
                </div>
              </div>

              {gtmMessage && (
                <div
                  className={`p-3 rounded-lg border mb-4 ${
                    gtmMessage.type === "success"
                      ? "bg-green-50 border-green-200 text-green-800"
                      : "bg-red-50 border-red-200 text-red-800"
                  }`}
                >
                  <p className="text-sm">{gtmMessage.text}</p>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--panel-text)]">
                  GTM ID
                </label>
                <Input
                  type="text"
                  value={gtmId}
                  onChange={(event) => setGtmId(event.target.value)}
                  className="focus:ring-orange-500"
                  placeholder="GTM-XXXXXXX"
                />
                <p className="mt-2 text-xs text-[var(--panel-text-muted)]">
                  Ex: GTM-ABC123D
                </p>
              </div>

              <Button
                onClick={handleSaveGtm}
                loading={savingGtm}
                fullWidth
                className="mt-4 border-amber-500 bg-amber-600 text-white hover:border-amber-600 hover:bg-amber-700"
              >
                {!savingGtm && <Save className="w-4 h-4" />}
                <span>{savingGtm ? "Salvando..." : "Salvar GTM"}</span>
              </Button>
            </div>
          </div>

          <div className={`${sectionInsetClass} mt-6`}>
            <div className="flex items-start space-x-3">
              <Info className="mt-0.5 h-5 w-5 text-amber-600" />
              <div className="text-sm text-[var(--panel-text-muted)]">
                <p className="font-semibold text-[var(--panel-text)]">
                  Como usar:
                </p>
                <p>
                  Essas configurações serão aplicadas automaticamente na landing
                  page de conversão (/lp). Meta Pixel e GTM ajudam a rastrear
                  conversões e otimizar campanhas.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PanelAdaptiveLoadingFrame>
  );
}
