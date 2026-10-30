import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Brain,
  Download,
  RefreshCw,
  Upload,
} from "lucide-react";

import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  FileInput,
  PageActions,
  SearchInput,
  SectionHeader,
  Skeleton,
  Tabs,
  Text,
} from "../../../design-system";
import { toast } from "../../../lib/toast";
import { aiConfigService } from "./aiConfigService";
import type {
  AiFeatureKey,
  AiFeatureWithConfig,
  AiGlobalConfigRow,
  AiModelResolutionSource,
  AiProviderSlug,
  AiReasoningEffort,
} from "./aiConfigTypes";
import { AI_FEATURE_AI_TASK, AI_FEATURE_CATEGORIES, AI_PROVIDER_OPTIONS } from "./aiConfigTypes";
import {
  buildAiConfigExportV3,
  createAiConfigImportPlan,
  type AiConfigImportPlan,
} from "./aiConfigTransfer";
import {
  buildAiFeatureCategories,
  getAiFeatureDisplayState,
} from "./aiFeatureState";
import FeatureEditorDrawer from "./components/FeatureEditorDrawer";
import FeatureListCard from "./components/FeatureListCard";
import GlobalConfigSection from "./components/GlobalConfigSection";
import { useConfigParam } from "../shared/useConfigTab";

