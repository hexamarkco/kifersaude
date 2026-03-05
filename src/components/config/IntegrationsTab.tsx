import { useEffect, useState } from 'react';
import {
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Loader2,
  Plug,
  Save,
  ShieldCheck,
  Facebook,
  Tag,
} from 'lucide-react';

import { configService } from '../../lib/configService';
import type { IntegrationSetting } from '../../lib/supabase';
import WhatsAppApiSettings from './WhatsAppApiSettings';
import FilterSingleSelect from '../FilterSingleSelect';
import { IntegrationsSkeleton } from '../ui/panelSkeletons';
import { useAdaptiveLoading } from '../../hooks/useAdaptiveLoading';
import { PanelAdaptiveLoadingFrame } from '../ui/panelLoading';

const LEGACY_GPT_SLUG = 'gpt_transcription';
const AI_PROVIDER_OPENAI_SLUG = 'ai_provider_openai';
const AI_PROVIDER_GEMINI_SLUG = 'ai_provider_gemini';
const AI_PROVIDER_CLAUDE_SLUG = 'ai_provider_claude';
const AI_ROUTING_SLUG = 'ai_routing';

const META_PIXEL_SLUG = 'meta_pixel';
const GTM_SLUG = 'google_tag_manager';

const OPENAI_DEFAULT_TEXT_MODEL = 'gpt-4o-mini';
const OPENAI_DEFAULT_TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe';
const GEMINI_DEFAULT_TEXT_MODEL = 'gemini-2.0-flash';
const CLAUDE_DEFAULT_TEXT_MODEL = 'claude-3-5-sonnet-latest';

type MessageState = { type: 'success' | 'error'; text: string } | null;
type AiProvider = 'openai' | 'gemini' | 'claude';
type AiTaskKey = 'rewrite_message' | 'follow_up_generation' | 'whatsapp_audio_transcription';

type AiProviderFormState = {
  enabled: boolean;
  apiKey: string;
  defaultModelText: string;
  defaultModelTranscription: string;
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
  textModelOptions: Array<{ value: string; label: string }>;
};

const AI_PROVIDER_ORDER: AiProvider[] = ['openai', 'gemini', 'claude'];

