import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  RotateCcw,
  Save,
  Search,
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
import CotadorCatalogTab from "../../../components/config/CotadorCatalogTab";
import { PanelAdaptiveLoadingFrame } from "../../../components/ui/panelLoading";
import { Skeleton } from "../../../components/ui/Skeleton";
import { SystemSettingsSkeleton } from "../../../components/ui/panelSkeletons";
import { Alert, Badge, Button, Checkbox, Field, Input, SectionHeader, Select, Surface, Tabs } from "../../../design-system";
import AccessControlManagerScreen from "./AccessControlManagerScreen";
import {
  areSystemPreferencesEqual,
  CONTRACT_CONFIG_MANAGERS,
  DEFAULT_GENERAL_PREFERENCES,
  LEAD_CONFIG_MANAGERS,
  matchesConfigSearch,
  normalizeConfigSearchText,
  SECTION_OVERVIEW,
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
  const [activeSection, setActiveSection] = useState<SectionId>("general");
  const [activeLeadConfiguration, setActiveLeadConfiguration] = useState("status");
  const [activeContractConfiguration, setActiveContractConfiguration] = useState("");
  const { loading: configLoading, getRoleModulePermission } = useConfig();
  const loadingUi = useAdaptiveLoading(loading);
  const timezoneOptions = useMemo(
    () => [
      { value: "America/Sao_Paulo", label: "São Paulo (UTC-3)" },
      { value: "America/Manaus", label: "Manaus (UTC-4)" },
      { value: "America/Cuiaba", label: "Cuiabá (UTC-4)" },
      { value: "America/Rio_Branco", label: "Rio Branco (UTC-5)" },
      { value: "UTC", label: "UTC (padrão global)" },
    ],
    [],
  );

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
      showMessage("error", "Erro ao salvar configurações do sistema.");
    } else {
      setSavedSettings(settings);
      showMessage("success", "Preferências do sistema salvas com sucesso.");
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
      "Padrões aplicados. Clique em salvar para confirmar.",
    );
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
  const canViewAccessSettings = getRoleModulePermission(
    role,
    "config-access",
  ).can_view;
  const showAccessSection =
    canViewAccessSettings &&
    matchesConfigSearch(normalizedSearchTerm, SECTION_OVERVIEW[1].searchTerms);
  const showCotadorSection = matchesConfigSearch(
    normalizedSearchTerm,
    SECTION_OVERVIEW[2].searchTerms,
  );

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
        case "access":
          return showAccessSection;
        case "cotador":
        return showCotadorSection;
      case "leads":
        return showLeadsSection;
      case "contracts":
        return showContractsSection;
      default:
        return false;
    }
  });

  const hasVisibleSections = visibleSections.length > 0;
  const activeVisibleSection = visibleSections.some(
    (section) => section.id === activeSection,
  )
    ? activeSection
    : visibleSections[0]?.id;

  const hasPendingGeneralChanges = useMemo(
    () => !areSystemPreferencesEqual(settings, savedSettings),
    [savedSettings, settings],
  );

  const shouldExpandSection = (sectionId: SectionId) =>
    activeVisibleSection === sectionId;
  const leadConfigurationTabs = [
    ...(showLeadStatusManager ? [{ id: "status", label: "Funil" }] : []),
    ...(showLeadOriginsManager ? [{ id: "origins", label: "Origens" }] : []),
    ...visibleLeadManagers.map((manager) => ({
      id: `manager:${manager.category}`,
      label: manager.title,
    })),
  ];
  const activeLeadConfigurationId = leadConfigurationTabs.some(
    (tab) => tab.id === activeLeadConfiguration,
  )
    ? activeLeadConfiguration
    : leadConfigurationTabs[0]?.id ?? "status";
  const contractConfigurationTabs = visibleContractManagers.map((manager) => ({
    id: manager.category,
    label: manager.title,
  }));
  const activeContractConfigurationId = contractConfigurationTabs.some(
    (tab) => tab.id === activeContractConfiguration,
  )
    ? activeContractConfiguration
    : contractConfigurationTabs[0]?.id ?? "";

  if (loading && !settings) {
    return (
      <PanelAdaptiveLoadingFrame
        loading
        phase={loadingUi.phase}
        hasContent={false}
        skeleton={<SystemSettingsSkeleton />}
        stageLabel="Carregando configurações do sistema..."
        stageClassName="min-h-[440px]"
      >
        <div />
      </PanelAdaptiveLoadingFrame>
    );
  }

  if (!settings) {
    return (
      <Alert tone="danger" className="p-8 text-center">
        <AlertCircle className="mx-auto mb-4 h-12 w-12" />
        <p>
          Erro ao carregar configurações do sistema.
        </p>
      </Alert>
    );
  }

  return (
    <PanelAdaptiveLoadingFrame
      loading={loading}
      phase={loadingUi.phase}
      hasContent
      skeleton={<SystemSettingsSkeleton />}
      stageLabel="Carregando configurações do sistema..."
      overlayLabel="Atualizando configurações do sistema..."
      stageClassName="min-h-[440px]"
    >
      <div className="panel-page-shell space-y-6">
        {message && (
          <Alert tone={message.type === "success" ? "success" : "danger"} className="flex items-center space-x-3">
            {message.type === "success" ? (
              <CheckCircle className="h-5 w-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
            )}
            <p>{message.text}</p>
          </Alert>
        )}

        <Surface padding="md">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <SectionHeader
              eyebrow="Configuração geral"
              title="Regras, catálogo e cadastros"
              description="Encontre e ajuste uma área por vez, sem perder espaço útil para o conteúdo."
            />
            <div className="w-full xl:max-w-md">
              <Input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por cotador, permissões, leads ou contratos"
                leftIcon={Search}
              />
            </div>
          </div>
          {hasVisibleSections && (
            <Tabs
              items={visibleSections.map(({ id, title, icon }) => ({
                id,
                label: title,
                icon,
              }))}
              value={activeVisibleSection ?? "general"}
              onChange={setActiveSection}
              variant="underline"
              className="mt-5"
              listClassName="flex-nowrap overflow-x-auto"
            />
          )}
        </Surface>

        {!hasVisibleSections && (
          <Surface variant="muted" padding="md" className="border-dashed text-center">
            <p className="text-sm text-[color:var(--text-secondary)]">
              Nenhum bloco encontrado para "{searchTerm}".
            </p>
          </Surface>
        )}

        {showGeneralSection && shouldExpandSection("general") && (
          <section id="settings-section-general" className="space-y-4">
            <SectionHeader
              title="Preferências do sistema"
              description="Notificações, formato de data, fuso horário e tempo de sessão."
            />

            {shouldExpandSection("general") && (
              <Surface variant="muted" padding="md">
                <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="inline-flex items-center gap-2">
                    <Badge tone={hasPendingGeneralChanges ? "gold" : "success"}>
                    {hasPendingGeneralChanges
                      ? "Alterações pendentes"
                      : "Sem alterações pendentes"}
                    </Badge>
                  </div>

                  <Button
                    onClick={handleRestoreGeneralDefaults}
                    variant="secondary"
                    size="sm"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restaurar padrões
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <Field label="Formato de data">
                    <Select
                      value={settings.date_format}
                      onChange={(event) =>
                        setSettings({ ...settings, date_format: event.target.value })
                      }
                      options={[
                        { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
                        { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
                        { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
                      ]}
                    />
                  </Field>

                  <div>
                    <Field label="Tempo de sessão (minutos)" description="Padrão recomendado: 480 minutos (8 horas).">
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
                    </Field>
                  </div>

                  <Field label="Fuso horário do sistema" description="Usado como referência para prompts de follow-up com IA e demais rotinas que dependem do horário local.">
                    <Select
                      value={settings.timezone}
                      onChange={(event) =>
                        setSettings({ ...settings, timezone: event.target.value || "America/Sao_Paulo" })
                      }
                      options={timezoneOptions}
                    />
                  </Field>

                  <div className="lg:col-span-2">
                    <label className="flex cursor-pointer items-center space-x-3">
                      <Checkbox
                        checked={settings.notification_sound_enabled}
                        onChange={(event) =>
                          setSettings({
                            ...settings,
                            notification_sound_enabled: event.target.checked,
                          })
                        }
                      />
                      <div className="flex items-center space-x-2">
                        {settings.notification_sound_enabled ? (
                          <Volume2 className="h-5 w-5 text-[color:var(--brand-primary)]" />
                        ) : (
                          <VolumeX className="h-5 w-5 text-[color:var(--text-tertiary)]" />
                        )}
                        <span className="text-sm font-medium text-[color:var(--text-primary)]">
                          Ativar sons de notificação
                        </span>
                      </div>
                    </label>
                  </div>

                  {settings.notification_sound_enabled && (
                    <div className="lg:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-[color:var(--text-primary)]">
                        Volume das notificações:{" "}
                        {Math.round(settings.notification_volume * 100)}%
                      </label>
                      <Input
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
                        className="h-2 cursor-pointer appearance-none px-0"
                      />
                    </div>
                  )}

                  <div className="lg:col-span-2">
                    <label className="mb-2 flex items-center space-x-2 text-sm font-medium text-[color:var(--text-primary)]">
                      <Clock className="h-4 w-4" />
                      <span>
                        Intervalo de verificação de notificações (segundos)
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
                    <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
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
                      {saving ? "Salvando..." : "Salvar preferências"}
                    </span>
                  </Button>
                </div>
              </Surface>
            )}
          </section>
        )}

        {showCotadorSection && shouldExpandSection("cotador") && (
          <section id="settings-section-cotador" className="space-y-4">
            <SectionHeader
              title="Catálogo do cotador"
              description="Operadoras, administradoras, entidades de classe e produtos comerciais."
            />

            {shouldExpandSection("cotador") && (
              <CotadorCatalogTab embedded />
            )}
          </section>
        )}

        {showAccessSection && shouldExpandSection("access") && (
          <section id="settings-section-access" className="space-y-4">
            <SectionHeader
              title="Perfis e acessos"
              description="Controle de acesso aos módulos para cada tipo de usuário."
            />

            {shouldExpandSection("access") && (
              <div className="space-y-4">
                {configLoading ? (
                  <Surface variant="muted" padding="md">
                    <Skeleton className="h-6 w-56" />
                    <div className="mt-4 space-y-3">
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                    </div>
                  </Surface>
                ) : (
                  <AccessControlManagerScreen />
                )}
              </div>
            )}
          </section>
        )}

        {showLeadsSection && shouldExpandSection("leads") && (
          <section id="settings-section-leads" className="space-y-4">
            <SectionHeader
              title="Configurações de leads"
              description="Etapas do funil, origens e cadastros auxiliares."
            />

            {shouldExpandSection("leads") && (
              <div className="space-y-6">
                {configLoading ? (
                  <Surface variant="muted" padding="md">
                    <Skeleton className="h-6 w-48" />
                    <div className="mt-4 space-y-3">
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                    </div>
                  </Surface>
                ) : (
                  <>
                    {leadConfigurationTabs.length > 0 ? (
                      <>
                        <Tabs
                          items={leadConfigurationTabs}
                          value={activeLeadConfigurationId}
                          onChange={setActiveLeadConfiguration}
                          variant="underline"
                          listClassName="flex-nowrap overflow-x-auto"
                        />
                        {activeLeadConfigurationId === "status" && <LeadStatusManager />}
                        {activeLeadConfigurationId === "origins" && <LeadOriginsManager />}
                        {activeLeadConfigurationId.startsWith("manager:") && (() => {
                          const manager = visibleLeadManagers.find(
                            (item) => `manager:${item.category}` === activeLeadConfigurationId,
                          );
                          return manager ? (
                            <ConfigOptionManager
                              category={manager.category}
                              title={manager.title}
                              description={manager.description}
                              placeholder={manager.placeholder}
                            />
                          ) : null;
                        })()}
                      </>
                    ) : (
                        <Surface variant="muted" padding="md" className="border-dashed text-center text-sm">
                          Nenhum item de leads encontrado para "{searchTerm}".
                        </Surface>
                    )}
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {showContractsSection && shouldExpandSection("contracts") && (
          <section id="settings-section-contracts" className="space-y-4">
            <SectionHeader
              title="Configurações de contratos"
              description="Estados e parâmetros auxiliares usados no cadastro de contratos."
            />

            {shouldExpandSection("contracts") && (
              <div className="space-y-6">
                {configLoading ? (
                  <Surface variant="muted" padding="md">
                    <Skeleton className="h-6 w-56" />
                    <div className="mt-4 space-y-3">
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                      <Skeleton className="h-10 w-full rounded-lg" />
                    </div>
                  </Surface>
                ) : (
                  contractConfigurationTabs.length > 0 ? (
                    <>
                      <Tabs
                        items={contractConfigurationTabs}
                        value={activeContractConfigurationId}
                        onChange={setActiveContractConfiguration}
                        variant="underline"
                        listClassName="flex-nowrap overflow-x-auto"
                      />
                      {(() => {
                        const manager = visibleContractManagers.find(
                          (item) => item.category === activeContractConfigurationId,
                        );
                        return manager ? (
                          <ConfigOptionManager
                            category={manager.category}
                            title={manager.title}
                            description={manager.description}
                            placeholder={manager.placeholder}
                          />
                        ) : null;
                      })()}
                    </>
                  ) : (
                      <Surface variant="muted" padding="md" className="border-dashed text-center text-sm">
                        Nenhum item de contratos encontrado para "{searchTerm}".
                      </Surface>
                  )
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </PanelAdaptiveLoadingFrame>
  );
}
