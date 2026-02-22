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

const GPT_INTEGRATION_SLUG = 'gpt_transcription';
const META_PIXEL_SLUG = 'meta_pixel';
const GTM_SLUG = 'google_tag_manager';

const TEXT_MODEL_OPTIONS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o mini • rápido e econômico' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini • equilíbrio entre custo e qualidade' },
  { value: 'gpt-4o', label: 'GPT-4o • máximo contexto e qualidade' },
];

const DEFAULT_TEXT_MODEL = TEXT_MODEL_OPTIONS[0].value;

type MessageState = { type: 'success' | 'error'; text: string } | null;

type GptFormState = {
  apiKey: string;
  textModel: string;
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

export default function IntegrationsTab() {
  const [gptIntegration, setGptIntegration] = useState<IntegrationSetting | null>(null);
  const [gptFormState, setGptFormState] = useState<GptFormState>(() => normalizeGptSettings(null));
  const [loadingGpt, setLoadingGpt] = useState(true);
  const [savingGpt, setSavingGpt] = useState(false);
  const [gptMessage, setGptMessage] = useState<MessageState>(null);
  const [showApiKey, setShowApiKey] = useState(false);

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

  useEffect(() => {
    loadGptIntegration();
    loadMetaPixel();
    loadGtm();
  }, []);

  void loadingMetaPixel;
  void loadingGtm;

  const loadGptIntegration = async () => {
    setLoadingGpt(true);
    setGptMessage(null);

    const data = await configService.getIntegrationSetting(GPT_INTEGRATION_SLUG);
    setGptIntegration(data);
    setGptFormState(normalizeGptSettings(data));

    setLoadingGpt(false);
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
        description: 'Código do Meta Pixel (Facebook) para rastreamento',
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
        description: 'Código do GTM para rastreamento',
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

  if (loadingGpt) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-600">
        <Loader2 className="w-6 h-6 animate-spin mb-3" />
        <p>Carregando integrações...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-slate-900">Configurações da API</h2>
          <p className="text-sm text-slate-500 mt-1">
            Configure as integrações de API externas usadas pelo sistema
          </p>
        </div>

        {gptMessage && (
          <div
            className={`p-4 rounded-lg border flex items-center space-x-3 mb-4 ${
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
            Configure os códigos de rastreamento para a página de conversão (/lp)
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
                <p className="text-sm text-slate-500">
                  Código de rastreamento do Facebook/Instagram
                </p>
              </div>
            </div>

            {metaPixelMessage && (
              <div className={`p-3 rounded-lg border mb-4 ${metaPixelMessage.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                <p className="text-sm">{metaPixelMessage.text}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Pixel ID</label>
              <input
                type="text"
                value={metaPixelId}
                onChange={e => setMetaPixelId(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="1234567890"
              />
              <p className="text-xs text-slate-500 mt-2">
                Ex: 1234567890 (somente números)
              </p>
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
                <p className="text-sm text-slate-500">
                  Container do GTM para a landing page
                </p>
              </div>
            </div>

            {gtmMessage && (
              <div className={`p-3 rounded-lg border mb-4 ${gtmMessage.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                <p className="text-sm">{gtmMessage.text}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">GTM ID</label>
              <input
                type="text"
                value={gtmId}
                onChange={e => setGtmId(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="GTM-XXXXXXX"
              />
              <p className="text-xs text-slate-500 mt-2">
                Ex: GTM-ABC123D
              </p>
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
              <p>Essas configurações serão aplicadas automaticamente na landing page de conversão (/lp). O Meta Pixel e GTM ajudarão a rastrear conversões e otimizar suas campanhas.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
