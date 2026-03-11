import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ChevronDown,
  Clock,
  FileText,
  ListTree,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { type SystemSettings } from '../../lib/supabase';
import { configService, type ConfigCategory } from '../../lib/configService';
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

type SettingsMessage = { type: 'success' | 'error'; text: string };
type SectionId = 'general' | 'access' | 'leads' | 'contracts';

type ConfigManagerDefinition = {
  category: ConfigCategory;
  title: string;
  description: string;
  placeholder: string;
  searchTerms: string[];
};

const DEFAULT_GENERAL_PREFERENCES = {
  date_format: 'DD/MM/YYYY',
  notification_sound_enabled: true,
  notification_volume: 0.7,
  notification_interval_seconds: 30,
  session_timeout_minutes: 480,
};

const LEAD_CONFIG_MANAGERS: ConfigManagerDefinition[] = [
  {
    category: 'lead_tipo_contratacao',
    title: 'Tipos de Contratação',
    description: 'Defina as opções disponíveis ao cadastrar leads e contratos.',
    placeholder: 'Ex: Pessoa Física',
    searchTerms: ['lead', 'tipos', 'contratacao', 'cadastro'],
  },
  {
    category: 'lead_responsavel',
    title: 'Responsáveis pelos Leads',
    description: 'Configure a lista de responsáveis disponíveis para atribuição.',
    placeholder: 'Ex: Maria',
    searchTerms: ['lead', 'responsavel', 'atendimento', 'time'],
  },
];

const CONTRACT_CONFIG_MANAGERS: ConfigManagerDefinition[] = [
  {
    category: 'contract_status',
    title: 'Status de Contratos',
    description: 'Personalize o ciclo de vida dos contratos.',
    placeholder: 'Ex: Ativo',
    searchTerms: ['contrato', 'status', 'etapas'],
  },
  {
    category: 'contract_modalidade',
    title: 'Modalidades de Contrato',
    description: 'Cadastre as modalidades aceitas (PF, MEI, Empresarial, etc).',
    placeholder: 'Ex: Empresarial',
    searchTerms: ['contrato', 'modalidade', 'pf', 'mei', 'empresarial'],
  },
  {
    category: 'contract_abrangencia',
    title: 'Abrangências',
    description: 'Lista de coberturas disponíveis para os contratos.',
    placeholder: 'Ex: Nacional',
    searchTerms: ['contrato', 'abrangencia', 'cobertura'],
  },
  {
    category: 'contract_acomodacao',
    title: 'Tipos de Acomodação',
    description: 'Defina as opções de acomodação para os planos.',
    placeholder: 'Ex: Enfermaria',
    searchTerms: ['contrato', 'acomodacao', 'plano'],
  },
  {
    category: 'contract_carencia',
    title: 'Tipos de Carência',
    description: 'Configure as opções de carência disponíveis.',
    placeholder: 'Ex: Padrão',
    searchTerms: ['contrato', 'carencia', 'prazo'],
  },
];

const normalizeSearchText = (value: string) =>
  value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const matchesSearch = (normalizedTerm: string, values: string[]) => {
  if (!normalizedTerm) {
    return true;
  }

  return values.some((value) => normalizeSearchText(value).includes(normalizedTerm));
};

const arePreferencesEqual = (a: SystemSettings | null, b: SystemSettings | null) => {
  if (!a || !b) {
    return false;
  }

  return (
    a.date_format === b.date_format
    && a.notification_sound_enabled === b.notification_sound_enabled
    && a.notification_volume === b.notification_volume
    && a.notification_interval_seconds === b.notification_interval_seconds
    && a.session_timeout_minutes === b.session_timeout_minutes
  );
};

const sectionCardClass =
  'flex w-full items-start justify-between rounded-xl border border-amber-200/70 bg-white/95 p-4 text-left shadow-sm transition-colors hover:border-amber-300/80 hover:bg-white';

const sectionBodyClass = 'rounded-xl border border-amber-200/60 bg-white/95 p-6 shadow-sm';

