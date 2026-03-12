import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
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
} from "lucide-react";
import { useConfig } from "../../../contexts/ConfigContext";
import { useAuth } from "../../../contexts/AuthContext";
import { useAdaptiveLoading } from "../../../hooks/useAdaptiveLoading";
import { configService } from "../../../lib/configService";
import { type SystemSettings } from "../../../lib/supabase";
import ConfigOptionManager from "../../../components/config/ConfigOptionManager";
import LeadOriginsManager from "../../../components/config/LeadOriginsManager";
import LeadStatusManager from "../../../components/config/LeadStatusManager";
import OperadorasTab from "../../../components/config/OperadorasTab";
import FilterSingleSelect from "../../../components/FilterSingleSelect";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { PanelAdaptiveLoadingFrame } from "../../../components/ui/panelLoading";
import { Skeleton } from "../../../components/ui/Skeleton";
import { SystemSettingsSkeleton } from "../../../components/ui/panelSkeletons";
import AccessControlManagerScreen from "./AccessControlManagerScreen";
import {
  areSystemPreferencesEqual,
  CONTRACT_CONFIG_MANAGERS,
  DEFAULT_GENERAL_PREFERENCES,
  LEAD_CONFIG_MANAGERS,
  matchesConfigSearch,
  normalizeConfigSearchText,
  SECTION_OVERVIEW,
  SYSTEM_SETTINGS_SECTION_BODY_CLASS,
  SYSTEM_SETTINGS_SECTION_CARD_CLASS,
  type SectionId,
  type SettingsMessage,
} from "./shared/systemSettingsConfig";

