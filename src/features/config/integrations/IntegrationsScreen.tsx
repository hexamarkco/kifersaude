import { useCallback, useEffect, useState } from "react";
import {
  Save,
  Facebook,
  MessageCircle,
  Sparkles,
  Tag,
} from "lucide-react";

import { configService } from "../data/configService";
import type { IntegrationSetting } from "../domain/types";
import { toast } from "../../../lib/toast";
import { IntegrationsSkeleton } from "../../../components/ui/panelSkeletons";
import { useAdaptiveLoading } from "../../../hooks/useAdaptiveLoading";
import { PanelAdaptiveLoadingFrame } from "../../../components/ui/panelLoading";
import {
  Alert,
  Button,
  Card,
  CardIcon,
  Input,
  SectionHeader,
  Switch,
  FilterSelect,
  SegmentedControl,
} from "../../../design-system";
import WhatsAppApiSettingsPanel from "./components/WhatsAppApiSettingsPanel";
import { useConfigParam } from "../shared/useConfigTab";
import { normalizeModelOptions } from "./shared/integrationsSettings";
import { loadAiProviderModels } from "./data/integrationsApi";

const AI_PROVIDER_OPENAI_SLUG = "ai_provider_openai";
const AI_ROUTING_SLUG = "ai_routing";

const META_PIXEL_SLUG = "meta_pixel";
const GTM_SLUG = "google_tag_manager";

const OPENAI_DEFAULT_TEXT_MODEL = "gpt-4o-mini";
const OPENAI_DEFAULT_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";

type MessageState = { type: "success" | "error"; text: string } | null;
type AiProvider = "openai";
type AiTaskKey =
  | "rewrite_message"
  | "follow_up_generation"
  | "follow_up_agenda_organization"
  | "whatsapp_audio_transcription"
  | "attendance_critique"
  | "autonomous_attendance";
type AiTaskKind = "text" | "transcription";
type ModelOption = { value: string; label: string };

type AiProviderFormState = {
  enabled: boolean;
};

type AiTaskRouteState = {
  provider: AiProvider;
  model: string;
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

const AI_PROVIDER_ORDER: AiProvider[] = ["openai"];

const AI_PROVIDER_META: Record<AiProvider, AiProviderMeta> = {
  openai: {
    slug: AI_PROVIDER_OPENAI_SLUG,
    name: "OpenAI",
    description:
      "Use modelos GPT para reescrita, follow-up e futuras tarefas de IA.",
  },
};

const AI_TASKS: Array<{ key: AiTaskKey; label: string; description: string; kind: AiTaskKind }> =
  [
    {
      key: "rewrite_message",
      label: "Reescrita de mensagem",
      description:
        "Usado no WhatsApp para reescrever mensagens antes de enviar.",
      kind: "text",
    },
    {
      key: "follow_up_generation",
      label: "Geração de follow-up",
      description: "Usado em lembretes para sugerir mensagens de follow-up.",
      kind: "text",
    },
    {
      key: "follow_up_agenda_organization",
      label: "Organização da agenda de follow-ups",
      description: "Usado para priorizar e reagendar a fila diária de follow-ups.",
      kind: "text",
    },
    {
      key: "whatsapp_audio_transcription",
      label: "Transcrição de áudio do WhatsApp",
      description: "Usado no inbox para transcrever notas de voz e áudios sob demanda.",
      kind: "transcription",
    },
    {
      key: "attendance_critique",
      label: "Crítica de atendimento (IA)",
      description: "Usado no inbox para gerar uma análise de qualidade do atendimento, sob demanda.",
      kind: "text",
    },
    {
      key: "autonomous_attendance",
      label: "Atendimento autônomo",
      description: "Usado no chat de testes (/chat) para simular o atendimento autônomo antes de ligar a automação no inbox real.",
      kind: "text",
    },
  ];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toTrimmedString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const isAiProvider = (value: string): value is AiProvider =>
  value === "openai";

const getTaskKind = (taskKey: AiTaskKey): AiTaskKind =>
  AI_TASKS.find((task) => task.key === taskKey)?.kind ?? "text";

const normalizeModelName = (value: string) => value.trim().toLowerCase();

const isOpenAiTranscriptionModel = (model: string): boolean => {
  const normalized = normalizeModelName(model);
  return normalized === "whisper-1" || normalized.includes("transcribe");
};

const isOpenAiTextModel = (model: string): boolean => {
  const normalized = normalizeModelName(model);
  return Boolean(normalized) && !isOpenAiTranscriptionModel(normalized);
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
});