export default function SystemSettingsTab() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [savedSettings, setSavedSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<SettingsMessage | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<SectionId, boolean>>({
    general: false,
    access: false,
    leads: false,
    contracts: false,
  });
  const { loading: configLoading } = useConfig();
  const loadingUi = useAdaptiveLoading(loading);

  useEffect(() => {
    void loadSettings();
  }, []);

  useEffect(() => {
    if (!message) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setMessage(null);
    }, 5000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [message]);

  const loadSettings = async () => {
    setLoading(true);
    const data = await configService.getSystemSettings();
    setSettings(data);
    setSavedSettings(data);
    setLoading(false);
  };

  const showMessage = (type: SettingsMessage['type'], text: string) => {
    setMessage({ type, text });
  };

  const handleSave = async () => {
    if (!settings) {
      return;
    }

    setSaving(true);
    const { error } = await configService.updateSystemSettings(settings);

    if (error) {
      showMessage('error', 'Erro ao salvar configurações do sistema.');
    } else {
      setSavedSettings(settings);
      showMessage('success', 'Preferências do sistema salvas com sucesso.');
    }

    setSaving(false);
  };

  const handleRestoreGeneralDefaults = () => {
    if (!settings) {
      return;
    }

    setSettings({
      ...settings,
      ...DEFAULT_GENERAL_PREFERENCES,
    });
    showMessage('success', 'Padrões aplicados. Clique em salvar para confirmar.');
  };

  const toggleSection = (sectionId: SectionId) => {
    setCollapsedSections((previous) => ({
      ...previous,
      [sectionId]: !previous[sectionId],
    }));
  };

  const normalizedSearchTerm = useMemo(() => normalizeSearchText(searchTerm), [searchTerm]);

  const visibleLeadManagers = useMemo(
    () =>
      LEAD_CONFIG_MANAGERS.filter((manager) =>
        matchesSearch(normalizedSearchTerm, [manager.title, manager.description, ...manager.searchTerms]),
      ),
    [normalizedSearchTerm],
  );

  const visibleContractManagers = useMemo(
    () =>
      CONTRACT_CONFIG_MANAGERS.filter((manager) =>
        matchesSearch(normalizedSearchTerm, [manager.title, manager.description, ...manager.searchTerms]),
      ),
    [normalizedSearchTerm],
  );

  const showGeneralSection = matchesSearch(normalizedSearchTerm, [
    'preferencias',
    'sistema',
    'notificacao',
    'volume',
    'intervalo',
    'sessao',
    'data',
  ]);

  const showAccessSection = matchesSearch(normalizedSearchTerm, [
    'permissoes',
    'perfil',
    'modulos',
    'acesso',
    'admin',
    'observer',
  ]);

  const showLeadStatusManager = matchesSearch(normalizedSearchTerm, [
    'status dos leads',
    'status',
    'funil',
    'cores',
    'ordem',
  ]);

  const showLeadOriginsManager = matchesSearch(normalizedSearchTerm, [
    'origens de leads',
    'origens',
    'origem',
    'canais',
    'observadores',
  ]);

  const showLeadsSection =
    showLeadStatusManager || showLeadOriginsManager || visibleLeadManagers.length > 0;

  const showContractsSection = visibleContractManagers.length > 0;

  const hasVisibleSections =
    showGeneralSection || showAccessSection || showLeadsSection || showContractsSection;

  const hasPendingGeneralChanges = useMemo(
    () => !arePreferencesEqual(settings, savedSettings),
    [savedSettings, settings],
  );

  const shouldExpandSection = (sectionId: SectionId) => {
    if (normalizedSearchTerm) {
      return true;
    }

    return !collapsedSections[sectionId];
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
      <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-600" />
        <p className="text-red-700">Erro ao carregar configurações do sistema.</p>
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
      <div className="panel-page-shell space-y-6">
        {message && (
          <div
            className={`flex items-center space-x-3 rounded-lg border p-4 ${
              message.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
            )}
            <p>{message.text}</p>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Reorganização de Sistema</h3>
              <p className="text-sm text-slate-600">Filtre configurações e gerencie os blocos por área.</p>
            </div>
            <div className="w-full lg:max-w-md">
              <Input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por permissões, leads, contratos..."
                leftIcon={Search}
              />
            </div>
          </div>
        </div>

        {!hasVisibleSections && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <p className="text-sm text-slate-600">Nenhum bloco encontrado para "{searchTerm}".</p>
          </div>
        )}

        {showGeneralSection && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => toggleSection('general')}
              className={sectionCardClass}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Preferências do Sistema</h3>
                  <p className="text-sm text-slate-600">Notificações, formato de data e sessão.</p>
                </div>
              </div>
              <ChevronDown
                className={`h-5 w-5 text-slate-500 transition-transform ${
                  shouldExpandSection('general') ? 'rotate-180' : ''
                }`}
              />
            </button>

            {shouldExpandSection('general') && (
              <div className={sectionBodyClass}>
                <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                      hasPendingGeneralChanges
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {hasPendingGeneralChanges ? 'Alterações pendentes' : 'Sem alterações pendentes'}
                  </div>

                  <button
                    type="button"
                    onClick={handleRestoreGeneralDefaults}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restaurar padrões
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Formato de Data</label>
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
                    <label className="mb-2 block text-sm font-medium text-slate-700">Tempo de Sessão (minutos)</label>
                    <Input
                      type="number"
                      min="30"
                      max="1440"
                      value={settings.session_timeout_minutes}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          session_timeout_minutes: Number.parseInt(event.target.value, 10) || 480,
                        })
                      }
                    />
                    <p className="mt-1 text-xs text-slate-500">Padrão recomendado: 480 minutos (8 horas).</p>
                  </div>

                  <div className="lg:col-span-2">
                    <label className="flex cursor-pointer items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={settings.notification_sound_enabled}
                        onChange={(event) =>
                          setSettings({
                            ...settings,
                            notification_sound_enabled: event.target.checked,
                          })
                        }
                        className="h-5 w-5 rounded border-slate-300 text-teal-600 focus:ring-2 focus:ring-teal-500"
                      />
                      <div className="flex items-center space-x-2">
                        {settings.notification_sound_enabled ? (
                          <Volume2 className="h-5 w-5 text-teal-600" />
                        ) : (
                          <VolumeX className="h-5 w-5 text-slate-400" />
                        )}
                        <span className="text-sm font-medium text-slate-700">Ativar sons de notificação</span>
                      </div>
                    </label>
                  </div>

                  {settings.notification_sound_enabled && (
                    <div className="lg:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Volume das notificações: {Math.round(settings.notification_volume * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={settings.notification_volume}
                        onChange={(event) =>
                          setSettings({
                            ...settings,
                            notification_volume: Number.parseFloat(event.target.value),
                          })
                        }
                        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-teal-600"
                      />
                    </div>
                  )}

                  <div className="lg:col-span-2">
                    <label className="mb-2 flex items-center space-x-2 text-sm font-medium text-slate-700">
                      <Clock className="h-4 w-4" />
                      <span>Intervalo de verificação de notificações (segundos)</span>
                    </label>
                    <Input
                      type="number"
                      min="10"
                      max="300"
                      value={settings.notification_interval_seconds}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          notification_interval_seconds: Number.parseInt(event.target.value, 10) || 30,
                        })
                      }
                    />
                    <p className="mt-1 text-xs text-slate-500">Recomendado: 30 segundos.</p>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <Button onClick={handleSave} disabled={saving || !hasPendingGeneralChanges}>
                    <Save className="h-4 w-4" />
                    <span>{saving ? 'Salvando...' : 'Salvar preferências'}</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {showAccessSection && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => toggleSection('access')}
              className={sectionCardClass}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Permissões por Perfil</h3>
                  <p className="text-sm text-slate-600">Controle de acesso aos módulos para cada tipo de usuário.</p>
                </div>
              </div>
              <ChevronDown
                className={`h-5 w-5 text-slate-500 transition-transform ${
                  shouldExpandSection('access') ? 'rotate-180' : ''
                }`}
              />
            </button>

            {shouldExpandSection('access') && (
              <div className="space-y-4">
                {configLoading ? (
                  <div className={sectionBodyClass}>
                    <Skeleton className="h-6 w-56" />
                    <div className="mt-4 space-y-3">
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                    </div>
                  </div>
                ) : (
                  <AccessControlManager />
                )}
              </div>
            )}
          </div>
        )}

        {showLeadsSection && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => toggleSection('leads')}
              className={sectionCardClass}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-orange-700">
                  <ListTree className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Leads</h3>
                  <p className="text-sm text-slate-600">Etapas do funil, origens e cadastros de apoio para leads.</p>
                </div>
              </div>
              <ChevronDown
                className={`h-5 w-5 text-slate-500 transition-transform ${
                  shouldExpandSection('leads') ? 'rotate-180' : ''
                }`}
              />
            </button>

            {shouldExpandSection('leads') && (
              <div className="space-y-6">
                {configLoading ? (
                  <div className={sectionBodyClass}>
                    <Skeleton className="h-6 w-48" />
                    <div className="mt-4 space-y-3">
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                    </div>
                  </div>
                ) : (
                  <>
                    {showLeadStatusManager && <LeadStatusManager />}
                    {showLeadOriginsManager && <LeadOriginsManager />}
                    {visibleLeadManagers.map((manager) => (
                      <ConfigOptionManager
                        key={manager.category}
                        category={manager.category}
                        title={manager.title}
                        description={manager.description}
                        placeholder={manager.placeholder}
                      />
                    ))}
                    {!showLeadStatusManager && !showLeadOriginsManager && visibleLeadManagers.length === 0 && (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                        Nenhum item de leads encontrado para "{searchTerm}".
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {showContractsSection && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => toggleSection('contracts')}
              className={sectionCardClass}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Contratos</h3>
                  <p className="text-sm text-slate-600">Estados e parâmetros auxiliares usados no cadastro de contratos.</p>
                </div>
              </div>
              <ChevronDown
                className={`h-5 w-5 text-slate-500 transition-transform ${
                  shouldExpandSection('contracts') ? 'rotate-180' : ''
                }`}
              />
            </button>

            {shouldExpandSection('contracts') && (
              <div className="space-y-6">
                {configLoading ? (
                  <div className={sectionBodyClass}>
                    <Skeleton className="h-6 w-56" />
                    <div className="mt-4 space-y-3">
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                    </div>
                  </div>
                ) : (
                  <>
                    {visibleContractManagers.map((manager) => (
                      <ConfigOptionManager
                        key={manager.category}
                        category={manager.category}
                        title={manager.title}
                        description={manager.description}
                        placeholder={manager.placeholder}
                      />
                    ))}
                    {visibleContractManagers.length === 0 && (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                        Nenhum item de contratos encontrado para "{searchTerm}".
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </PanelAdaptiveLoadingFrame>
  );
}