export default function SystemSettingsScreen() {
  const { role } = useAuth();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [savedSettings, setSavedSettings] = useState<SystemSettings | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<SettingsMessage | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<
    Record<SectionId, boolean>
  >({
    general: false,
    operadoras: false,
    access: false,
    leads: false,
    contracts: false,
  });
  const { loading: configLoading, getRoleModulePermission } = useConfig();
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

  const showMessage = (type: SettingsMessage["type"], text: string) => {
    setMessage({ type, text });
  };

  const handleSave = async () => {
    if (!settings) {
      return;
    }

    setSaving(true);
    const { error } = await configService.updateSystemSettings(settings);

    if (error) {
      showMessage("error", "Erro ao salvar configuracoes do sistema.");
    } else {
      setSavedSettings(settings);
      showMessage("success", "Preferencias do sistema salvas com sucesso.");
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
    showMessage(
      "success",
      "Padroes aplicados. Clique em salvar para confirmar.",
    );
  };

  const toggleSection = (sectionId: SectionId) => {
    setCollapsedSections((previous) => ({
      ...previous,
      [sectionId]: !previous[sectionId],
    }));
  };

  const revealSection = (sectionId: SectionId) => {
    setCollapsedSections((previous) => ({
      ...previous,
      [sectionId]: false,
    }));

    window.requestAnimationFrame(() => {
      document.getElementById(`settings-section-${sectionId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const normalizedSearchTerm = useMemo(
    () => normalizeConfigSearchText(searchTerm),
    [searchTerm],
  );

  const visibleLeadManagers = useMemo(
    () =>
      LEAD_CONFIG_MANAGERS.filter((manager) =>
        matchesConfigSearch(normalizedSearchTerm, [
          manager.title,
          manager.description,
          ...manager.searchTerms,
        ]),
      ),
    [normalizedSearchTerm],
  );

  const visibleContractManagers = useMemo(
    () =>
      CONTRACT_CONFIG_MANAGERS.filter((manager) =>
        matchesConfigSearch(normalizedSearchTerm, [
          manager.title,
          manager.description,
          ...manager.searchTerms,
        ]),
      ),
    [normalizedSearchTerm],
  );

  const showGeneralSection = matchesConfigSearch(
    normalizedSearchTerm,
    SECTION_OVERVIEW[0].searchTerms,
  );
  const showOperadorasSection = matchesConfigSearch(
    normalizedSearchTerm,
    SECTION_OVERVIEW[1].searchTerms,
  );
  const canViewAccessSettings = getRoleModulePermission(
    role,
    "config-access",
  ).can_view;
  const showAccessSection =
    canViewAccessSettings &&
    matchesConfigSearch(normalizedSearchTerm, SECTION_OVERVIEW[2].searchTerms);

  const showLeadStatusManager = matchesConfigSearch(normalizedSearchTerm, [
    "status dos leads",
    "status",
    "funil",
    "cores",
    "ordem",
  ]);

  const showLeadOriginsManager = matchesConfigSearch(normalizedSearchTerm, [
    "origens de leads",
    "origens",
    "origem",
    "canais",
    "observadores",
  ]);

  const showLeadsSection =
    matchesConfigSearch(
      normalizedSearchTerm,
      SECTION_OVERVIEW[3].searchTerms,
    ) ||
    showLeadStatusManager ||
    showLeadOriginsManager ||
    visibleLeadManagers.length > 0;

  const showContractsSection =
    matchesConfigSearch(
      normalizedSearchTerm,
      SECTION_OVERVIEW[4].searchTerms,
    ) || visibleContractManagers.length > 0;

  const visibleSections = SECTION_OVERVIEW.filter((section) => {
    switch (section.id) {
      case "general":
        return showGeneralSection;
      case "operadoras":
        return showOperadorasSection;
      case "access":
        return showAccessSection;
      case "leads":
        return showLeadsSection;
      case "contracts":
        return showContractsSection;
      default:
        return false;
    }
  });

  const hasVisibleSections = visibleSections.length > 0;

  const hasPendingGeneralChanges = useMemo(
    () => !areSystemPreferencesEqual(settings, savedSettings),
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
        <p className="text-red-700">
          Erro ao carregar configuracoes do sistema.
        </p>
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
            className={`flex items-center space-x-3 rounded-xl border p-4 ${
              message.type === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
            )}
            <p>{message.text}</p>
          </div>
        )}

        <div className="rounded-3xl border border-[color:var(--panel-border-subtle)] bg-[var(--panel-surface)] p-6 shadow-sm">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[color:var(--panel-border-subtle)] bg-[var(--panel-surface-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--panel-text-soft)]">
                <Settings className="h-3.5 w-3.5" />
                Central de configuracoes
              </div>
              <h2 className="text-2xl font-semibold text-[color:var(--panel-text)]">
                Sistema e operadoras agora vivem no mesmo fluxo
              </h2>
              <p className="mt-2 text-sm text-[color:var(--panel-text-soft)]">
                Organize preferencias, acessos, operadoras, leads e contratos em
                uma experiencia unica, com busca e atalhos por area.
              </p>
            </div>

            <div className="w-full xl:max-w-md">
              <Input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por operadoras, permissoes, leads, contratos..."
                leftIcon={Search}
              />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            {visibleSections.map((section) => {
              const Icon = section.icon;
              const expanded = shouldExpandSection(section.id);

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => revealSection(section.id)}
                  className="rounded-2xl border border-[color:var(--panel-border-subtle)] bg-[var(--panel-surface-soft)] p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[color:var(--panel-border)] hover:bg-[var(--panel-surface)] hover:shadow-md"
                >
                  <div
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${section.accentClassName}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-[color:var(--panel-text)]">
                    {section.title}
                  </h3>
                  <p className="mt-1 text-sm text-[color:var(--panel-text-soft)]">
                    {section.description}
                  </p>
                  <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--panel-text-muted)]">
                    {expanded ? "Visivel" : "Fechada"}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {!hasVisibleSections && (
          <div className="rounded-2xl border border-dashed border-[color:var(--panel-border)] bg-[var(--panel-surface-soft)] p-6 text-center">
            <p className="text-sm text-[color:var(--panel-text-soft)]">
              Nenhum bloco encontrado para "{searchTerm}".
            </p>
          </div>
        )}

        {showGeneralSection && (
          <div id="settings-section-general" className="space-y-4">
            <button
              type="button"
              onClick={() => toggleSection("general")}
              className={SYSTEM_SETTINGS_SECTION_CARD_CLASS}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--panel-accent-amber-bg)] text-[var(--panel-accent-amber-text)]">
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[color:var(--panel-text)]">
                    Preferencias do sistema
                  </h3>
                  <p className="text-sm text-[color:var(--panel-text-soft)]">
                    Notificacoes, formato de data e tempo de sessao.
                  </p>
                </div>
              </div>
              <ChevronDown
                className={`h-5 w-5 text-slate-500 transition-transform ${
                  shouldExpandSection("general") ? "rotate-180" : ""
                }`}
              />
            </button>

            {shouldExpandSection("general") && (
              <div className={SYSTEM_SETTINGS_SECTION_BODY_CLASS}>
                <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                      hasPendingGeneralChanges
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {hasPendingGeneralChanges
                      ? "Alteracoes pendentes"
                      : "Sem alteracoes pendentes"}
                  </div>

                  <button
                    type="button"
                    onClick={handleRestoreGeneralDefaults}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restaurar padroes
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Formato de data
                    </label>
                    <FilterSingleSelect
                      icon={Calendar}
                      value={settings.date_format}
                      onChange={(value) =>
                        setSettings({ ...settings, date_format: value })
                      }
                      placeholder="Formato de data"
                      includePlaceholderOption={false}
                      options={[
                        { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
                        { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
                        { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
                      ]}
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Tempo de sessao (minutos)
                    </label>
                    <Input
                      type="number"
                      min="30"
                      max="1440"
                      value={settings.session_timeout_minutes}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          session_timeout_minutes:
                            Number.parseInt(event.target.value, 10) || 480,
                        })
                      }
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Padrao recomendado: 480 minutos (8 horas).
                    </p>
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
                        <span className="text-sm font-medium text-slate-700">
                          Ativar sons de notificacao
                        </span>
                      </div>
                    </label>
                  </div>

                  {settings.notification_sound_enabled && (
                    <div className="lg:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Volume das notificacoes:{" "}
                        {Math.round(settings.notification_volume * 100)}%
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
                            notification_volume: Number.parseFloat(
                              event.target.value,
                            ),
                          })
                        }
                        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-teal-600"
                      />
                    </div>
                  )}

                  <div className="lg:col-span-2">
                    <label className="mb-2 flex items-center space-x-2 text-sm font-medium text-slate-700">
                      <Clock className="h-4 w-4" />
                      <span>
                        Intervalo de verificacao de notificacoes (segundos)
                      </span>
                    </label>
                    <Input
                      type="number"
                      min="10"
                      max="300"
                      value={settings.notification_interval_seconds}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          notification_interval_seconds:
                            Number.parseInt(event.target.value, 10) || 30,
                        })
                      }
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Recomendado: 30 segundos.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <Button
                    onClick={handleSave}
                    disabled={saving || !hasPendingGeneralChanges}
                  >
                    <Save className="h-4 w-4" />
                    <span>
                      {saving ? "Salvando..." : "Salvar preferencias"}
                    </span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {showOperadorasSection && (
          <div id="settings-section-operadoras" className="space-y-4">
            <button
              type="button"
              onClick={() => toggleSection("operadoras")}
              className={SYSTEM_SETTINGS_SECTION_CARD_CLASS}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--panel-accent-emerald-bg)] text-[var(--panel-accent-emerald-text)]">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[color:var(--panel-text)]">
                    Operadoras
                  </h3>
                  <p className="text-sm text-[color:var(--panel-text-soft)]">
                    Comissao, prazo, bonus e manutencao da carteira comercial.
                  </p>
                </div>
              </div>
              <ChevronDown
                className={`h-5 w-5 text-slate-500 transition-transform ${
                  shouldExpandSection("operadoras") ? "rotate-180" : ""
                }`}
              />
            </button>

            {shouldExpandSection("operadoras") && (
              <div className={SYSTEM_SETTINGS_SECTION_BODY_CLASS}>
                <OperadorasTab embedded />
              </div>
            )}
          </div>
        )}

        {showAccessSection && (
          <div id="settings-section-access" className="space-y-4">
            <button
              type="button"
              onClick={() => toggleSection("access")}
              className={SYSTEM_SETTINGS_SECTION_CARD_CLASS}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--panel-accent-blue-bg)] text-[var(--panel-accent-blue-text)]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[color:var(--panel-text)]">
                    Permissoes por perfil
                  </h3>
                  <p className="text-sm text-[color:var(--panel-text-soft)]">
                    Controle de acesso aos modulos para cada tipo de usuario.
                  </p>
                </div>
              </div>
              <ChevronDown
                className={`h-5 w-5 text-slate-500 transition-transform ${
                  shouldExpandSection("access") ? "rotate-180" : ""
                }`}
              />
            </button>

            {shouldExpandSection("access") && (
              <div className="space-y-4">
                {configLoading ? (
                  <div className={SYSTEM_SETTINGS_SECTION_BODY_CLASS}>
                    <Skeleton className="h-6 w-56" />
                    <div className="mt-4 space-y-3">
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                    </div>
                  </div>
                ) : (
                  <AccessControlManagerScreen />
                )}
              </div>
            )}
          </div>
        )}

        {showLeadsSection && (
          <div id="settings-section-leads" className="space-y-4">
            <button
              type="button"
              onClick={() => toggleSection("leads")}
              className={SYSTEM_SETTINGS_SECTION_CARD_CLASS}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--panel-accent-orange-bg)] text-[var(--panel-accent-orange-text)]">
                  <ListTree className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[color:var(--panel-text)]">
                    Leads
                  </h3>
                  <p className="text-sm text-[color:var(--panel-text-soft)]">
                    Etapas do funil, origens e cadastros de apoio para leads.
                  </p>
                </div>
              </div>
              <ChevronDown
                className={`h-5 w-5 text-slate-500 transition-transform ${
                  shouldExpandSection("leads") ? "rotate-180" : ""
                }`}
              />
            </button>

            {shouldExpandSection("leads") && (
              <div className="space-y-6">
                {configLoading ? (
                  <div className={SYSTEM_SETTINGS_SECTION_BODY_CLASS}>
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
                    {!showLeadStatusManager &&
                      !showLeadOriginsManager &&
                      visibleLeadManagers.length === 0 && (
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
          <div id="settings-section-contracts" className="space-y-4">
            <button
              type="button"
              onClick={() => toggleSection("contracts")}
              className={SYSTEM_SETTINGS_SECTION_CARD_CLASS}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--panel-accent-green-bg)] text-[var(--panel-accent-green-text)]">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[color:var(--panel-text)]">
                    Contratos
                  </h3>
                  <p className="text-sm text-[color:var(--panel-text-soft)]">
                    Estados e parametros auxiliares usados no cadastro de
                    contratos.
                  </p>
                </div>
              </div>
              <ChevronDown
                className={`h-5 w-5 text-slate-500 transition-transform ${
                  shouldExpandSection("contracts") ? "rotate-180" : ""
                }`}
              />
            </button>

            {shouldExpandSection("contracts") && (
              <div className="space-y-6">
                {configLoading ? (
                  <div className={SYSTEM_SETTINGS_SECTION_BODY_CLASS}>
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