const getDefaultTaskModel = (_provider: AiProvider, taskKey?: AiTaskKey): string => {
  if (taskKey && getTaskKind(taskKey) === "transcription") {
    return OPENAI_DEFAULT_TRANSCRIPTION_MODEL;
  }

  return OPENAI_DEFAULT_TEXT_MODEL;
};

function getCompatibleModelOptions(
  taskKey: AiTaskKey,
  _provider: AiProvider,
  providerOptions: ModelOption[],
): ModelOption[] {
  const taskKind = getTaskKind(taskKey);

  if (taskKind === "transcription") {
    const transcriptionOptions = providerOptions.filter((option) => isOpenAiTranscriptionModel(option.value));
    const hasDefault = transcriptionOptions.some((option) => option.value === OPENAI_DEFAULT_TRANSCRIPTION_MODEL);
    const hasWhisper = transcriptionOptions.some((option) => option.value === "whisper-1");

    return [
      ...(hasDefault ? [] : [{ value: OPENAI_DEFAULT_TRANSCRIPTION_MODEL, label: OPENAI_DEFAULT_TRANSCRIPTION_MODEL }]),
      ...transcriptionOptions,
      ...(hasWhisper ? [] : [{ value: "whisper-1", label: "whisper-1" }]),
    ];
  }

  return providerOptions.filter((option) => isOpenAiTextModel(option.value));
}

const getTaskRouteError = (taskKey: AiTaskKey, route: AiTaskRouteState): string | null => {
  const taskKind = getTaskKind(taskKey);

  if (taskKind === "transcription") {
    if (!isOpenAiTranscriptionModel(route.model)) {
      return "Transcrição precisa usar um modelo de áudio, como gpt-4o-mini-transcribe, gpt-4o-transcribe ou whisper-1.";
    }
  }

  if (taskKind === "text" && isOpenAiTranscriptionModel(route.model)) {
    return "Reescrita e follow-up precisam usar modelos de texto, não modelos de transcrição.";
  }

  return null;
};

const createDefaultProviderForms = (): Record<
  AiProvider,
  AiProviderFormState
> => ({
  openai: {
    enabled: false,
  },
});

const createDefaultRoutingForm = (): AiRoutingFormState => ({
  rewrite_message: {
    provider: "openai",
    model: getDefaultTaskModel("openai", "rewrite_message"),
  },
  follow_up_generation: {
    provider: "openai",
    model: getDefaultTaskModel("openai", "follow_up_generation"),
  },
  follow_up_agenda_organization: {
    provider: "openai",
    model: getDefaultTaskModel("openai", "follow_up_agenda_organization"),
  },
  whatsapp_audio_transcription: {
    provider: "openai",
    model: getDefaultTaskModel("openai", "whatsapp_audio_transcription"),
  },
  attendance_critique: {
    provider: "openai",
    model: getDefaultTaskModel("openai", "attendance_critique"),
  },
  autonomous_attendance: {
    provider: "openai",
    model: getDefaultTaskModel("openai", "autonomous_attendance"),
  },
});

const normalizeProviderSettings = (integration: IntegrationSetting | null): AiProviderFormState => {
  const settings = isRecord(integration?.settings) ? integration.settings : {};

  return {
    enabled: settings.enabled === true,
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

    const model = (!providerCandidate || isAiProvider(providerCandidate))
      ? toTrimmedString(rawTask.model) ||
        toTrimmedString(rawTask.textModel) ||
        getDefaultTaskModel(provider, task.key)
      : getDefaultTaskModel(provider, task.key);

    accumulator[task.key] = {
      provider,
      model,
    };

    return accumulator;
  }, {} as AiRoutingFormState);
};

