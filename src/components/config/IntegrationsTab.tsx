import { useEffect, useState } from 'react';
import { Eye, EyeOff, Info, KeyRound, Loader2, Plug, Save, ShieldCheck } from 'lucide-react';

import { configService } from '../../lib/configService';
import type { IntegrationSetting } from '../../lib/supabase';

const GPT_INTEGRATION_SLUG = 'gpt_transcription';

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
  const [integration, setIntegration] = useState<IntegrationSetting | null>(null);
  const [formState, setFormState] = useState<GptFormState>(() => normalizeGptSettings(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    loadIntegration();
  }, []);

  const loadIntegration = async () => {
    setLoading(true);
    setMessage(null);

    const data = await configService.getIntegrationSetting(GPT_INTEGRATION_SLUG);
    setIntegration(data);
    setFormState(normalizeGptSettings(data));

    setLoading(false);
  };

  const handleSave = async () => {
    if (!integration?.id) {
      setMessage({ type: 'error', text: 'Não foi possível localizar a configuração desta integração.' });
      return;
    }

    setSaving(true);
    setMessage(null);

    const sanitizedSettings = {
      apiKey: formState.apiKey.trim(),
      textModel: formState.textModel.trim() || DEFAULT_TEXT_MODEL,
    };

    const { data, error } = await configService.updateIntegrationSetting(integration.id, {
      settings: sanitizedSettings,
    });

    if (error) {
      setMessage({ type: 'error', text: 'Erro ao salvar as credenciais. Tente novamente.' });
    } else {
      setIntegration(data ?? integration);
      setMessage({ type: 'success', text: 'Integração atualizada com sucesso.' });
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-600">
        <Loader2 className="w-6 h-6 animate-spin mb-3" />
        <p>Carregando integrações...</p>
      </div>
    );
  }

  if (!integration) {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 flex items-start space-x-3">
        <Info className="w-5 h-5 text-orange-600 mt-1" />
        <div>
          <p className="text-orange-800 font-medium mb-1">Nenhuma integração encontrada.</p>
          <p className="text-orange-700 text-sm">
            Execute as migrações mais recentes e cadastre as credenciais da integração GPT para usar recursos como transcrição de
            áudios e reescrita de mensagens.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`p-4 rounded-lg border flex items-center space-x-3 ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <ShieldCheck className="w-5 h-5" />
          ) : (
            <Info className="w-5 h-5" />
          )}
          <p>{message.text}</p>
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
              envio na aba de WhatsApp.
            </p>
            <div className="mt-3 text-xs text-slate-500 space-y-1">
              <p className="font-semibold text-slate-600">Como utilizamos o GPT:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Áudios usam o modelo Whisper no endpoint /v1/audio/transcriptions.</li>
                <li>Recursos de texto usam o modelo selecionado abaixo.</li>
                <li>Reescritas enviadas pelo WhatsApp usam o endpoint /v1/responses.</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Chave de API</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showApiKey ? 'text' : 'password'}
                value={formState.apiKey}
                onChange={event => setFormState(prev => ({ ...prev, apiKey: event.target.value }))}
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
              value={formState.textModel}
              onChange={event => setFormState(prev => ({ ...prev, textModel: event.target.value }))}
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
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center space-x-2 px-5 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Salvando...' : 'Salvar integração'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
