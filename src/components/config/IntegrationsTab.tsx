import { useEffect, useMemo, useState } from 'react';
import {
  Clock3,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Loader2,
  Megaphone,
  Plug,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

import { configService } from '../../lib/configService';
import { useConfig } from '../../contexts/ConfigContext';
import type { IntegrationSetting } from '../../lib/supabase';
import {
  AUTO_CONTACT_INTEGRATION_SLUG,
  type AutoContactStep,
  normalizeAutoContactSettings,
} from '../../lib/autoContactService';

const GPT_INTEGRATION_SLUG = 'gpt_transcription';
const FACEBOOK_INTEGRATION_SLUG = 'facebook_ads_manager';

const TEXT_MODEL_OPTIONS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o mini • rápido e econômico' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini • equilíbrio entre custo e qualidade' },
  { value: 'gpt-4o', label: 'GPT-4o • máximo contexto e qualidade' },
];

const DEFAULT_TEXT_MODEL = TEXT_MODEL_OPTIONS[0].value;

const FALLBACK_ORIGEM = 'tráfego pago';

const normalizeOrigemLabel = (label: string) =>
  label
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();

type MessageState = { type: 'success' | 'error'; text: string } | null;

type GptFormState = {
  apiKey: string;
  textModel: string;
};

type FacebookFormState = {
  pageAccessToken: string;
  verifyToken: string;
  defaultOrigem: string;
  defaultTipoContratacao: string;
  defaultResponsavel: string;
};

const normalizeGptSettings = (integration: IntegrationSetting | null): GptFormState => {
  const settings = integration?.settings ?? {};
  const toTrimmedString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const normalizedTextModel =
    toTrimmedString(settings.textModel) || toTrimmedString(settings.model) || DEFAULT_TEXT_MODEL;

  return {
    apiKey: typeof settings.apiKey === 'string' ? settings.apiKey : '',
    textModel: normalizedTextModel,
  };
};

const normalizeFacebookSettings = (integration: IntegrationSetting | null): FacebookFormState => {
  const settings = integration?.settings ?? {};
  const asString = (value: unknown, fallback: string) => (typeof value === 'string' ? value.trim() : fallback);

  return {
    pageAccessToken: typeof settings.pageAccessToken === 'string' ? settings.pageAccessToken : '',
    verifyToken: typeof settings.verifyToken === 'string' ? settings.verifyToken : '',
    defaultOrigem: asString(settings.defaultOrigem, FALLBACK_ORIGEM) || FALLBACK_ORIGEM,
    defaultTipoContratacao: asString(settings.defaultTipoContratacao, ''),
    defaultResponsavel: asString(settings.defaultResponsavel, ''),
  };
};

