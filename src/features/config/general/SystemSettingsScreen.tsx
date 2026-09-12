import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BellRing,
  Clock,
  Globe2,
  Info,
  Loader2,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useConfig } from "../../../contexts/ConfigContext";
import { useAuth } from "../../../contexts/AuthContext";
import { useAdaptiveLoading } from "../../../hooks/useAdaptiveLoading";
import { configService, type SystemSettings } from "..";
import { toast } from "../../../lib/toast";
import ConfigOptionManager from "../../../components/config/ConfigOptionManager";
import LeadOriginsManager from "../../../components/config/LeadOriginsManager";
import LeadStatusManager from "../../../components/config/LeadStatusManager";
import { PanelAdaptiveLoadingFrame } from "../../../components/ui/panelLoading";
import { Skeleton } from "../../../components/ui/Skeleton";
import { SystemSettingsSkeleton } from "../../../components/ui/panelSkeletons";
import {
  Alert,
  Badge,
  Button,
  Field,
  Input,
  SectionHeader,
  Select,
  Surface,
  Switch,
  Tabs,
  type TabItem,
  SegmentedControl,
} from "../../../design-system";
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
  type ContractConfigCategory,
  type LeadConfigCategory,
} from "./shared/systemSettingsConfig";
import { useConfigParam } from "../shared/useConfigTab";

