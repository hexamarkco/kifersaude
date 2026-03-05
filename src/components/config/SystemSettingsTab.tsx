import { useState, useEffect } from 'react';
import { Settings, Volume2, VolumeX, Clock, Calendar, Save, CheckCircle, AlertCircle, Key, AlertTriangle } from 'lucide-react';
import { SystemSettings, supabase } from '../../lib/supabase';
import { configService } from '../../lib/configService';
import { useConfig } from '../../contexts/ConfigContext';
import LeadStatusManager from './LeadStatusManager';
import LeadOriginsManager from './LeadOriginsManager';
import ConfigOptionManager from './ConfigOptionManager';
import AccessControlManager from './AccessControlManager';
import FilterSingleSelect from '../FilterSingleSelect';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { Skeleton } from '../ui/Skeleton';
import { SystemSettingsSkeleton } from '../ui/panelSkeletons';
import { useAdaptiveLoading } from '../../hooks/useAdaptiveLoading';
import { PanelAdaptiveLoadingFrame } from '../ui/panelLoading';

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
  const loadingUi = useAdaptiveLoading(loading);

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

  if (loading && !settings) {
    return (
      <PanelAdaptiveLoadingFrame
        loading
        phase={loadingUi.phase}
        hasContent={false}
        skeleton={<SystemSettingsSkeleton />}
        stageLabel="Carregando configuracoes do sistema..."
        stageClassName="min-h-[440px]"
      >
        <div />
      </PanelAdaptiveLoadingFrame>
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
    <PanelAdaptiveLoadingFrame
      loading={loading}
      phase={loadingUi.phase}
      hasContent
      skeleton={<SystemSettingsSkeleton />}
      stageLabel="Carregando configuracoes do sistema..."
      overlayLabel="Atualizando configuracoes do sistema..."
      stageClassName="min-h-[440px]"
    >
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
            <Input
              type="text"
              value={settings.company_name}
              onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
              placeholder="Nome da sua empresa"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Formato de Data
            </label>
            <FilterSingleSelect
              icon={Calendar}
              value={settings.date_format}
              onChange={(value) => setSettings({ ...settings, date_format: value })}
              placeholder="Formato de data"
              includePlaceholderOption={false}
              options={[
                { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
                { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
              ]}
            />
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
            <Input
              type="number"
              min="10"
              max="300"
              value={settings.notification_interval_seconds}
              onChange={(e) => setSettings({ ...settings, notification_interval_seconds: parseInt(e.target.value) || 30 })}
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
            <Input
              type="number"
              min="30"
              max="1440"
              value={settings.session_timeout_minutes}
              onChange={(e) => setSettings({ ...settings, session_timeout_minutes: parseInt(e.target.value) || 480 })}
            />
            <p className="text-xs text-slate-500 mt-1">
              Tempo antes do logout automático (padrão: 480 minutos / 8 horas)
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Salvando...' : 'Salvar Configurações'}</span>
          </Button>
        </div>
      </div>

      {configLoading ? (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <Skeleton className="h-6 w-56" />
            <div className="mt-4 space-y-3">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <Skeleton className="h-6 w-48" />
            <div className="mt-4 space-y-3">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
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
    </PanelAdaptiveLoadingFrame>
  );
}