export default function AiConfigScreen() {
  const [features, setFeatures] = useState<AiFeatureWithConfig[]>([]);
  const [globalConfigs, setGlobalConfigs] = useState<AiGlobalConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailures, setLoadFailures] = useState({ features: false, global: false });
  const [section, setSection] = useConfigParam(
    "section",
    ["features", "global"] as const,
    "features",
  );
  const [editingFeature, setEditingFeature] = useState<AiFeatureWithConfig | null>(null);
  const [search, setSearch] = useState("");
  const [importConfirm, setImportConfirm] = useState<AiConfigImportPlan | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailures({ features: false, global: false });
    try {
      const [featResult, globalResult] = await Promise.all([
        aiConfigService.fetchFeaturesWithConfigs(),
        aiConfigService.fetchGlobalConfigs(),
      ]);

      setLoadFailures({ features: Boolean(featResult.error), global: Boolean(globalResult.error) });
      if (featResult.error) toast.error("Não foi possível carregar as funcionalidades.");
      if (globalResult.error) toast.error("Não foi possível carregar as configurações globais.");

      setFeatures(featResult.data ?? []);
      setGlobalConfigs(globalResult.data ?? []);
    } catch (error) {
      console.error("Erro ao carregar configurações de IA:", error);
      setFeatures([]);
      setGlobalConfigs([]);
      setLoadFailures({ features: true, global: true });
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar as configurações de IA.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredFeatures = useMemo(() => {
    let result = features;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.key.toLowerCase().includes(q) ||
          (f.description ?? "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [features, search]);

  const categories = useMemo(() => {
    return buildAiFeatureCategories(filteredFeatures, AI_FEATURE_CATEGORIES);
  }, [filteredFeatures]);

  const customModelCount = features.filter(
    (feature) => feature.enabled !== false && feature.active_config?.model_override_enabled,
  ).length;
  const summarizeFeatureGroup = (keys: ReadonlySet<AiFeatureKey>) => {
    const matchingFeatures = features.filter((feature) => feature.enabled !== false && keys.has(feature.key));
    const activeFeatures = matchingFeatures.filter((feature) => getAiFeatureDisplayState(feature) === "active").length;

    if (matchingFeatures.length === 0) return { value: "Não configurada", tone: "neutral" as const };
    if (activeFeatures === 0) return { value: "Inativa", tone: "neutral" as const };
    if (activeFeatures < matchingFeatures.length) return { value: "Parcial", tone: "warning" as const };
    return { value: "Ativa", tone: "success" as const };
  };
  const messagingStatus = summarizeFeatureGroup(new Set(["message.rewrite", "message.suggest"]));
  const leadQualificationStatus = summarizeFeatureGroup(new Set([
    "campaign.intent",
    "followup.analysis",
    "followup.generate",
    "followup.refine",
  ]));
  const summaryRows: Array<{
    label: string;
    description: string;
    value: string;
    tone: "danger" | "success" | "warning" | "neutral";
  }> = [
    {
      label: "Assistência em mensagens",
      description: "Sugestões e reescrita de atendimento.",
      value: loading ? "Consultando" : loadFailures.features ? "Indisponível" : messagingStatus.value,
      tone: loadFailures.features ? "danger" : messagingStatus.tone,
    },
    {
      label: "Qualificação de leads",
      description: "Contexto para acompanhamento comercial.",
      value: loading ? "Consultando" : loadFailures.features ? "Indisponível" : leadQualificationStatus.value,
      tone: loadFailures.features ? "danger" : leadQualificationStatus.tone,
    },
    {
      label: "Modelos de execução",
      description: "Configuração de modelo por funcionalidade.",
      value: loading ? "Consultando" : loadFailures.features ? "Indisponível" : customModelCount ? `${customModelCount} personalizados` : "Roteamento padrão",
      tone: loadFailures.features ? "danger" : "neutral",
    },
  ];

  const handleDeactivate = useCallback(async (configId: string) => {
    const { error } = await aiConfigService.deactivateConfig(configId);
    if (error) return toast.error(error);
    toast.success("Configuração desativada");
    load();
  }, [load]);

  const handleActivate = useCallback(async (configId: string) => {
    const { error } = await aiConfigService.activateConfig(configId);
    if (error) return toast.error(error);
    toast.success("Configuração ativada");
    load();
  }, [load]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const operationalFeatures = features.filter((feature) => feature.enabled !== false && feature.active_config);
      const [catalogResult, routingResult, providerResults, effectiveResults] = await Promise.all([
        aiConfigService.fetchModelCatalog(),
        aiConfigService.fetchRoutingSettings(),
        Promise.all(AI_PROVIDER_OPTIONS.map(async ({ value: provider }) => ({
          provider,
          result: await aiConfigService.fetchProviderModels(provider),
        }))),
        Promise.all(operationalFeatures.map(async (feature) => ({
          key: feature.key,
          result: await aiConfigService.fetchEffectiveModel(feature.key, AI_FEATURE_AI_TASK[feature.key]),
        }))),
      ]);

      if (catalogResult.error || !catalogResult.data) {
        throw new Error(catalogResult.error ?? "Não foi possível carregar o catálogo de modelos.");
      }

      const selectableByProvider: Record<AiProviderSlug, Array<{
        value: string;
        label: string;
        reasoningEfforts?: AiReasoningEffort[];
      }>> = {
        openai: [],
      };
      for (const { provider, result } of providerResults) {
        selectableByProvider[provider] = result.data ?? [];
      }
      const effectiveModels = new Map(effectiveResults.flatMap(({ key, result }) => (
        result.data
          ? [[key, {
              provider: result.data.provider,
              model: result.data.model,
              source: result.data.source as AiModelResolutionSource,
            }] as const]
          : []
      )));

      const exportData = buildAiConfigExportV3({
        features,
        globalConfigs,
        effectiveModels,
        selectableByProvider,
        modelCatalog: catalogResult.data,
        routingSettings: routingResult.data,
      });

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `ai-config-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);

      const unavailableProviders = providerResults.filter(({ result }) => result.error).length;
      if (unavailableProviders > 0) {
        toast.warning(`Arquivo exportado. Não foi possível consultar os dados atuais de ${unavailableProviders} fornecedor(es) de IA.`);
      } else {
        toast.success("Configurações exportadas");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível exportar as configurações.");
    } finally {
      setExporting(false);
    }
  }, [features, globalConfigs]);

  const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("O arquivo excede o limite de 5 MB.");
      }
      const [contents, catalogResult] = await Promise.all([
        file.text(),
        aiConfigService.fetchModelCatalog(),
      ]);
      if (catalogResult.error || !catalogResult.data) {
        throw new Error(catalogResult.error ?? "Não foi possível validar o catálogo atual.");
      }
      setImportConfirm(createAiConfigImportPlan(JSON.parse(contents), features, catalogResult.data));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível ler o arquivo.");
    }
  }, [features]);

  const handleImportConfirm = useCallback(async () => {
    if (!importConfirm) return;

    setImporting(true);
    try {
      let imported = 0;
      const failures: string[] = [];

      for (const featurePlan of importConfirm.features) {
        const { error } = await aiConfigService.createConfig(featurePlan.featureId, featurePlan.payload);
        if (error) failures.push(`${featurePlan.name}: ${error}`);
        else imported++;
      }

      for (const gc of importConfirm.globalConfigs) {
        const { error } = await aiConfigService.updateGlobalConfig(gc.key, gc.value);
        if (error) failures.push(`Configuração global ${gc.key}: ${error}`);
      }

      if (failures.length > 0) {
        toast.error(`${imported} importadas; ${failures.length} falharam. ${failures[0]}`);
      } else if (importConfirm.warnings.length > 0) {
        toast.warning(`${imported} configurações importadas com ${importConfirm.warnings.length} aviso(s).`);
      } else {
        toast.success(`${imported} configurações importadas`);
      }
      setImportConfirm(null);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível importar as configurações.");
    } finally {
      setImporting(false);
    }
  }, [importConfirm, load]);

  return (
    <div className="kds-ai-config-page">
      <Card padding="md" className="kds-ai-config-overview">
        <SectionHeader
          className="kds-ai-overview-header"
          title="Inteligência artificial"
          description="Controle central de recursos e políticas."
          descriptionPlacement="visible"
          action={
            <>
              <PageActions
                secondary={[
                  {
                    label: "Exportar",
                    icon: Download,
                    onClick: handleExport,
                    disabled: loading || exporting,
                    loading: exporting,
                  },
                  {
                    label: "Importar",
                    icon: Upload,
                    onClick: () => fileInputRef.current?.click(),
                    disabled: loading || importing,
                  },
                  {
                    label: "Atualizar",
                    icon: RefreshCw,
                    onClick: load,
                    disabled: loading,
                    loading,
                  },
                ]}
              />
              <FileInput
                ref={fileInputRef}
                accept=".json"
                className="hidden"
                onChange={handleImportFile}
              />
            </>
          }
        />

        <Alert tone="warning">
          Recursos de IA devem ter permissões e limites operacionais claros.
        </Alert>

        <div className="kds-ai-summary-list" role="list" aria-label="Resumo das configurações de IA">
          {summaryRows.map((item) => (
            <div className="kds-ai-summary-row" role="listitem" key={item.label}>
              <div className="min-w-0">
                <Text className="kds-ai-summary-label">{item.label}</Text>
                <Text className="kds-ai-summary-description">{item.description}</Text>
              </div>
              <Badge tone={item.tone} size="sm">{item.value}</Badge>
            </div>
          ))}
        </div>
      </Card>

      <Tabs
        items={[
          { id: "features", label: "Funcionalidades" },
          { id: "global", label: "Configurações globais" },
        ]}
        value={section}
        onChange={setSection}
        size="sm"
        ariaLabel="Áreas das configurações de IA"
      />

      {section === "features" && (
        <Card padding="none" className="kds-ai-options-card">
          <div className="kds-ai-options-header">
            <SectionHeader
              className="kds-ai-options-section-header"
              as="h3"
              title="Opções de IA"
              description="Ative recursos e mantenha os prompts organizados por área."
              descriptionPlacement="visible"
              action={
                <SearchInput
                  placeholder="Buscar funcionalidade..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Buscar funcionalidade de IA"
                  className="kds-ai-search"
                />
              }
            />
          </div>

          {loading ? (
            <div className="kds-ai-feature-loading" aria-label="Carregando funcionalidades de IA" aria-busy="true">
              {Array.from({ length: 4 }, (_, index) => (
                <div className="kds-ai-feature-loading-row" key={index}>
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton variant="line" className="h-4 w-48 max-w-full" />
                    <Skeleton variant="line" className="h-3 w-72 max-w-full" />
                  </div>
                  <Skeleton className="h-9 w-24" />
                </div>
              ))}
            </div>
          ) : loadFailures.features ? (
            <EmptyState
              icon={<Brain />}
              title="Não foi possível carregar as funcionalidades"
              description="Tente atualizar a lista. Nenhuma configuração foi alterada."
              action={<Button variant="secondary" onClick={load}>Tentar novamente</Button>}
              className="kds-ai-config-empty"
            />
          ) : categories.length > 0 ? (
            <div className="kds-ai-categories">
              {categories.map((cat) => (
                <FeatureListCard
                  key={cat.label}
                  category={cat}
                  onEdit={setEditingFeature}
                  onDeactivate={handleDeactivate}
                  onActivate={handleActivate}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Brain />}
              title={search.trim() ? "Nenhuma funcionalidade corresponde à busca" : "Nenhuma funcionalidade disponível"}
              description={search.trim() ? "Revise o termo digitado ou limpe a busca para ver todos os recursos." : "As funcionalidades de IA disponíveis aparecerão aqui."}
              className="kds-ai-config-empty"
            />
          )}
        </Card>
      )}

      {section === "global" && (
        loading ? (
          <Card padding="md" className="kds-ai-global-loading" aria-busy="true" aria-label="Carregando configurações globais">
            <Skeleton variant="line" className="h-5 w-52" />
            <Skeleton className="h-28 w-full" />
            <Skeleton variant="line" className="ml-auto h-9 w-28" />
          </Card>
        ) : loadFailures.global ? (
          <Card padding="md">
            <EmptyState
              icon={<Brain />}
              title="Não foi possível carregar as configurações globais"
              description="Tente atualizar os dados antes de editar ou salvar instruções."
              action={<Button variant="secondary" onClick={load}>Tentar novamente</Button>}
              className="kds-ai-config-empty"
            />
          </Card>
        ) : (
          <GlobalConfigSection configs={globalConfigs} onReload={load} />
        )
      )}

      {editingFeature && (
        <FeatureEditorDrawer
          feature={editingFeature}
          onClose={() => setEditingFeature(null)}
          onSaved={() => { setEditingFeature(null); load(); }}
        />
      )}

      <ConfirmDialog
        open={!!importConfirm}
        onOpenChange={() => setImportConfirm(null)}
        onConfirm={handleImportConfirm}
        title="Importar configurações?"
        description={`Export v${importConfirm?.version ?? 1}: serão criadas ${importConfirm?.features.length ?? 0} novas versões. As versões atuais dessas Features serão desativadas.`}
        confirmLabel="Importar"
        loading={importing}
        closeOnConfirm
      >
        {importConfirm && (
          <div className="max-h-80 space-y-4 overflow-y-auto text-sm">
            <div className="rounded-lg border border-[var(--border-subtle)] p-3 text-[var(--text-secondary)]">
              <Text>{importConfirm.features.length} Feature(s) e {importConfirm.globalConfigs.length} configuração(ões) global(is) prontas para importar.</Text>
              {importConfirm.skippedFeatures > 0 && (
                <Text className="mt-1">{importConfirm.skippedFeatures} Feature(s) sem configuração aplicável serão ignoradas.</Text>
              )}
              <Text className="mt-1 text-xs text-[var(--text-muted)]">
                Exemplos, catálogo de modelos e snapshots de roteamento do arquivo são somente informativos e nunca são aplicados.
              </Text>
            </div>
            <div>
              <Text className="font-medium text-[var(--text-primary)]">Modelos personalizados</Text>
              <ul className="mt-1 space-y-1 text-[var(--text-secondary)]">
                {importConfirm.features.filter((feature) => feature.modelMode === "custom").map((feature) => (
                  <li key={feature.key}>{feature.name} → {feature.modelLabel}</li>
                ))}
                {!importConfirm.features.some((feature) => feature.modelMode === "custom") && <li>Nenhum</li>}
              </ul>
            </div>
            <div>
              <Text className="font-medium text-[var(--text-primary)]">Roteamento padrão</Text>
              <ul className="mt-1 space-y-1 text-[var(--text-secondary)]">
                {importConfirm.features.filter((feature) => feature.modelMode !== "custom").map((feature) => (
                  <li key={feature.key}>
                    {feature.name}{feature.modelMode === "legacy" ? " · export v1" : ""}
                  </li>
                ))}
              </ul>
            </div>
            {importConfirm.warnings.length > 0 && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--warning-border)] bg-[var(--warning-soft)] p-3">
                <Text className="font-medium text-[var(--warning-text)]">Avisos</Text>
                <ul className="mt-1 space-y-1 text-xs text-[var(--text-secondary)]">
                  {importConfirm.warnings.map((warning) => <li key={warning}>• {warning}</li>)}
                </ul>
                <Text className="mt-2 text-xs text-[var(--text-muted)]">
                  O valor importado será preservado; nenhum modelo alternativo será escolhido silenciosamente.
                </Text>
              </div>
            )}
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
