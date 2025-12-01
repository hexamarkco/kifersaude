import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Info, KeyRound, Loader2, Megaphone, Plug, Save, ShieldCheck } from 'lucide-react';

import { configService } from '../../lib/configService';
import { useConfig } from '../../contexts/ConfigContext';
import type { IntegrationSetting } from '../../lib/supabase';

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
  const { leadOrigins, options } = useConfig();
  const [gptIntegration, setGptIntegration] = useState<IntegrationSetting | null>(null);
  const [gptFormState, setGptFormState] = useState<GptFormState>(() => normalizeGptSettings(null));
  const [facebookIntegration, setFacebookIntegration] = useState<IntegrationSetting | null>(null);
  const [facebookFormState, setFacebookFormState] = useState<FacebookFormState>(() => normalizeFacebookSettings(null));
  const [loadingGpt, setLoadingGpt] = useState(true);
  const [loadingFacebook, setLoadingFacebook] = useState(true);
  const [savingGpt, setSavingGpt] = useState(false);
  const [savingFacebook, setSavingFacebook] = useState(false);
  const [gptMessage, setGptMessage] = useState<MessageState>(null);
  const [facebookMessage, setFacebookMessage] = useState<MessageState>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showPageToken, setShowPageToken] = useState(false);
  const [showVerifyToken, setShowVerifyToken] = useState(false);

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

  if (loadingGpt && loadingFacebook) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-600">
        <Loader2 className="w-6 h-6 animate-spin mb-3" />
        <p>Carregando integrações...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