export default function IntegrationsTab() {
  const { leadOrigins, leadStatuses, options } = useConfig();
  const [gptIntegration, setGptIntegration] = useState<IntegrationSetting | null>(null);
  const [gptFormState, setGptFormState] = useState<GptFormState>(() => normalizeGptSettings(null));
  const [facebookIntegration, setFacebookIntegration] = useState<IntegrationSetting | null>(null);
  const [facebookFormState, setFacebookFormState] = useState<FacebookFormState>(() => normalizeFacebookSettings(null));
  const [autoIntegration, setAutoIntegration] = useState<IntegrationSetting | null>(null);
  const [autoFormState, setAutoFormState] = useState(() => normalizeAutoContactSettings(null));
  const [loadingGpt, setLoadingGpt] = useState(true);
  const [loadingFacebook, setLoadingFacebook] = useState(true);
  const [loadingAuto, setLoadingAuto] = useState(true);
  const [savingGpt, setSavingGpt] = useState(false);
  const [savingFacebook, setSavingFacebook] = useState(false);
  const [savingAuto, setSavingAuto] = useState(false);
  const [gptMessage, setGptMessage] = useState<MessageState>(null);
  const [facebookMessage, setFacebookMessage] = useState<MessageState>(null);
  const [autoMessage, setAutoMessage] = useState<MessageState>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showPageToken, setShowPageToken] = useState(false);
  const [showVerifyToken, setShowVerifyToken] = useState(false);
  const [showAutoApiKey, setShowAutoApiKey] = useState(false);

  const origemOptions = useMemo(() => {
    const uniques = new Map<string, string>();

    leadOrigins.forEach(origin => {
      const label = (origin.nome || '').trim();
      if (!label) return;

      const normalized = normalizeOrigemLabel(label);
      if (!uniques.has(normalized)) {
        uniques.set(normalized, label);
      }
    });

    const options = Array.from(uniques.values());
    const hasFallback = options.some(option => normalizeOrigemLabel(option) === normalizeOrigemLabel(FALLBACK_ORIGEM));

    if (!hasFallback) {
      options.unshift(FALLBACK_ORIGEM);
    }

    return options;
  }, [leadOrigins]);

  const tipoContratacaoOptions = useMemo(
    () => (options.lead_tipo_contratacao || []).filter(option => option.ativo),
    [options.lead_tipo_contratacao],
  );

  const responsavelOptions = useMemo(
    () => (options.lead_responsavel || []).filter(option => option.ativo),
    [options.lead_responsavel],
  );

  const defaultTipoContratacaoFallback = tipoContratacaoOptions[0]?.value || '';
  const defaultResponsavelFallback = responsavelOptions[0]?.value || '';

  useEffect(() => {
    loadGptIntegration();
    loadFacebookIntegration();
    loadAutoIntegration();
  }, []);

  useEffect(() => {
    setFacebookFormState(prev => {
      if (prev.defaultTipoContratacao || !defaultTipoContratacaoFallback) return prev;
      return { ...prev, defaultTipoContratacao: defaultTipoContratacaoFallback };
    });
  }, [defaultTipoContratacaoFallback]);

  useEffect(() => {
    setFacebookFormState(prev => {
      if (prev.defaultResponsavel || !defaultResponsavelFallback) return prev;
      return { ...prev, defaultResponsavel: defaultResponsavelFallback };
    });
  }, [defaultResponsavelFallback]);

  const loadGptIntegration = async () => {
    setLoadingGpt(true);
    setGptMessage(null);

    const data = await configService.getIntegrationSetting(GPT_INTEGRATION_SLUG);
    setGptIntegration(data);
    setGptFormState(normalizeGptSettings(data));

    setLoadingGpt(false);
  };

  const loadFacebookIntegration = async () => {
    setLoadingFacebook(true);
    setFacebookMessage(null);

    const data = await configService.getIntegrationSetting(FACEBOOK_INTEGRATION_SLUG);
    setFacebookIntegration(data);
    setFacebookFormState(normalizeFacebookSettings(data));

    setLoadingFacebook(false);
  };

  const loadAutoIntegration = async () => {
    setLoadingAuto(true);
    setAutoMessage(null);

    try {
      const defaultSettings = normalizeAutoContactSettings(null);
      const buildFallbackIntegration = (): IntegrationSetting => ({
        id: `local-${AUTO_CONTACT_INTEGRATION_SLUG}`,
        slug: AUTO_CONTACT_INTEGRATION_SLUG,
        name: 'Mensagens automáticas (WhatsApp)',
        description: 'Envio automático de mensagens e atualização do status "Contato Inicial"',
        settings: defaultSettings,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      let data = await configService.getIntegrationSetting(AUTO_CONTACT_INTEGRATION_SLUG);

      if (!data) {
        const { data: created } = await configService.createIntegrationSetting({
          slug: AUTO_CONTACT_INTEGRATION_SLUG,
          name: 'Mensagens automáticas (WhatsApp)',
          description: 'Envio automático de mensagens e atualização do status "Contato Inicial"',
          settings: defaultSettings,
        });
        data = created ?? buildFallbackIntegration();
      }

      setAutoIntegration(data);
      setAutoFormState(normalizeAutoContactSettings(data?.settings));
    } catch (error) {
      console.error('Erro ao carregar integração automática:', error);
      setAutoMessage({ type: 'error', text: 'Erro ao carregar a integração de mensagens automáticas.' });
    } finally {
      setLoadingAuto(false);
    }
  };

  const handleSaveGpt = async () => {
    if (!gptIntegration?.id) {
      setGptMessage({ type: 'error', text: 'Não foi possível localizar a configuração desta integração.' });
      return;
    }

    setSavingGpt(true);
    setGptMessage(null);

    const sanitizedSettings = {
      apiKey: gptFormState.apiKey.trim(),
      textModel: gptFormState.textModel.trim() || DEFAULT_TEXT_MODEL,
    };

    const { data, error } = await configService.updateIntegrationSetting(gptIntegration.id, {
      settings: sanitizedSettings,
    });

    if (error) {
      setGptMessage({ type: 'error', text: 'Erro ao salvar as credenciais. Tente novamente.' });
    } else {
      setGptIntegration(data ?? gptIntegration);
      setGptMessage({ type: 'success', text: 'Integração atualizada com sucesso.' });
    }

    setSavingGpt(false);
  };

  const handleSaveFacebook = async () => {
    if (!facebookIntegration?.id) {
      setFacebookMessage({ type: 'error', text: 'Não foi possível localizar a configuração desta integração.' });
      return;
    }

    setSavingFacebook(true);
    setFacebookMessage(null);

    const sanitizedSettings = {
      pageAccessToken: facebookFormState.pageAccessToken.trim(),
      verifyToken: facebookFormState.verifyToken.trim(),
      defaultOrigem: facebookFormState.defaultOrigem,
      defaultTipoContratacao: facebookFormState.defaultTipoContratacao,
      defaultResponsavel: facebookFormState.defaultResponsavel,
    };

    const { data, error } = await configService.updateIntegrationSetting(facebookIntegration.id, {
      settings: sanitizedSettings,
    });

    if (error) {
      setFacebookMessage({ type: 'error', text: 'Erro ao salvar as credenciais. Tente novamente.' });
    } else {
      setFacebookIntegration(data ?? facebookIntegration);
      setFacebookMessage({ type: 'success', text: 'Integração atualizada com sucesso.' });
    }

    setSavingFacebook(false);
  };

  const updateMessageStep = (id: string, updates: Partial<AutoContactStep>) => {
    setAutoFormState((prev) => ({
      ...prev,
      messageFlow: prev.messageFlow.map((step) => (step.id === id ? { ...step, ...updates } : step)),
    }));
  };

  const addMessageStep = () => {
    setAutoFormState((prev) => ({
      ...prev,
      messageFlow: [
        ...prev.messageFlow,
        {
          id:
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `step-${Date.now()}`,
          message: 'Olá {{primeiro_nome}}, recebemos seu interesse. Posso ajudar com mais informações?',
          delayMinutes: prev.messageFlow.length === 0 ? 0 : 15,
          active: true,
        },
      ],
    }));
  };

  const removeMessageStep = (id: string) => {
    setAutoFormState((prev) => ({
      ...prev,
      messageFlow: prev.messageFlow.filter((step) => step.id !== id),
    }));
  };

  const handleSaveAuto = async () => {
    if (!autoIntegration?.id) {
      setAutoMessage({ type: 'error', text: 'Não foi possível localizar a configuração desta integração.' });
      return;
    }

    setSavingAuto(true);
    setAutoMessage(null);

    const sanitizedSettings = {
      enabled: autoFormState.enabled,
      baseUrl: autoFormState.baseUrl.trim() || 'http://localhost:3000',
      apiKey: autoFormState.apiKey.trim(),
      statusOnSend: autoFormState.statusOnSend.trim() || 'Contato Inicial',
      messageFlow: autoFormState.messageFlow.map((step) => ({
        ...step,
        message: step.message.trim(),
        delayMinutes: Number.isFinite(step.delayMinutes) ? Math.max(0, step.delayMinutes) : 0,
      })),
    };

    const { data, error } = await configService.updateIntegrationSetting(autoIntegration.id, {
      settings: sanitizedSettings,
    });

    if (error) {
      setAutoMessage({ type: 'error', text: 'Erro ao salvar as mensagens automáticas. Tente novamente.' });
    } else {
      setAutoIntegration(data ?? autoIntegration);
      setAutoMessage({ type: 'success', text: 'Integração de mensagens atualizada com sucesso.' });
    }

    setSavingAuto(false);
  };

  if (loadingGpt && loadingFacebook && loadingAuto) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-600">
        <Loader2 className="w-6 h-6 animate-spin mb-3" />
        <p>Carregando integrações...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {autoMessage && (
        <div
          className={`p-4 rounded-lg border flex items-center space-x-3 ${
            autoMessage.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {autoMessage.type === 'success' ? <ShieldCheck className="w-5 h-5" /> : <Info className="w-5 h-5" />}
          <p>{autoMessage.text}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 rounded-full bg-orange-100 text-orange-700">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Mensagens automáticas para novos leads</h3>
            <p className="text-sm text-slate-500">
              Configure a integração com a API informada e o fluxo de mensagens que deve ser enviado assim que um novo lead
              chegar. O status será atualizado para "Contato Inicial" automaticamente.
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Todas as requisições usam o header <strong>x-api-key</strong> e a rota /send-message do endpoint configurado.
            </p>
          </div>
        </div>

        {loadingAuto && (
          <div className="flex items-center space-x-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Carregando integração de mensagens automáticas...</span>
          </div>
        )}

        {!autoIntegration && !loadingAuto && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start space-x-3">
            <Info className="w-4 h-4 text-orange-600 mt-1" />
            <div className="text-sm text-orange-800">
              Nenhuma configuração encontrada ainda. Salve para criar uma configuração local e reabrir esta tela.
            </div>
          </div>
        )}

        {autoIntegration && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <label className="flex items-center space-x-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={autoFormState.enabled}
                  onChange={(event) => setAutoFormState((prev) => ({ ...prev, enabled: event.target.checked }))}
                  className="h-4 w-4 text-orange-600 border-slate-300 rounded"
                />
                <span>Habilitar envio automático assim que o lead for criado</span>
              </label>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Base URL da API</label>
                <input
                  type="text"
                  value={autoFormState.baseUrl}
                  onChange={(event) => setAutoFormState((prev) => ({ ...prev, baseUrl: event.target.value }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="http://localhost:3000"
                  disabled={!autoIntegration}
                />
                <p className="text-xs text-slate-500 mt-2">Certifique-se de usar a mesma URL utilizada pela API de mensagens.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Status após primeiro envio</label>
                <select
                  value={autoFormState.statusOnSend}
                  onChange={(event) => setAutoFormState((prev) => ({ ...prev, statusOnSend: event.target.value }))}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                >
                  {(leadStatuses || []).map((status) => (
                    <option key={status.id} value={status.nome}>
                      {status.nome}
                    </option>
                  ))}
                  {!leadStatuses.some((status) => status.nome === autoFormState.statusOnSend) && (
                    <option value={autoFormState.statusOnSend}>{autoFormState.statusOnSend}</option>
                  )}
                </select>
                <p className="text-xs text-slate-500 mt-2">Utilize o status "Contato Inicial" para marcar leads já abordados.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Chave de API</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showAutoApiKey ? 'text' : 'password'}
                    value={autoFormState.apiKey}
                    onChange={(event) => setAutoFormState((prev) => ({ ...prev, apiKey: event.target.value }))}
                    className="w-full pl-10 pr-12 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="SUA_CHAVE_SUPER_SECRETA"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAutoApiKey((previous) => !previous)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  >
                    {showAutoApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-2">Será enviada como header x-api-key em todas as requisições.</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-700">Variáveis disponíveis:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li><code>{{'{{primeiro_nome}}'}}</code> - primeiro nome do lead</li>
                  <li><code>{{'{{nome}}'}}</code> - nome completo</li>
                  <li><code>{{'{{origem}}'}}</code>, <code>{{'{{cidade}}'}}</code>, <code>{{'{{responsavel}}'}}</code></li>
                </ul>
                <p>Use-as para personalizar cada mensagem enviada.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">Fluxo de mensagens</p>
                  <p className="text-xs text-slate-500">Adicione quantas mensagens quiser e defina os intervalos em minutos.</p>
                </div>
                <button
                  type="button"
                  onClick={addMessageStep}
                  className="inline-flex items-center space-x-2 px-3 py-2 text-sm bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200"
                >
                  <Plug className="w-4 h-4" />
                  <span>Nova mensagem</span>
                </button>
              </div>

              {autoFormState.messageFlow.length === 0 && (
                <div className="p-4 border border-dashed border-slate-300 rounded-lg text-sm text-slate-600 bg-slate-50">
                  Nenhuma mensagem configurada. Adicione pelo menos uma para habilitar o fluxo automático.
                </div>
              )}

              <div className="space-y-4">
                {autoFormState.messageFlow.map((step, index) => (
                  <div key={step.id} className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-sm font-semibold text-slate-800">
                        <Clock3 className="w-4 h-4 text-orange-500" />
                        <span>Mensagem {index + 1}</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <label className="flex items-center space-x-2 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={step.active}
                            onChange={(event) => updateMessageStep(step.id, { active: event.target.checked })}
                            className="h-4 w-4 text-orange-600 border-slate-300 rounded"
                          />
                          <span>Ativa</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => removeMessageStep(step.id)}
                          className="text-slate-500 hover:text-red-600"
                          aria-label="Remover mensagem"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-700 mb-1">Mensagem</label>
                        <textarea
                          value={step.message}
                          onChange={(event) => updateMessageStep(step.id, { message: event.target.value })}
                          className="w-full rounded-lg border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:border-transparent px-3 py-2"
                          rows={3}
                          placeholder="Olá {{primeiro_nome}}, bem-vindo!"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Aguardar (minutos)</label>
                        <input
                          type="number"
                          min={0}
                          value={step.delayMinutes}
                          onChange={(event) => updateMessageStep(step.id, { delayMinutes: Number(event.target.value) })}
                          className="w-full rounded-lg border border-slate-300 focus:ring-2 focus:ring-orange-500 focus:border-transparent px-3 py-2"
                        />
                        <p className="text-[11px] text-slate-500 mt-1">0 envia imediatamente; os demais seguem na sequência.</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between mt-6 bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="flex items-center space-x-3 text-sm text-slate-600">
                <ShieldCheck className="w-4 h-4 text-orange-600" />
                <p>Somente administradores podem visualizar e alterar essa integração.</p>
              </div>
              <button
                onClick={handleSaveAuto}
                disabled={savingAuto || !autoIntegration}
                className="inline-flex items-center space-x-2 px-5 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{savingAuto ? 'Salvando...' : 'Salvar mensagens automáticas'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {gptMessage && (
        <div
          className={`p-4 rounded-lg border flex items-center space-x-3 ${
            gptMessage.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {gptMessage.type === 'success' ? (
            <ShieldCheck className="w-5 h-5" />
          ) : (
            <Info className="w-5 h-5" />
          )}
          <p>{gptMessage.text}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 rounded-full bg-teal-100 text-teal-700">
            <Plug className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">GPT - Assistente Inteligente</h3>
            <p className="text-sm text-slate-500">
              Essas credenciais são usadas para transcrever áudios recebidos e aplicar recursos de texto/reescrita antes do
              envio de mensagens.
            </p>
            <div className="mt-3 text-xs text-slate-500 space-y-1">
              <p className="font-semibold text-slate-600">Como utilizamos o GPT:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Áudios usam o modelo Whisper no endpoint /v1/audio/transcriptions.</li>
                <li>Recursos de texto usam o modelo selecionado abaixo.</li>
                <li>Reescritas enviadas pela aplicação usam o endpoint /v1/responses.</li>
              </ul>
            </div>
          </div>
        </div>

        {loadingGpt && (
          <div className="flex items-center space-x-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Carregando configuração do GPT...</span>
          </div>
        )}

        {!gptIntegration && !loadingGpt && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start space-x-3">
            <Info className="w-4 h-4 text-orange-600 mt-1" />
            <div className="text-sm text-orange-800">
              Nenhuma configuração do GPT encontrada. Execute as migrações mais recentes para habilitar a integração.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Chave de API</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showApiKey ? 'text' : 'password'}
                value={gptFormState.apiKey}
                onChange={event => setGptFormState(prev => ({ ...prev, apiKey: event.target.value }))}
                className="w-full pl-10 pr-12 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="sk-..."
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(previous => !previous)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Armazenamos essa chave de forma segura apenas para os administradores.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Modelo do GPT</label>
            <select
              value={gptFormState.textModel}
              onChange={event => setGptFormState(prev => ({ ...prev, textModel: event.target.value }))}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white"
            >
              {TEXT_MODEL_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-2">
              Escolha o modelo disponível na sua conta para respostas e reescritas de texto. Os áudios continuarão usando o Whisper
              automaticamente.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6 bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="flex items-center space-x-3 text-sm text-slate-600">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <p>Somente administradores podem visualizar e alterar essas credenciais.</p>
          </div>
          <button
            onClick={handleSaveGpt}
            disabled={savingGpt || !gptIntegration}
            className="inline-flex items-center space-x-2 px-5 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{savingGpt ? 'Salvando...' : 'Salvar integração'}</span>
          </button>
        </div>
      </div>

      {facebookMessage && (
        <div
          className={`p-4 rounded-lg border flex items-center space-x-3 ${
            facebookMessage.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {facebookMessage.type === 'success' ? (
            <ShieldCheck className="w-5 h-5" />
          ) : (
            <Info className="w-5 h-5" />
          )}
          <p>{facebookMessage.text}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 rounded-full bg-indigo-100 text-indigo-700">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Facebook Lead Ads</h3>
            <p className="text-sm text-slate-500">
              Conecte o Gerenciador de Anúncios para que cada lead gerado em formulários seja registrado automaticamente no CRM.
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Use o endpoint da função <code>facebook-leads-webhook</code> como URL de webhook no Facebook e informe o token de
              verificação configurado abaixo.
            </p>
          </div>
        </div>

        {loadingFacebook && (
          <div className="flex items-center space-x-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Carregando configuração do Facebook...</span>
          </div>
        )}

        {!facebookIntegration && !loadingFacebook && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start space-x-3">
            <Info className="w-4 h-4 text-orange-600 mt-1" />
            <div className="text-sm text-orange-800">
              Nenhuma configuração do Facebook encontrada. Execute as migrações mais recentes para habilitar a integração.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Token de acesso da página</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPageToken ? 'text' : 'password'}
                value={facebookFormState.pageAccessToken}
                onChange={event => setFacebookFormState(prev => ({ ...prev, pageAccessToken: event.target.value }))}
                className="w-full pl-10 pr-12 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="EAAB..."
                autoComplete="off"
                disabled={!facebookIntegration}
              />
              <button
                type="button"
                onClick={() => setShowPageToken(previous => !previous)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
              >
                {showPageToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Use um token de página com permissão para ler leads dos formulários do Facebook Lead Ads.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Token de verificação</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showVerifyToken ? 'text' : 'password'}
                value={facebookFormState.verifyToken}
                onChange={event => setFacebookFormState(prev => ({ ...prev, verifyToken: event.target.value }))}
                className="w-full pl-10 pr-12 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="token-seguro"
                autoComplete="off"
                disabled={!facebookIntegration}
              />
              <button
                type="button"
                onClick={() => setShowVerifyToken(previous => !previous)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
              >
                {showVerifyToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">Token usado pelo Facebook para validar o webhook.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Origem padrão</label>
            <select
              value={facebookFormState.defaultOrigem}
              onChange={event => setFacebookFormState(prev => ({ ...prev, defaultOrigem: event.target.value }))}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              disabled={!facebookIntegration}
            >
              {origemOptions.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-2">Valor salvo no campo origem do lead gerado.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de contratação padrão</label>
            <select
              value={facebookFormState.defaultTipoContratacao}
              onChange={event => setFacebookFormState(prev => ({ ...prev, defaultTipoContratacao: event.target.value }))}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              disabled={!facebookIntegration}
            >
              {tipoContratacaoOptions.map(option => (
                <option key={option.id} value={option.value}>
                  {option.label}
                </option>
              ))}
              {!tipoContratacaoOptions.some(option => option.value === facebookFormState.defaultTipoContratacao) &&
                facebookFormState.defaultTipoContratacao && (
                  <option value={facebookFormState.defaultTipoContratacao}>{facebookFormState.defaultTipoContratacao}</option>
                )}
            </select>
            <p className="text-xs text-slate-500 mt-2">Usado para preencher o campo tipo de contratação na criação do lead.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Responsável padrão</label>
            <select
              value={facebookFormState.defaultResponsavel}
              onChange={event => setFacebookFormState(prev => ({ ...prev, defaultResponsavel: event.target.value }))}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              disabled={!facebookIntegration}
            >
              {responsavelOptions.map(option => (
                <option key={option.id} value={option.value}>
                  {option.label}
                </option>
              ))}
              {!responsavelOptions.some(option => option.value === facebookFormState.defaultResponsavel) &&
                facebookFormState.defaultResponsavel && (
                  <option value={facebookFormState.defaultResponsavel}>{facebookFormState.defaultResponsavel}</option>
                )}
            </select>
            <p className="text-xs text-slate-500 mt-2">Defina quem recebe os leads importados do Facebook.</p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-6 bg-slate-50 border border-slate-200 rounded-lg p-4">
          <div className="flex items-center space-x-3 text-sm text-slate-600">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <p>Somente administradores podem visualizar e alterar essas credenciais.</p>
          </div>
          <button
            onClick={handleSaveFacebook}
            disabled={savingFacebook || !facebookIntegration}
            className="inline-flex items-center space-x-2 px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{savingFacebook ? 'Salvando...' : 'Salvar integração'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
