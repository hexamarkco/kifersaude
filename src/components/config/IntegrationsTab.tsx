import { useEffect, useState } from 'react';
import { Eye, EyeOff, Info, KeyRound, Loader2, Plug, Save, ShieldCheck } from 'lucide-react';

import { configService } from '../../lib/configService';
import type { IntegrationSetting } from '../../lib/supabase';

const GPT_TRANSCRIPTION_SLUG = 'gpt_transcription';
const DEFAULT_MODEL = 'gpt-4o-mini-transcribe';
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

type MessageState = { type: 'success' | 'error'; text: string } | null;

type GptFormState = {
  apiKey: string;
  apiUrl: string;
  model: string;
};

const normalizeGptSettings = (integration: IntegrationSetting | null): GptFormState => {
  const settings = integration?.settings ?? {};
  return {
    apiKey: typeof settings.apiKey === 'string' ? settings.apiKey : '',
    apiUrl: typeof settings.apiUrl === 'string' && settings.apiUrl.trim().length > 0
      ? settings.apiUrl
      : DEFAULT_BASE_URL,
    model: typeof settings.model === 'string' && settings.model.trim().length > 0
      ? settings.model
      : DEFAULT_MODEL,
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

    const data = await configService.getIntegrationSetting(GPT_TRANSCRIPTION_SLUG);
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
      apiUrl: formState.apiUrl.trim() || DEFAULT_BASE_URL,
      model: formState.model.trim() || DEFAULT_MODEL,
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
            Execute as migrações mais recentes e cadastre as credenciais da integração GPT para usar a transcrição de áudios.
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
            <h3 className="text-lg font-semibold text-slate-900">GPT - Transcrição de Áudio</h3>
            <p className="text-sm text-slate-500">
              Essas credenciais serão usadas para transcrever áudios recebidos na aba de WhatsApp.
            </p>
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
            <label className="block text-sm font-medium text-slate-700 mb-2">Endpoint da API</label>
            <input
              type="text"
              value={formState.apiUrl}
              onChange={event => setFormState(prev => ({ ...prev, apiUrl: event.target.value }))}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder={DEFAULT_BASE_URL}
            />
            <p className="text-xs text-slate-500 mt-2">
              Utilize este campo caso use um proxy próprio ou outro provedor compatível com o formato OpenAI.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Modelo de Transcrição</label>
            <input
              type="text"
              value={formState.model}
              onChange={event => setFormState(prev => ({ ...prev, model: event.target.value }))}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder={DEFAULT_MODEL}
            />
            <p className="text-xs text-slate-500 mt-2">
              Informe o identificador do modelo disponível na sua conta (ex: gpt-4o-mini-transcribe).
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