export default function IntegrationsScreen() {
  const [activeSection, setActiveSection] = useConfigParam(
    "section",
    ["ai", "whatsapp", "tracking"] as const,
    "ai",
  );
  const [aiProviderIntegrations, setAiProviderIntegrations] = useState<
    Record<AiProvider, IntegrationSetting | null>
  >({
    openai: null,
  });
  const [aiProviderForms, setAiProviderForms] = useState<
    Record<AiProvider, AiProviderFormState>
  >(() => createDefaultProviderForms());
  const [aiRoutingIntegration, setAiRoutingIntegration] =
    useState<IntegrationSetting | null>(null);
  const [aiRoutingForm, setAiRoutingForm] = useState<AiRoutingFormState>(() =>
    createDefaultRoutingForm(),
  );
  const [aiProviderModels, setAiProviderModels] = useState<
    Record<AiProvider, AiProviderModelsState>
  >(() => createDefaultProviderModelsState());
  const [loadingAi, setLoadingAi] = useState(true);
  const [savingAiProvider, setSavingAiProvider] = useState<
    Record<AiProvider, boolean>
  >({
    openai: false,
  });
  const [savingAiRouting, setSavingAiRouting] = useState(false);
  const [metaPixelIntegration, setMetaPixelIntegration] =
    useState<IntegrationSetting | null>(null);
  const [metaPixelId, setMetaPixelId] = useState("");
  const [loadingMetaPixel, setLoadingMetaPixel] = useState(true);
  const [savingMetaPixel, setSavingMetaPixel] = useState(false);

  const [gtmIntegration, setGtmIntegration] =
    useState<IntegrationSetting | null>(null);
  const [gtmId, setGtmId] = useState("");
  const [loadingGtm, setLoadingGtm] = useState(true);
  const [savingGtm, setSavingGtm] = useState(false);

  const setAiMessage = (message: MessageState) => {
    if (!message) return;
    if (message.type === "success") toast.success(message.text);
    else toast.error(message.text);
  };

  const setMetaPixelMessage = (message: MessageState) => {
    if (!message) return;
    if (message.type === "success") toast.success(message.text);
    else toast.error(message.text);
  };

  const setGtmMessage = (message: MessageState) => {
    if (!message) return;
    if (message.type === "success") toast.success(message.text);
    else toast.error(message.text);
  };

  const loadingUi = useAdaptiveLoading(loadingAi);

  const loadProviderModels = useCallback(async (provider: AiProvider) => {
    setAiProviderModels((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        loading: true,
        error: null,
      },
    }));

    try {
      const data = await loadAiProviderModels(provider);
      const payload = isRecord(data) ? data : {};
      const options = normalizeModelOptions(payload.models);

      setAiProviderModels((prev) => ({
        ...prev,
        [provider]: {
          loading: false,
          options,
          error:
            options.length === 0
              ? "Nenhum modelo retornado pelo provedor."
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
          error: "Não foi possível carregar os modelos. Confirme o Edge Secret deste provedor.",
        },
      }));
    }
  }, []);

  const loadAiIntegrations = useCallback(async () => {
    setLoadingAi(true);
    setAiMessage(null);

    try {
      const [openaiIntegration, routingIntegration] = await Promise.all([
        configService.getIntegrationSetting(AI_PROVIDER_OPENAI_SLUG),
        configService.getIntegrationSetting(AI_ROUTING_SLUG),
      ]);

      const nextProviderIntegrations: Record<
        AiProvider,
        IntegrationSetting | null
      > = {
        openai: openaiIntegration,
      };

      const nextProviderForms: Record<AiProvider, AiProviderFormState> = {
        openai: normalizeProviderSettings(openaiIntegration),
      };

      setAiProviderIntegrations(nextProviderIntegrations);
      setAiProviderForms(nextProviderForms);
      setAiRoutingIntegration(routingIntegration);
      setAiRoutingForm(normalizeRoutingSettings(routingIntegration));
      setAiProviderModels(createDefaultProviderModelsState());

      for (const provider of AI_PROVIDER_ORDER) {
        if (nextProviderForms[provider].enabled) {
          void loadProviderModels(provider);
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
        },
      }));

      if (settingsPayload.enabled) {
        void loadProviderModels(provider);
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

    const invalidTask = AI_TASKS.find((task) => getTaskRouteError(task.key, aiRoutingForm[task.key]));
    if (invalidTask) {
      setAiMessage({
        type: "error",
        text: `${invalidTask.label}: ${getTaskRouteError(invalidTask.key, aiRoutingForm[invalidTask.key])}`,
      });
      setSavingAiRouting(false);
      return;
    }

    const tasksPayload = AI_TASKS.reduce(
      (accumulator, task) => {
        const route = aiRoutingForm[task.key];
        const model =
          route.model.trim() || getDefaultTaskModel(route.provider, task.key);

        accumulator[task.key] = {
          provider: route.provider,
          model,
        };

        return accumulator;
      },
      {} as Record<
        AiTaskKey,
        { provider: AiProvider; model: string }
      >,
    );

    const settingsPayload = {
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
    aiProviderIntegrations.openai !== null ||
    metaPixelIntegration !== null ||
    gtmIntegration !== null;

  return (
    <PanelAdaptiveLoadingFrame
      loading={loadingAi}
      phase={loadingUi.phase}
      hasContent={hasIntegrationSnapshot}
      skeleton={<IntegrationsSkeleton />}
      overlayLabel="Atualizando integrações..."
      stageClassName="min-h-[460px]"
    >
      <div className="space-y-6">
        <SectionHeader
          eyebrow="Canais e inteligência"
          title="Integrações"
          description="Configure cada conector por finalidade, sem misturar credenciais, automações e rastreamento."
        />
        <SegmentedControl
          items={[
            { id: "ai", label: "Inteligência artificial", icon: Sparkles },
            { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
            { id: "tracking", label: "Rastreamento", icon: Tag },
          ]}
          value={activeSection}
          onChange={setActiveSection}
          listClassName="flex-nowrap overflow-x-auto"
        />

        {activeSection === "ai" && <section className="space-y-4">
          <SectionHeader title="Integração de IA" description="Configure a OpenAI e escolha o modelo de cada funcionalidade." />


          <div className="grid gap-4 xl:grid-cols-1">
            {AI_PROVIDER_ORDER.map((provider) => {
              const providerMeta = AI_PROVIDER_META[provider];
              const formState = aiProviderForms[provider];
              const providerModelsState = aiProviderModels[provider];

              const providerModelsHint = providerModelsState.loading
                ? "Carregando modelos da API para o roteamento..."
                : !formState.enabled
                  ? "Ative o provedor para validar o Edge Secret e carregar modelos."
                  : providerModelsState.error
                    ? providerModelsState.error
                    : providerModelsState.options.length > 0
                      ? `${providerModelsState.options.length} modelos carregados da API do provedor.`
                      : "Nenhum modelo retornado pelo provedor.";

              return (
                <Card key={provider}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-[var(--font-display)] text-lg font-semibold text-[var(--text-primary)]">
                        {providerMeta.name}
                      </h3>
                      <p className="text-sm text-[var(--text-muted)]">
                        {providerMeta.description}
                      </p>
                    </div>
                    <Switch
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
                        label="Ativo"
                      />
                  </div>

                  <div className="mt-4 rounded-[var(--kds-radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-hover)] px-3 py-2">
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      Credencial protegida por Edge Secret
                    </p>
                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                      {providerModelsHint}
                    </p>
                  </div>

                  <div className="kds-ai-integration-action mt-4 flex items-center justify-end border-t border-[var(--border-subtle)] pt-4">
                    <Button
                      onClick={() => handleSaveProvider(provider)}
                      loading={savingAiProvider[provider]}
                    >
                      {!savingAiProvider[provider] && (
                        <Save className="kds-control-icon" />
                      )}
                      <span>
                        {savingAiProvider[provider]
                          ? "Salvando..."
                          : `Salvar ${providerMeta.name}`}
                      </span>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="space-y-4">
            <Card>
              <div className="mb-3">
                <h3 className="font-[var(--font-display)] text-lg font-semibold text-[var(--text-primary)]">
                  Roteamento por funcionalidade
                </h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Escolha qual modelo OpenAI cada funcionalidade de IA deve usar.
                  Em caso de incompatibilidade, o backend pode usar o modelo OpenAI padrão.
                </p>
              </div>

              <div className="space-y-4">
                {AI_TASKS.map((task) => {
                  const routeState = aiRoutingForm[task.key];
                  const providerModelsState =
                    aiProviderModels[routeState.provider];
                  const providerEnabled =
                    aiProviderForms[routeState.provider].enabled;
                  const providerModelOptions = getCompatibleModelOptions(
                    task.key,
                    routeState.provider,
                    providerModelsState.options,
                  );
                  const routeModelInOptions = providerModelOptions.some(
                    (option) => option.value === routeState.model,
                  );
                  const routeError = getTaskRouteError(task.key, routeState);
                  const modelOptions =
                    providerModelOptions.length > 0
                      ? [
                          ...(!routeModelInOptions && routeState.model
                            ? [
                                {
                                  value: routeState.model,
                                  label: routeError
                                    ? `${routeState.model} (incompatível)`
                                    : routeState.model,
                                },
                              ]
                            : []),
                          ...providerModelOptions,
                        ]
                      : [];

                  const modelFieldPlaceholder = providerModelsState.loading
                    ? "Carregando modelos..."
                    : !providerEnabled
                      ? "Ative o provedor"
                      : providerModelOptions.length > 0
                        ? "Selecione o modelo"
                        : "Nenhum modelo disponível";

                  return (
                    <Card
                      key={task.key}
                      className="space-y-3"
                      variant="muted"
                      padding="sm"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {task.label}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {task.description}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                            Modelo
                          </label>
                          <FilterSelect
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
                            size="md"
                            disabled={
                              providerModelsState.loading ||
                              modelOptions.length === 0
                            }
                          />
                          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                            {routeError
                              ? routeError
                              : providerModelsState.loading
                              ? "Consultando modelos na API da OpenAI..."
                              : !providerEnabled
                                ? "Ative a OpenAI e confirme o Edge Secret para carregar os modelos."
                                : providerModelsState.error
                                  ? providerModelsState.error
                                  : providerModelOptions.length > 0
                                    ? `${providerModelOptions.length} modelos disponíveis.`
                                    : "Nenhum modelo OpenAI disponível."}
                          </p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              <div className="kds-ai-integration-action mt-4 flex items-center justify-end border-t border-[var(--border-subtle)] pt-4">
                <Button onClick={handleSaveRouting} loading={savingAiRouting}>
                  {!savingAiRouting && <Save className="kds-control-icon" />}
                  <span>
                    {savingAiRouting
                      ? "Salvando..."
                      : "Salvar roteamento de IA"}
                  </span>
                </Button>
              </div>
            </Card>

          </div>
        </section>}

        {activeSection === "whatsapp" && <section className="space-y-4">
          <SectionHeader title="WhatsApp (Whapi)" description="Conecte o canal de WhatsApp para uso nos fluxos de automação." />
          <WhatsAppApiSettingsPanel />
        </section>}

        {activeSection === "tracking" && <section className="space-y-5">
          <SectionHeader title="Rastreamento da landing page" description="Configure os códigos usados em /lp para medir conversões e campanhas." />

          <Alert tone="info">
            Os identificadores abaixo são aplicados automaticamente na landing page de conversão.
          </Alert>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <div className="flex items-center space-x-3 mb-4">
                <CardIcon tone="gold">
                  <Facebook className="w-5 h-5" />
                </CardIcon>
                <div>
                  <h3 className="font-[var(--font-display)] text-lg font-semibold text-[var(--text-primary)]">
                    Meta Pixel
                  </h3>
                  <p className="text-sm text-[var(--text-muted)]">
                    Código de rastreamento do Facebook/Instagram
                  </p>
                </div>
              </div>


              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
                  Pixel ID
                </label>
                <Input
                  type="text"
                  value={metaPixelId}
                  onChange={(event) => setMetaPixelId(event.target.value)}
                  placeholder="1234567890"
                />
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Ex: 1234567890 (somente números)
                </p>
              </div>

              <Button
                onClick={handleSaveMetaPixel}
                loading={savingMetaPixel}
                fullWidth
                className="mt-4"
              >
                {!savingMetaPixel && <Save className="kds-control-icon" />}
                <span>
                  {savingMetaPixel ? "Salvando..." : "Salvar Meta Pixel"}
                </span>
              </Button>
            </Card>

            <Card>
              <div className="flex items-center space-x-3 mb-4">
                <CardIcon tone="gold">
                  <Tag className="w-5 h-5" />
                </CardIcon>
                <div>
                  <h3 className="font-[var(--font-display)] text-lg font-semibold text-[var(--text-primary)]">
                    Google Tag Manager
                  </h3>
                  <p className="text-sm text-[var(--text-muted)]">
                    Container do GTM para a landing page
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
                  GTM ID
                </label>
                <Input
                  type="text"
                  value={gtmId}
                  onChange={(event) => setGtmId(event.target.value)}
                  placeholder="GTM-XXXXXXX"
                />
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Ex: GTM-ABC123D
                </p>
              </div>

              <Button
                onClick={handleSaveGtm}
                loading={savingGtm}
                fullWidth
                className="mt-4"
              >
                {!savingGtm && <Save className="kds-control-icon" />}
                <span>{savingGtm ? "Salvando..." : "Salvar GTM"}</span>
              </Button>
            </Card>
          </div>

        </section>}
      </div>
    </PanelAdaptiveLoadingFrame>
  );
}