export default function SystemSettingsScreen() {
  const { role } = useAuth();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [savedSettings, setSavedSettings] = useState<SystemSettings | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSection, setActiveSection] = useConfigParam(
    "section",
    ["general", "access", "leads", "contracts"] as const,
    "general",
  );
  const [activeLeadConfiguration, setActiveLeadConfiguration] = useConfigParam(
    "leadTab",
    ["status", "origins", "manager:lead_tipo_contratacao", "manager:lead_responsavel"] as const,
    "status",
  );
  const [activeContractConfiguration, setActiveContractConfiguration] = useConfigParam(
    "contractTab",
    ["contract_status", "contract_modalidade", "contract_abrangencia", "contract_acomodacao", "contract_carencia"] as const,
    "contract_status",
  );
  const { loading: configLoading, getRoleModulePermission, options } = useConfig();
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

  const loadSettings = async () => {
    setLoading(true);
    const data = await configService.getSystemSettings();
    setSettings(data);
    setSavedSettings(data);
    setLoading(false);
  };

  const showMessage = (type: "success" | "error", text: string) => {
    if (type === "success") {
      toast.success(text);
    } else {
      toast.error(text);
    }
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
      SECTION_OVERVIEW[2].searchTerms,
    ) ||
    showLeadStatusManager ||
    showLeadOriginsManager ||
    visibleLeadManagers.length > 0;

  const showContractsSection =
    matchesConfigSearch(
      normalizedSearchTerm,
      SECTION_OVERVIEW[3].searchTerms,
    ) || visibleContractManagers.length > 0;

  const visibleSections = SECTION_OVERVIEW.filter((section) => {
      switch (section.id) {
        case "general":
          return showGeneralSection;
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
  type LeadConfigurationTabId =
    | "status"
    | "origins"
    | `manager:${LeadConfigCategory}`;
  const leadConfigurationTabs: TabItem<LeadConfigurationTabId>[] = [
    ...(showLeadStatusManager ? [{ id: "status" as const, label: "Funil" }] : []),
    ...(showLeadOriginsManager ? [{ id: "origins" as const, label: "Origens" }] : []),
    ...visibleLeadManagers.map((manager) => ({
      id: `manager:${manager.category}` as const,
      label: manager.title,
    })),
  ];
  const activeLeadConfigurationId = leadConfigurationTabs.some(
    (tab) => tab.id === activeLeadConfiguration,
  )
    ? activeLeadConfiguration
    : leadConfigurationTabs[0]?.id ?? "status";
  const contractConfigurationTabs: TabItem<ContractConfigCategory>[] = visibleContractManagers.map((manager) => ({
    id: manager.category,
    label: manager.tabLabel ?? manager.title,
    icon: manager.tabIcon,
    badge: options[manager.category]?.length ?? 0,
  }));
  const activeContractConfigurationId = contractConfigurationTabs.some(
    (tab) => tab.id === activeContractConfiguration,
  )
    ? activeContractConfiguration
    : contractConfigurationTabs[0]?.id ?? activeContractConfiguration;

  if (loading && !settings) {
    return (
      <PanelAdaptiveLoadingFrame
        loading
        phase={loadingUi.phase}
        hasContent={false}
        skeleton={<SystemSettingsSkeleton />}
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
      overlayLabel="Atualizando configurações do sistema..."
      stageClassName="min-h-[440px]"
    >
      <div className="panel-page-shell space-y-6">
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
                placeholder="Buscar por permissões, leads ou contratos"
                leftIcon={Search}
              />
            </div>
          </div>
          {hasVisibleSections && (
            <SegmentedControl
              items={visibleSections.map(({ id, title, icon }) => ({
                id,
                label: title,
                icon,
              }))}
              value={activeVisibleSection ?? "general"}
              onChange={setActiveSection}
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
          <section id="settings-section-general" className="space-y-5">
            <SectionHeader
              eyebrow="Configuração do sistema"
              title="Preferências do sistema"
              description="Defina como datas, sessões e notificações se comportam no CRM."
              className="items-center"
              action={(
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <Button
                    onClick={handleRestoreGeneralDefaults}
                    variant="secondary"
                    size="md"
                  >
                    <RotateCcw className="kds-control-icon" />
                    Restaurar padrões
                  </Button>
                </div>
              )}
            />

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
              <Surface padding="md" className="xl:col-span-7">
                <div className="mb-5 flex items-start gap-3 border-b border-[var(--border-subtle)] pb-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--brand-primary-border)] bg-[var(--brand-primary-muted)] text-[var(--brand-primary)]">
                    <Globe2 className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">Localização e formato</h3>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      Escolha a forma de exibir datas e o horário de referência do sistema.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <Field label="Formato de data" hint="Usado nas datas exibidas no CRM.">
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

                  <Field
                    label="Fuso horário do sistema"
                    hint="Referência para follow-ups com IA e outras rotinas locais."
                  >
                    <Select
                      value={settings.timezone}
                      onChange={(event) =>
                        setSettings({ ...settings, timezone: event.target.value || "America/Sao_Paulo" })
                      }
                      options={timezoneOptions}
                    />
                  </Field>
                </div>
              </Surface>

              <Surface padding="md" className="xl:col-span-5">
                <div className="mb-5 flex items-start gap-3 border-b border-[var(--border-subtle)] pb-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface-muted)] text-[var(--text-secondary)]">
                    <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">Sessão e acesso</h3>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      Ajuste o período de sessão para este ambiente.
                    </p>
                  </div>
                </div>

                <Field
                  label="Tempo de sessão (minutos)"
                  hint="Padrão recomendado: 480 minutos (8 horas). Limite de 30 a 1.440 minutos."
                >
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
              </Surface>

              <Surface padding="md" className="xl:col-span-12">
                <div className="mb-5 flex items-start gap-3 border-b border-[var(--border-subtle)] pb-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--accent-gold-border)] bg-[var(--accent-gold-soft)] text-[var(--accent-gold-hover)]">
                    <BellRing className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-[var(--text-primary)]">Notificações</h3>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      Controle o som e a frequência de verificação.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--bg-surface-muted)] text-[var(--text-secondary)]">
                      {settings.notification_sound_enabled ? (
                        <Volume2 className="h-5 w-5" aria-hidden="true" />
                      ) : (
                        <VolumeX className="h-5 w-5" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p id="notification-sound-title" className="text-sm font-semibold text-[var(--text-primary)]">
                        Sons de notificação
                      </p>
                      <p id="notification-sound-description" className="mt-0.5 text-sm text-[var(--text-secondary)]">
                        Reproduzir um alerta sonoro quando houver notificações.
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.notification_sound_enabled}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        notification_sound_enabled: event.target.checked,
                      })
                    }
                    aria-labelledby="notification-sound-title"
                    aria-describedby="notification-sound-description"
                  />
                </div>

                <div className="mt-5 grid grid-cols-1 gap-5 border-t border-[var(--border-subtle)] pt-5 lg:grid-cols-2">
                  <Field
                    label={(
                      <span className="flex items-center justify-between gap-3">
                        <span>Volume das notificações</span>
                        <span className="text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
                          {Math.round(settings.notification_volume * 100)}%
                        </span>
                      </span>
                    )}
                    hint="Ajuste o volume do alerta sonoro; 0% é silencioso e 100% é o máximo."
                    disabled={!settings.notification_sound_enabled}
                  >
                    <Input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={settings.notification_volume}
                      disabled={!settings.notification_sound_enabled}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          notification_volume: Number.parseFloat(event.target.value),
                        })
                      }
                      className="cursor-pointer"
                    />
                  </Field>

                  <Field
                    label={(
                      <span className="inline-flex items-center gap-2">
                        <Clock className="h-4 w-4 text-[var(--text-secondary)]" aria-hidden="true" />
                        Intervalo de verificação (segundos)
                      </span>
                    )}
                    hint="Padrão recomendado: 30 segundos."
                  >
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
                  </Field>
                </div>
              </Surface>
            </div>

            <div className="flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <Badge tone={hasPendingGeneralChanges ? "gold" : "success"}>
                  {hasPendingGeneralChanges ? "Não salvo" : "Salvo"}
                </Badge>
                <p className="text-sm text-[var(--text-secondary)]">
                  {hasPendingGeneralChanges
                    ? "Salve para aplicar suas alterações."
                    : "Suas preferências estão atualizadas."}
                </p>
              </div>
              <Button
                onClick={handleSave}
                disabled={saving || !hasPendingGeneralChanges}
                aria-busy={saving}
                className="w-full sm:w-auto"
                size="md"
              >
                {saving ? (
                  <Loader2 className="kds-control-icon animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="kds-control-icon" aria-hidden="true" />
                )}
                {saving ? "Salvando..." : "Salvar preferências"}
              </Button>
            </div>
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
                        <SegmentedControl
                          items={leadConfigurationTabs}
                          value={activeLeadConfigurationId}
                          onChange={setActiveLeadConfiguration}
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
              description="Organize status, modalidade e condições disponíveis no cadastro de contratos."
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
                    <div className="space-y-4">
                      <Surface variant="muted" padding="sm" className="flex items-start gap-3">
                        <Info className="kds-control-icon mt-0.5 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
                        <p className="text-sm text-[var(--text-secondary)]">
                          As opções ativas aparecem nos seletores de contratos. Desative uma opção para ocultá-la sem removê-la desta lista.
                        </p>
                      </Surface>
                      <Tabs
                        items={contractConfigurationTabs}
                        value={activeContractConfigurationId}
                        onChange={setActiveContractConfiguration}
                        variant="rail"
                        ariaLabel="Categorias das configurações de contratos"
                        listClassName="flex-nowrap overflow-x-auto"
                        triggerClassName="shrink-0 whitespace-nowrap"
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
                            optionLabel={manager.optionLabel}
                            addLabel={manager.addLabel}
                            createDialogTitle={manager.createDialogTitle}
                            emptyStateTitle={manager.emptyStateTitle}
                            emptyStateDescription={manager.emptyStateDescription}
                          />
                        ) : null;
                      })()}
                    </div>
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