const AI_PROVIDER_META: Record<AiProvider, AiProviderMeta> = {
  openai: {
    slug: AI_PROVIDER_OPENAI_SLUG,
    name: 'OpenAI',
    description: 'Use modelos GPT para reescrita, follow-up e futuras tarefas de IA.',
    textModelOptions: [
      { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
      { value: 'gpt-4.1-mini', label: 'gpt-4.1-mini' },
      { value: 'gpt-4o', label: 'gpt-4o' },
      { value: 'gpt-4.1', label: 'gpt-4.1' },
    ],
  },
  gemini: {
    slug: AI_PROVIDER_GEMINI_SLUG,
    name: 'Google Gemini',
    description: 'Conecte sua API key do Gemini para usar modelos da Google.',
    textModelOptions: [
      { value: 'gemini-2.0-flash', label: 'gemini-2.0-flash' },
      { value: 'gemini-2.0-flash-lite', label: 'gemini-2.0-flash-lite' },
      { value: 'gemini-1.5-pro', label: 'gemini-1.5-pro' },
    ],
  },
  claude: {
    slug: AI_PROVIDER_CLAUDE_SLUG,
    name: 'Claude (Anthropic)',
    description: 'Conecte sua API key da Anthropic para usar modelos Claude.',
    textModelOptions: [
      { value: 'claude-3-5-sonnet-latest', label: 'claude-3-5-sonnet-latest' },
      { value: 'claude-3-5-haiku-latest', label: 'claude-3-5-haiku-latest' },
      { value: 'claude-3-opus-latest', label: 'claude-3-opus-latest' },
    ],
  },
};

const AI_TASKS: Array<{ key: AiTaskKey; label: string; description: string }> = [
  {
    key: 'rewrite_message',
    label: 'Reescrita de mensagem',
    description: 'Usado no WhatsApp para reescrever mensagens antes de enviar.',
  },
  {
    key: 'follow_up_generation',
    label: 'Geracao de follow-up',
    description: 'Usado em lembretes para sugerir mensagens de follow-up.',
  },
  {
    key: 'whatsapp_audio_transcription',
    label: 'Transcricao de audio (futuro)',
    description: 'Ja deixa definido o provedor/modelo para futura transcricao no WhatsApp.',
  },
];

const AI_PROVIDER_OPTIONS = AI_PROVIDER_ORDER.map((provider) => ({
  value: provider,
  label: AI_PROVIDER_META[provider].name,
}));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toTrimmedString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const isAiProvider = (value: string): value is AiProvider =>
  value === 'openai' || value === 'gemini' || value === 'claude';

const getProviderDefaults = (provider: AiProvider): Pick<AiProviderFormState, 'defaultModelText' | 'defaultModelTranscription'> => {
  if (provider === 'openai') {
    return {
      defaultModelText: OPENAI_DEFAULT_TEXT_MODEL,
      defaultModelTranscription: OPENAI_DEFAULT_TRANSCRIPTION_MODEL,
    };
  }

  if (provider === 'gemini') {
    return {
      defaultModelText: GEMINI_DEFAULT_TEXT_MODEL,
      defaultModelTranscription: GEMINI_DEFAULT_TEXT_MODEL,
    };
  }

  return {
    defaultModelText: CLAUDE_DEFAULT_TEXT_MODEL,
    defaultModelTranscription: CLAUDE_DEFAULT_TEXT_MODEL,
  };
};

const createDefaultProviderForms = (): Record<AiProvider, AiProviderFormState> => ({
  openai: {
    enabled: false,
    apiKey: '',
    ...getProviderDefaults('openai'),
  },
  gemini: {
    enabled: false,
    apiKey: '',
    ...getProviderDefaults('gemini'),
  },
  claude: {
    enabled: false,
    apiKey: '',
    ...getProviderDefaults('claude'),
  },
});

const getDefaultTaskModel = (
  task: AiTaskKey,
  provider: AiProvider,
  providerForms: Record<AiProvider, AiProviderFormState>,
): string => {
  if (task === 'whatsapp_audio_transcription') {
    return providerForms[provider].defaultModelTranscription || providerForms[provider].defaultModelText;
  }

  return providerForms[provider].defaultModelText;
};

const createDefaultRoutingForm = (providerForms: Record<AiProvider, AiProviderFormState>): AiRoutingFormState => ({
  rewrite_message: {
    provider: 'openai',
    model: getDefaultTaskModel('rewrite_message', 'openai', providerForms),
    fallbackToOpenAi: true,
  },
  follow_up_generation: {
    provider: 'openai',
    model: getDefaultTaskModel('follow_up_generation', 'openai', providerForms),
    fallbackToOpenAi: true,
  },
  whatsapp_audio_transcription: {
    provider: 'openai',
    model: getDefaultTaskModel('whatsapp_audio_transcription', 'openai', providerForms),
    fallbackToOpenAi: true,
  },
});

const normalizeProviderSettings = (
  provider: AiProvider,
  integration: IntegrationSetting | null,
  legacyIntegration: IntegrationSetting | null,
): AiProviderFormState => {
  const settings = isRecord(integration?.settings) ? integration.settings : {};
  const legacySettings = isRecord(legacyIntegration?.settings) ? legacyIntegration.settings : {};
  const defaults = getProviderDefaults(provider);

  const legacyApiKey = provider === 'openai' ? toTrimmedString(legacySettings.apiKey) : '';
  const legacyTextModel =
    provider === 'openai'
      ? toTrimmedString(legacySettings.textModel) || toTrimmedString(legacySettings.model)
      : '';

  const apiKey = toTrimmedString(settings.apiKey) || legacyApiKey;
  const defaultModelText =
    toTrimmedString(settings.defaultModelText) ||
    toTrimmedString(settings.textModel) ||
    toTrimmedString(settings.model) ||
    legacyTextModel ||
    defaults.defaultModelText;
  const defaultModelTranscription =
    toTrimmedString(settings.defaultModelTranscription) ||
    toTrimmedString(settings.transcriptionModel) ||
    defaults.defaultModelTranscription;

  const enabled =
    typeof settings.enabled === 'boolean'
      ? settings.enabled
      : provider === 'openai'
        ? apiKey.length > 0
        : false;

  return {
    enabled,
    apiKey,
    defaultModelText,
    defaultModelTranscription,
  };
};

const normalizeRoutingSettings = (
  integration: IntegrationSetting | null,
  providerForms: Record<AiProvider, AiProviderFormState>,
): AiRoutingFormState => {
  const defaults = createDefaultRoutingForm(providerForms);
  const settings = isRecord(integration?.settings) ? integration.settings : {};
  const tasks = isRecord(settings.tasks) ? settings.tasks : {};

  return AI_TASKS.reduce((accumulator, task) => {
    const rawTask = isRecord(tasks[task.key]) ? tasks[task.key] : {};
    const providerCandidate = toTrimmedString(rawTask.provider).toLowerCase();
    const provider = isAiProvider(providerCandidate) ? providerCandidate : defaults[task.key].provider;

    const model =
      toTrimmedString(rawTask.model) ||
      toTrimmedString(rawTask.textModel) ||
      getDefaultTaskModel(task.key, provider, providerForms);

    const fallbackToOpenAi =
      typeof rawTask.fallbackToOpenAi === 'boolean'
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

export default function IntegrationsTab() {
  const [aiProviderIntegrations, setAiProviderIntegrations] = useState<Record<AiProvider, IntegrationSetting | null>>({
    openai: null,
    gemini: null,
    claude: null,
  });
  const [aiProviderForms, setAiProviderForms] = useState<Record<AiProvider, AiProviderFormState>>(() =>
    createDefaultProviderForms(),
  );
  const [aiRoutingIntegration, setAiRoutingIntegration] = useState<IntegrationSetting | null>(null);
  const [aiRoutingForm, setAiRoutingForm] = useState<AiRoutingFormState>(() =>
    createDefaultRoutingForm(createDefaultProviderForms()),
  );
  const [loadingAi, setLoadingAi] = useState(true);
  const [savingAiProvider, setSavingAiProvider] = useState<Record<AiProvider, boolean>>({
    openai: false,
    gemini: false,
    claude: false,
  });
  const [savingAiRouting, setSavingAiRouting] = useState(false);
  const [aiMessage, setAiMessage] = useState<MessageState>(null);
  const [showProviderApiKey, setShowProviderApiKey] = useState<Record<AiProvider, boolean>>({
    openai: false,
    gemini: false,
    claude: false,
  });

  const [metaPixelIntegration, setMetaPixelIntegration] = useState<IntegrationSetting | null>(null);
  const [metaPixelId, setMetaPixelId] = useState('');
  const [loadingMetaPixel, setLoadingMetaPixel] = useState(true);
  const [savingMetaPixel, setSavingMetaPixel] = useState(false);
  const [metaPixelMessage, setMetaPixelMessage] = useState<MessageState>(null);

  const [gtmIntegration, setGtmIntegration] = useState<IntegrationSetting | null>(null);
  const [gtmId, setGtmId] = useState('');
  const [loadingGtm, setLoadingGtm] = useState(true);
  const [savingGtm, setSavingGtm] = useState(false);
  const [gtmMessage, setGtmMessage] = useState<MessageState>(null);

  const loadingUi = useAdaptiveLoading(loadingAi);

  useEffect(() => {
    void loadAiIntegrations();
    void loadMetaPixel();
    void loadGtm();
  }, []);

  void loadingMetaPixel;
  void loadingGtm;

  const loadAiIntegrations = async () => {
    setLoadingAi(true);
    setAiMessage(null);

    try {
      const [openaiIntegration, geminiIntegration, claudeIntegration, routingIntegration, legacyGptIntegration] =
        await Promise.all([
          configService.getIntegrationSetting(AI_PROVIDER_OPENAI_SLUG),
          configService.getIntegrationSetting(AI_PROVIDER_GEMINI_SLUG),
          configService.getIntegrationSetting(AI_PROVIDER_CLAUDE_SLUG),
          configService.getIntegrationSetting(AI_ROUTING_SLUG),
          configService.getIntegrationSetting(LEGACY_GPT_SLUG),
        ]);

      const nextProviderIntegrations: Record<AiProvider, IntegrationSetting | null> = {
        openai: openaiIntegration,
        gemini: geminiIntegration,
        claude: claudeIntegration,
      };

      const nextProviderForms: Record<AiProvider, AiProviderFormState> = {
        openai: normalizeProviderSettings('openai', openaiIntegration, legacyGptIntegration),
        gemini: normalizeProviderSettings('gemini', geminiIntegration, null),
        claude: normalizeProviderSettings('claude', claudeIntegration, null),
      };

      setAiProviderIntegrations(nextProviderIntegrations);
      setAiProviderForms(nextProviderForms);
      setAiRoutingIntegration(routingIntegration);
      setAiRoutingForm(normalizeRoutingSettings(routingIntegration, nextProviderForms));
    } catch (error) {
      console.error('Erro ao carregar configuracoes de IA:', error);
      setAiMessage({ type: 'error', text: 'Nao foi possivel carregar as configuracoes de IA.' });
    } finally {
      setLoadingAi(false);
    }
  };

  const handleSaveProvider = async (provider: AiProvider) => {
    const currentForm = aiProviderForms[provider];
    const providerMeta = AI_PROVIDER_META[provider];

    setSavingAiProvider((prev) => ({ ...prev, [provider]: true }));
    setAiMessage(null);

    const settingsPayload = {
      enabled: currentForm.enabled,
      apiKey: currentForm.apiKey.trim(),
      defaultModelText: currentForm.defaultModelText.trim() || getProviderDefaults(provider).defaultModelText,
      defaultModelTranscription:
        currentForm.defaultModelTranscription.trim() ||
        getProviderDefaults(provider).defaultModelTranscription,
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
      setAiMessage({ type: 'error', text: `Erro ao salvar configuracao de ${providerMeta.name}.` });
    } else {
      const savedIntegration = result.data ?? integration;
      if (savedIntegration) {
        setAiProviderIntegrations((prev) => ({ ...prev, [provider]: savedIntegration }));
      }

      setAiProviderForms((prev) => ({
        ...prev,
        [provider]: {
          enabled: settingsPayload.enabled,
          apiKey: settingsPayload.apiKey,
          defaultModelText: settingsPayload.defaultModelText,
          defaultModelTranscription: settingsPayload.defaultModelTranscription,
        },
      }));

      setAiMessage({ type: 'success', text: `${providerMeta.name} atualizado com sucesso.` });
    }

    setSavingAiProvider((prev) => ({ ...prev, [provider]: false }));
  };

  const handleSaveRouting = async () => {
    setSavingAiRouting(true);
    setAiMessage(null);

    const tasksPayload = AI_TASKS.reduce((accumulator, task) => {
      const route = aiRoutingForm[task.key];
      const model = route.model.trim() || getDefaultTaskModel(task.key, route.provider, aiProviderForms);

      accumulator[task.key] = {
        provider: route.provider,
        model,
        fallbackToOpenAi: route.fallbackToOpenAi,
      };

      return accumulator;
    }, {} as Record<AiTaskKey, { provider: AiProvider; model: string; fallbackToOpenAi: boolean }>);

    const settingsPayload = {
      fallbackEnabled: true,
      fallbackProvider: 'openai',
      tasks: tasksPayload,
    };

    const result = aiRoutingIntegration?.id
      ? await configService.updateIntegrationSetting(aiRoutingIntegration.id, {
          settings: settingsPayload,
        })
      : await configService.createIntegrationSetting({
          slug: AI_ROUTING_SLUG,
          name: 'IA - Roteamento de Funcionalidades',
          description: 'Define qual provedor/modelo cada funcionalidade de IA deve usar.',
          settings: settingsPayload,
        });

    if (result.error) {
      setAiMessage({ type: 'error', text: 'Erro ao salvar roteamento de funcionalidades de IA.' });
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
      setAiMessage({ type: 'success', text: 'Roteamento de IA atualizado com sucesso.' });
    }

    setSavingAiRouting(false);
  };

  const loadMetaPixel = async () => {
    setLoadingMetaPixel(true);
    const data = await configService.getIntegrationSetting(META_PIXEL_SLUG);
    setMetaPixelIntegration(data);
    setMetaPixelId(data?.settings?.pixelId || '');
    setLoadingMetaPixel(false);
  };

  const loadGtm = async () => {
    setLoadingGtm(true);
    const data = await configService.getIntegrationSetting(GTM_SLUG);
    setGtmIntegration(data);
    setGtmId(data?.settings?.gtmId || '');
    setLoadingGtm(false);
  };

  const handleSaveMetaPixel = async () => {
    setSavingMetaPixel(true);
    setMetaPixelMessage(null);

    if (!metaPixelIntegration?.id) {
      const { data, error } = await configService.createIntegrationSetting({
        slug: META_PIXEL_SLUG,
        name: 'Meta Pixel',
        description: 'Codigo do Meta Pixel (Facebook) para rastreamento',
        settings: { pixelId: metaPixelId.trim() },
      });
      if (error) {
        setMetaPixelMessage({ type: 'error', text: 'Erro ao salvar. Tente novamente.' });
      } else {
        setMetaPixelIntegration(data);
        setMetaPixelMessage({ type: 'success', text: 'Meta Pixel configurado com sucesso!' });
      }
    } else {
      const { data, error } = await configService.updateIntegrationSetting(metaPixelIntegration.id, {
        settings: { pixelId: metaPixelId.trim() },
      });
      if (error) {
        setMetaPixelMessage({ type: 'error', text: 'Erro ao salvar. Tente novamente.' });
      } else {
        setMetaPixelIntegration(data);
        setMetaPixelMessage({ type: 'success', text: 'Meta Pixel atualizado com sucesso!' });
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
        name: 'Google Tag Manager',
        description: 'Codigo do GTM para rastreamento',
        settings: { gtmId: gtmId.trim() },
      });
      if (error) {
        setGtmMessage({ type: 'error', text: 'Erro ao salvar. Tente novamente.' });
      } else {
        setGtmIntegration(data);
        setGtmMessage({ type: 'success', text: 'GTM configurado com sucesso!' });
      }
    } else {
      const { data, error } = await configService.updateIntegrationSetting(gtmIntegration.id, {
        settings: { gtmId: gtmId.trim() },
      });
      if (error) {
        setGtmMessage({ type: 'error', text: 'Erro ao salvar. Tente novamente.' });
      } else {
        setGtmIntegration(data);
        setGtmMessage({ type: 'success', text: 'GTM atualizado com sucesso!' });
      }
    }
    setSavingGtm(false);
  };

  const hasIntegrationSnapshot =
    aiRoutingIntegration !== null ||
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
      stageLabel="Carregando integracoes..."
      overlayLabel="Atualizando integracoes..."
      stageClassName="min-h-[460px]"
    >
      <div className="space-y-8">
        <div>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-slate-900">Integracoes de IA</h2>
            <p className="text-sm text-slate-500 mt-1">
              Conecte OpenAI, Gemini e Claude e escolha qual provedor/modelo cada funcionalidade deve usar.
            </p>
          </div>

          {aiMessage && (
            <div
              className={`p-4 rounded-lg border flex items-center space-x-3 mb-4 ${
                aiMessage.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {aiMessage.type === 'success' ? <ShieldCheck className="w-5 h-5" /> : <Info className="w-5 h-5" />}
              <p>{aiMessage.text}</p>
            </div>
          )}

          <div className="space-y-4">
            {AI_PROVIDER_ORDER.map((provider) => {
              const providerMeta = AI_PROVIDER_META[provider];
              const formState = aiProviderForms[provider];
              const modelOptions = providerMeta.textModelOptions;
              const currentModelIncluded = modelOptions.some((option) => option.value === formState.defaultModelText);

              return (
                <div key={provider} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{providerMeta.name}</h3>
                      <p className="text-sm text-slate-500">{providerMeta.description}</p>
                    </div>
                    <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
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

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-2">API Key</label>
                      <div className="relative">
                        <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type={showProviderApiKey[provider] ? 'text' : 'password'}
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
                          className="w-full pl-10 pr-12 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
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
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                        >
                          {showProviderApiKey[provider] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Modelo padrao (texto)</label>
                      <FilterSingleSelect
                        icon={Tag}
                        value={formState.defaultModelText}
                        onChange={(value) =>
                          setAiProviderForms((prev) => ({
                            ...prev,
                            [provider]: {
                              ...prev[provider],
                              defaultModelText: value,
                            },
                          }))
                        }
                        placeholder="Selecione o modelo"
                        includePlaceholderOption={false}
                        options={[
                          ...(!currentModelIncluded && formState.defaultModelText
                            ? [{ value: formState.defaultModelText, label: formState.defaultModelText }]
                            : []),
                          ...modelOptions,
                        ]}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Modelo padrao (transcricao)</label>
                      <input
                        type="text"
                        value={formState.defaultModelTranscription}
                        onChange={(event) =>
                          setAiProviderForms((prev) => ({
                            ...prev,
                            [provider]: {
                              ...prev[provider],
                              defaultModelTranscription: event.target.value,
                            },
                          }))
                        }
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        placeholder="Modelo para transcricao"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end border-t border-slate-200 pt-4">
                    <button
                      onClick={() => handleSaveProvider(provider)}
                      disabled={savingAiProvider[provider]}
                      className="inline-flex items-center space-x-2 px-5 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                    >
                      {savingAiProvider[provider] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      <span>{savingAiProvider[provider] ? 'Salvando...' : `Salvar ${providerMeta.name}`}</span>
                    </button>
                  </div>
                </div>
              );
            })}

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="mb-3">
                <h3 className="text-lg font-semibold text-slate-900">Roteamento por funcionalidade</h3>
                <p className="text-sm text-slate-500">
                  Escolha qual provedor/modelo cada funcionalidade de IA deve usar. Se falhar, pode cair para OpenAI automaticamente.
                </p>
              </div>

              <div className="space-y-4">
                {AI_TASKS.map((task) => {
                  const routeState = aiRoutingForm[task.key];

                  return (
                    <div key={task.key} className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{task.label}</p>
                        <p className="text-xs text-slate-500">{task.description}</p>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Provedor</label>
                          <FilterSingleSelect
                            icon={Plug}
                            value={routeState.provider}
                            onChange={(value) => {
                              const nextProvider = isAiProvider(value) ? value : 'openai';
                              setAiRoutingForm((prev) => ({
                                ...prev,
                                [task.key]: {
                                  ...prev[task.key],
                                  provider: nextProvider,
                                  model: getDefaultTaskModel(task.key, nextProvider, aiProviderForms),
                                },
                              }));
                            }}
                            placeholder="Selecione o provedor"
                            includePlaceholderOption={false}
                            options={AI_PROVIDER_OPTIONS}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Modelo</label>
                          <input
                            type="text"
                            value={routeState.model}
                            onChange={(event) =>
                              setAiRoutingForm((prev) => ({
                                ...prev,
                                [task.key]: {
                                  ...prev[task.key],
                                  model: event.target.value,
                                },
                              }))
                            }
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                            placeholder="Modelo para esta funcionalidade"
                          />
                        </div>
                      </div>

                      <label className="inline-flex items-center gap-2 text-xs text-slate-600">
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

              <div className="mt-4 flex items-center justify-end border-t border-slate-200 pt-4">
                <button
                  onClick={handleSaveRouting}
                  disabled={savingAiRouting}
                  className="inline-flex items-center space-x-2 px-5 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {savingAiRouting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>{savingAiRouting ? 'Salvando...' : 'Salvar roteamento de IA'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-slate-900">WhatsApp (Whapi)</h2>
            <p className="text-sm text-slate-500 mt-1">
              Conecte o canal de WhatsApp para uso em fluxos e conversas.
            </p>
          </div>
          <div className="space-y-6">
            <WhatsAppApiSettings />
          </div>
        </div>

        <div className="border-t border-slate-200 pt-8">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900">Rastreamento - Landing Page</h2>
            <p className="text-sm text-slate-500 mt-1">
              Configure os codigos de rastreamento para a pagina de conversao (/lp)
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 rounded-full bg-blue-100 text-blue-700">
                  <Facebook className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Meta Pixel</h3>
                  <p className="text-sm text-slate-500">Codigo de rastreamento do Facebook/Instagram</p>
                </div>
              </div>

              {metaPixelMessage && (
                <div
                  className={`p-3 rounded-lg border mb-4 ${
                    metaPixelMessage.type === 'success'
                      ? 'bg-green-50 border-green-200 text-green-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  <p className="text-sm">{metaPixelMessage.text}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Pixel ID</label>
                <input
                  type="text"
                  value={metaPixelId}
                  onChange={(event) => setMetaPixelId(event.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="1234567890"
                />
                <p className="text-xs text-slate-500 mt-2">Ex: 1234567890 (somente numeros)</p>
              </div>

              <button
                onClick={handleSaveMetaPixel}
                disabled={savingMetaPixel}
                className="mt-4 w-full inline-flex items-center justify-center space-x-2 px-5 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savingMetaPixel ? 'Salvando...' : 'Salvar Meta Pixel'}</span>
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 rounded-full bg-green-100 text-green-700">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Google Tag Manager</h3>
                  <p className="text-sm text-slate-500">Container do GTM para a landing page</p>
                </div>
              </div>

              {gtmMessage && (
                <div
                  className={`p-3 rounded-lg border mb-4 ${
                    gtmMessage.type === 'success'
                      ? 'bg-green-50 border-green-200 text-green-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  <p className="text-sm">{gtmMessage.text}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">GTM ID</label>
                <input
                  type="text"
                  value={gtmId}
                  onChange={(event) => setGtmId(event.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="GTM-XXXXXXX"
                />
                <p className="text-xs text-slate-500 mt-2">Ex: GTM-ABC123D</p>
              </div>

              <button
                onClick={handleSaveGtm}
                disabled={savingGtm}
                className="mt-4 w-full inline-flex items-center justify-center space-x-2 px-5 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savingGtm ? 'Salvando...' : 'Salvar GTM'}</span>
              </button>
            </div>
          </div>

          <div className="mt-6 bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Info className="w-5 h-5 text-slate-500 mt-0.5" />
              <div className="text-sm text-slate-600">
                <p className="font-semibold">Como usar:</p>
                <p>
                  Essas configuracoes serao aplicadas automaticamente na landing page de conversao (/lp). Meta Pixel e GTM
                  ajudam a rastrear conversoes e otimizar campanhas.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PanelAdaptiveLoadingFrame>
  );
}
