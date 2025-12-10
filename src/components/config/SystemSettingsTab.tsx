import { useState, useEffect } from 'react';
import { Settings, Volume2, VolumeX, Clock, Calendar, Save, CheckCircle, AlertCircle, Key, AlertTriangle } from 'lucide-react';
import { SystemSettings, supabase } from '../../lib/supabase';
import { configService } from '../../lib/configService';
import { useConfig } from '../../contexts/ConfigContext';
import LeadStatusManager from './LeadStatusManager';
import LeadOriginsManager from './LeadOriginsManager';
import ConfigOptionManager from './ConfigOptionManager';
import AccessControlManager from './AccessControlManager';

export default function SystemSettingsTab() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { loading: configLoading } = useConfig();

  const [serviceRoleKey, setServiceRoleKey] = useState<string>('');
  const [serviceRoleKeyLoading, setServiceRoleKeyLoading] = useState(true);
  const [serviceRoleKeySaving, setServiceRoleKeySaving] = useState(false);
  const [showServiceKey, setShowServiceKey] = useState(false);

  useEffect(() => {
    loadSettings();
    loadServiceRoleKey();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const data = await configService.getSystemSettings();
    setSettings(data);
    setLoading(false);
  };

  const loadServiceRoleKey = async () => {
    setServiceRoleKeyLoading(true);
    console.log('[SystemSettings] Carregando Service Role Key...');

    try {
      const { data, error } = await supabase
        .from('system_configurations')
        .select('config_value')
        .eq('config_key', 'supabase_service_role_key')
        .maybeSingle();

      if (error) {
        console.error('[SystemSettings] Erro ao carregar Service Role Key:', error);
      } else if (data) {
        const key = typeof data.config_value === 'string' ? data.config_value : data.config_value;
        setServiceRoleKey(key || '');
        console.log('[SystemSettings] Service Role Key carregada:', key === 'PLACEHOLDER_SERVICE_KEY' ? 'PLACEHOLDER' : 'Configurada');
      }
    } catch (error) {
      console.error('[SystemSettings] Erro ao carregar Service Role Key:', error);
    }

    setServiceRoleKeyLoading(false);
  };

  const saveServiceRoleKey = async () => {
    if (!serviceRoleKey || serviceRoleKey.trim() === '') {
      showMessage('error', 'Service Role Key não pode estar vazia');
      return;
    }

    setServiceRoleKeySaving(true);
    console.log('[SystemSettings] Salvando Service Role Key...');

    try {
      const { error } = await supabase
        .from('system_configurations')
        .update({ config_value: serviceRoleKey })
        .eq('config_key', 'supabase_service_role_key');

      if (error) {
        console.error('[SystemSettings] Erro ao salvar Service Role Key:', error);
        showMessage('error', 'Erro ao salvar Service Role Key');
      } else {
        console.log('[SystemSettings] Service Role Key salva com sucesso');
        showMessage('success', 'Service Role Key salva! Envio automático de mensagens ativado.');
      }
    } catch (error) {
      console.error('[SystemSettings] Erro ao salvar Service Role Key:', error);
      showMessage('error', 'Erro ao salvar Service Role Key');
    }

    setServiceRoleKeySaving(false);
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    const { error } = await configService.updateSystemSettings(settings);

    if (error) {
      showMessage('error', 'Erro ao salvar configurações');
    } else {
      showMessage('success', 'Configurações salvas com sucesso');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent mx-auto"></div>
        <p className="text-slate-600 mt-4">Carregando configurações...</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
        <p className="text-red-700">Erro ao carregar configurações do sistema</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-lg border flex items-center space-x-3 ${
          message.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <p>{message.text}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Settings className="w-6 h-6 text-teal-600" />
          <h3 className="text-xl font-semibold text-slate-900">Configurações Gerais</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Nome da Empresa
            </label>
            <input
              type="text"
              value={settings.company_name}
              onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              placeholder="Nome da sua empresa"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Formato de Data
            </label>
            <select
              value={settings.date_format}
              onChange={(e) => setSettings({ ...settings, date_format: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>

          <div>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notification_sound_enabled}
                onChange={(e) => setSettings({ ...settings, notification_sound_enabled: e.target.checked })}
                className="w-5 h-5 text-teal-600 border-slate-300 rounded focus:ring-2 focus:ring-teal-500"
              />
              <div className="flex items-center space-x-2">
                {settings.notification_sound_enabled ? (
                  <Volume2 className="w-5 h-5 text-teal-600" />
                ) : (
                  <VolumeX className="w-5 h-5 text-slate-400" />
                )}
                <span className="text-sm font-medium text-slate-700">
                  Ativar Sons de Notificação
                </span>
              </div>
            </label>
          </div>

          {settings.notification_sound_enabled && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Volume das Notificações: {Math.round(settings.notification_volume * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={settings.notification_volume}
                onChange={(e) => setSettings({ ...settings, notification_volume: parseFloat(e.target.value) })}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>Intervalo de Verificação de Notificações (segundos)</span>
            </label>
            <input
              type="number"
              min="10"
              max="300"
              value={settings.notification_interval_seconds}
              onChange={(e) => setSettings({ ...settings, notification_interval_seconds: parseInt(e.target.value) || 30 })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-500 mt-1">
              Recomendado: 30 segundos
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center space-x-2">
              <Calendar className="w-4 h-4" />
              <span>Tempo de Sessão (minutos)</span>
            </label>
            <input
              type="number"
              min="30"
              max="1440"
              value={settings.session_timeout_minutes}
              onChange={(e) => setSettings({ ...settings, session_timeout_minutes: parseInt(e.target.value) || 480 })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-500 mt-1">
              Tempo antes do logout automático (padrão: 480 minutos / 8 horas)
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center space-x-2 px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Salvando...' : 'Salvar Configurações'}</span>
          </button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl shadow-sm p-6">
        <div className="flex items-start space-x-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-slate-900 mb-2">
              Configuração do Supabase Service Role Key
            </h3>
            <p className="text-sm text-amber-800 mb-4">
              Para que o envio automático de mensagens funcione, você precisa configurar sua Service Role Key do Supabase.
              Esta chave permite que o sistema envie mensagens automaticamente quando um novo lead é criado.
            </p>
            <div className="bg-white border border-amber-200 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-slate-900 mb-2">Como obter sua Service Role Key:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-slate-700">
                <li>Acesse o dashboard do Supabase</li>
                <li>Vá em Settings (Configurações) &gt; API</li>
                <li>Copie a "service_role" key (não a "anon" key)</li>
                <li>Cole aqui abaixo e clique em Salvar</li>
              </ol>
            </div>

            {serviceRoleKeyLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-amber-500 border-t-transparent mx-auto"></div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center space-x-2">
                    <Key className="w-4 h-4" />
                    <span>Service Role Key</span>
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type={showServiceKey ? 'text' : 'password'}
                      value={serviceRoleKey}
                      onChange={(e) => setServiceRoleKey(e.target.value)}
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent font-mono text-sm"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    />
                    <button
                      type="button"
                      onClick={() => setShowServiceKey(!showServiceKey)}
                      className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm"
                    >
                      {showServiceKey ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                  {serviceRoleKey === 'PLACEHOLDER_SERVICE_KEY' && (
                    <p className="text-xs text-amber-700 mt-1 flex items-center space-x-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Chave não configurada - envio automático desativado</span>
                    </p>
                  )}
                </div>

                <button
                  onClick={saveServiceRoleKey}
                  disabled={serviceRoleKeySaving || !serviceRoleKey || serviceRoleKey.trim() === ''}
                  className="flex items-center space-x-2 px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  <span>{serviceRoleKeySaving ? 'Salvando...' : 'Salvar Service Role Key'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {configLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center text-slate-600">
          Carregando configurações avançadas...
        </div>
      ) : (
        <div className="space-y-6">
          <AccessControlManager />
          <LeadStatusManager />
          <LeadOriginsManager />
          <ConfigOptionManager
            category="lead_tipo_contratacao"
            title="Tipos de Contratação"
            description="Defina as opções disponíveis ao cadastrar leads e contratos."
            placeholder="Ex: Pessoa Física"
          />
          <ConfigOptionManager
            category="lead_responsavel"
            title="Responsáveis pelos Leads"
            description="Configure a lista de responsáveis disponíveis para atribuição."
            placeholder="Ex: Maria"
          />
          <ConfigOptionManager
            category="contract_status"
            title="Status de Contratos"
            description="Personalize o ciclo de vida dos contratos."
            placeholder="Ex: Ativo"
          />
          <ConfigOptionManager
            category="contract_modalidade"
            title="Modalidades de Contrato"
            description="Cadastre as modalidades aceitas (PF, MEI, Empresarial, etc)."
            placeholder="Ex: Empresarial"
          />
          <ConfigOptionManager
            category="contract_abrangencia"
            title="Abrangências"
            description="Lista de coberturas disponíveis para os contratos."
            placeholder="Ex: Nacional"
          />
          <ConfigOptionManager
            category="contract_acomodacao"
            title="Tipos de Acomodação"
            description="Defina as opções de acomodação para os planos."
            placeholder="Ex: Enfermaria"
          />
          <ConfigOptionManager
            category="contract_carencia"
            title="Tipos de Carência"
            description="Configure as opções de carência disponíveis."
            placeholder="Ex: Padrão"
          />
        </div>
      )}
    </div>
  );
}
