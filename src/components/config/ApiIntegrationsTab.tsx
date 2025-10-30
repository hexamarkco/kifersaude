import { useState, useEffect } from 'react';
import { supabase, ApiIntegration } from '../../lib/supabase';
import { zapiService } from '../../lib/zapiService';
import { Save, CheckCircle, XCircle, Loader, Eye, EyeOff, Zap, Brain } from 'lucide-react';

export default function ApiIntegrationsTab() {
  const [config, setConfig] = useState<ApiIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingZAPI, setTestingZAPI] = useState(false);
  const [zapiStatus, setZapiStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showZAPIToken, setShowZAPIToken] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState({
    zapi_instance_id: '',
    zapi_token: '',
    zapi_enabled: false,
    openai_api_key: '',
    openai_model: 'gpt-3.5-turbo',
    openai_temperature: 0.7,
    openai_max_tokens: 500,
    openai_enabled: false,
    monthly_cost_limit: 50.0,
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('api_integrations')
        .select('*')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig(data);
        setFormData({
          zapi_instance_id: data.zapi_instance_id || '',
          zapi_token: data.zapi_token || '',
          zapi_enabled: data.zapi_enabled,
          openai_api_key: data.openai_api_key || '',
          openai_model: data.openai_model,
          openai_temperature: data.openai_temperature,
          openai_max_tokens: data.openai_max_tokens,
          openai_enabled: data.openai_enabled,
          monthly_cost_limit: data.monthly_cost_limit,
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      showMessage('error', 'Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (config) {
        const { error } = await supabase
          .from('api_integrations')
          .update(formData)
          .eq('id', config.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('api_integrations')
          .insert([formData]);

        if (error) throw error;
      }

      showMessage('success', 'Configurações salvas com sucesso!');
      loadConfig();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      showMessage('error', 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleTestZAPI = async () => {
    if (!formData.zapi_instance_id || !formData.zapi_token) {
      showMessage('error', 'Preencha Instance ID e Token antes de testar');
      return;
    }

    setTestingZAPI(true);
    setZapiStatus('idle');

    await handleSave();

    try {
      const result = await zapiService.testConnection();
      if (result.success) {
        setZapiStatus('success');
        showMessage('success', 'Conexão com Z-API estabelecida com sucesso!');
      } else {
        setZapiStatus('error');
        showMessage('error', `Erro ao conectar: ${result.error}`);
      }
    } catch (error) {
      setZapiStatus('error');
      showMessage('error', 'Erro ao testar conexão');
    } finally {
      setTestingZAPI(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {message && (
        <div
          className={`p-4 rounded-lg border ${
            message.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="border-b border-slate-200 pb-6">
        <div className="flex items-center space-x-3 mb-4">
          <Zap className="w-6 h-6 text-teal-600" />
          <h2 className="text-xl font-bold text-slate-900">Integração Z-API (WhatsApp)</h2>
        </div>
        <p className="text-slate-600 mb-6">
          Configure sua instância do Z-API para enviar e receber mensagens do WhatsApp diretamente pelo sistema.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Instance ID
            </label>
            <input
              type="text"
              value={formData.zapi_instance_id}
              onChange={(e) => setFormData({ ...formData, zapi_instance_id: e.target.value })}
              placeholder="ex: 3C12345678"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Token de Acesso
            </label>
            <div className="relative">
              <input
                type={showZAPIToken ? 'text' : 'password'}
                value={formData.zapi_token}
                onChange={(e) => setFormData({ ...formData, zapi_token: e.target.value })}
                placeholder="Digite seu token Z-API"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent pr-12"
              />
              <button
                type="button"
                onClick={() => setShowZAPIToken(!showZAPIToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showZAPIToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="zapi_enabled"
              checked={formData.zapi_enabled}
              onChange={(e) => setFormData({ ...formData, zapi_enabled: e.target.checked })}
              className="w-5 h-5 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
            />
            <label htmlFor="zapi_enabled" className="text-sm font-medium text-slate-700">
              Habilitar integração Z-API
            </label>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleTestZAPI}
              disabled={testingZAPI || !formData.zapi_instance_id || !formData.zapi_token}
              className="flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testingZAPI ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Testando...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>Testar Conexão</span>
                </>
              )}
            </button>

            {zapiStatus === 'success' && (
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-medium">Conectado</span>
              </div>
            )}

            {zapiStatus === 'error' && (
              <div className="flex items-center space-x-2 text-red-600">
                <XCircle className="w-5 h-5" />
                <span className="text-sm font-medium">Erro na conexão</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-b border-slate-200 pb-6">
        <div className="flex items-center space-x-3 mb-4">
          <Brain className="w-6 h-6 text-purple-600" />
          <h2 className="text-xl font-bold text-slate-900">Integração OpenAI GPT</h2>
        </div>
        <p className="text-slate-600 mb-6">
          Configure sua chave da OpenAI para gerar mensagens inteligentes usando GPT.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              API Key da OpenAI
            </label>
            <div className="relative">
              <input
                type={showOpenAIKey ? 'text' : 'password'}
                value={formData.openai_api_key}
                onChange={(e) => setFormData({ ...formData, openai_api_key: e.target.value })}
                placeholder="sk-..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-12"
              />
              <button
                type="button"
                onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showOpenAIKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Modelo GPT
            </label>
            <select
              value={formData.openai_model}
              onChange={(e) => setFormData({ ...formData, openai_model: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Mais rápido e econômico)</option>
              <option value="gpt-4-turbo">GPT-4 Turbo (Equilibrado)</option>
              <option value="gpt-4">GPT-4 (Melhor qualidade)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Temperatura (0-1)
              </label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={formData.openai_temperature}
                onChange={(e) => setFormData({ ...formData, openai_temperature: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">Criatividade da IA (0.7 recomendado)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Máximo de Tokens
              </label>
              <input
                type="number"
                min="100"
                max="2000"
                step="50"
                value={formData.openai_max_tokens}
                onChange={(e) => setFormData({ ...formData, openai_max_tokens: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">Tamanho máximo da resposta</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Limite de Custo Mensal (USD)
            </label>
            <input
              type="number"
              min="0"
              step="5"
              value={formData.monthly_cost_limit}
              onChange={(e) => setFormData({ ...formData, monthly_cost_limit: parseFloat(e.target.value) })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-500 mt-1">Alerta quando ultrapassar este valor</p>
          </div>

          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="openai_enabled"
              checked={formData.openai_enabled}
              onChange={(e) => setFormData({ ...formData, openai_enabled: e.target.checked })}
              className="w-5 h-5 text-purple-600 border-slate-300 rounded focus:ring-purple-500"
            />
            <label htmlFor="openai_enabled" className="text-sm font-medium text-slate-700">
              Habilitar integração OpenAI GPT
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center space-x-2 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              <span>Salvando...</span>
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              <span>Salvar Configurações</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
