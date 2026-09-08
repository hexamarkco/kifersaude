import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Brain,
  Download,
  RefreshCw,
  Settings,
  Sparkles,
  Upload,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Input,
  SectionHeader,
  Tabs,
} from "../../../design-system";
import { toast } from "../../../lib/toast";
import { aiConfigService } from "./aiConfigService";
import type {
  AiFeatureWithConfig,
  AiGlobalConfigRow,
  AiModelResolutionSource,
  AiProviderSlug,
  AiReasoningEffort,
} from "./aiConfigTypes";
import { AI_FEATURE_AI_TASK, AI_FEATURE_CATEGORIES, AI_PROVIDER_OPTIONS } from "./aiConfigTypes";
import {
  buildAiConfigExportV2,
  createAiConfigImportPlan,
  type AiConfigImportPlan,
} from "./aiConfigTransfer";
import {
  buildAiFeatureCategories,
  countActiveAiFeatures,
  countOperationalAiFeatures,
} from "./aiFeatureState";
import FeatureEditorDrawer from "./components/FeatureEditorDrawer";
import FeatureListCard from "./components/FeatureListCard";
import GlobalConfigSection from "./components/GlobalConfigSection";
import { useConfigParam } from "../shared/useConfigTab";

export default function AiConfigScreen() {
  const [features, setFeatures] = useState<AiFeatureWithConfig[]>([]);
  const [globalConfigs, setGlobalConfigs] = useState<AiGlobalConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
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
    const [featResult, globalResult] = await Promise.all([
      aiConfigService.fetchFeaturesWithConfigs(),
      aiConfigService.fetchGlobalConfigs(),
    ]);

    if (featResult.error) toast.error("Não foi possível carregar as funcionalidades.");
    if (globalResult.error) toast.error("Não foi possível carregar as configurações globais.");

    setFeatures(featResult.data ?? []);
    setGlobalConfigs(globalResult.data ?? []);
    setLoading(false);
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

  const activeCount = countActiveAiFeatures(features);
  const totalCount = countOperationalAiFeatures(features);

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
        gemini: [],
        claude: [],
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

      const exportData = buildAiConfigExportV2({
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
        toast.warning(`Export concluído; ${unavailableProviders} provider(s) não responderam ao snapshot em tempo real.`);
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
        await aiConfigService.updateGlobalConfig(gc.key, gc.value);
      }

      if (failures.length > 0) {
        toast.error(`${imported} importadas; ${failures.length} falharam. ${failures[0]}`);
      } else if (importConfirm.warnings.length > 0) {
        toast.warning(`${imported} configurações importadas com ${importConfirm.warnings.length} aviso(s) de modelo.`);
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
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Inteligência Artificial"
        title="Configurações de IA"
        description="Gerencie prompts, parâmetros e versões das funcionalidades de IA do sistema."
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleExport} disabled={loading || exporting} loading={exporting}>
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={loading}>
              <Upload className="h-4 w-4" />
              Importar
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportFile}
            />
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      />

      <Tabs
        items={[
          { id: "features", label: "Funcionalidades", icon: Sparkles },
          { id: "global", label: "Configurações globais", icon: Settings },
        ]}
        value={section}
        onChange={setSection}
        variant="pill"
        listClassName="flex-nowrap overflow-x-auto"
      />

      {section === "features" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Input
              placeholder="Buscar funcionalidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Badge tone="gold">
              {activeCount}/{totalCount} ativas
            </Badge>
          </div>

          {categories.map((cat) => (
            <FeatureListCard
              key={cat.label}
              category={cat}
              onEdit={setEditingFeature}
              onDeactivate={handleDeactivate}
              onActivate={handleActivate}
            />
          ))}

          {filteredFeatures.length === 0 && !loading && (
            <Card className="p-8 text-center">
              <Brain className="mx-auto mb-3 h-10 w-10 text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-secondary)]">
                Nenhuma funcionalidade encontrada.
              </p>
            </Card>
          )}
        </div>
      )}

      {section === "global" && (
        <GlobalConfigSection
          configs={globalConfigs}
          onReload={load}
        />
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
        description={`Export v${importConfirm?.version ?? 1}: serão criadas ${importConfirm?.features.length ?? 0} novas versões. As versões atuais serão desativadas.`}
        confirmLabel="Importar"
        loading={importing}
        closeOnConfirm
      >
        {importConfirm && (
          <div className="max-h-80 space-y-4 overflow-y-auto text-sm">
            <div>
              <p className="font-medium text-[var(--text-primary)]">Modelos personalizados</p>
              <ul className="mt-1 space-y-1 text-[var(--text-secondary)]">
                {importConfirm.features.filter((feature) => feature.modelMode === "custom").map((feature) => (
                  <li key={feature.key}>{feature.name} → {feature.modelLabel}</li>
                ))}
                {!importConfirm.features.some((feature) => feature.modelMode === "custom") && <li>Nenhum</li>}
              </ul>
            </div>
            <div>
              <p className="font-medium text-[var(--text-primary)]">Roteamento padrão</p>
              <ul className="mt-1 space-y-1 text-[var(--text-secondary)]">
                {importConfirm.features.filter((feature) => feature.modelMode !== "custom").map((feature) => (
                  <li key={feature.key}>
                    {feature.name}{feature.modelMode === "legacy" ? " · export v1" : ""}
                  </li>
                ))}
              </ul>
            </div>
            {importConfirm.warnings.length > 0 && (
              <div className="rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 p-3">
                <p className="font-medium text-[var(--color-warning)]">Warnings</p>
                <ul className="mt-1 space-y-1 text-xs text-[var(--text-secondary)]">
                  {importConfirm.warnings.map((warning) => <li key={warning}>• {warning}</li>)}
                </ul>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  O valor importado será preservado; nenhum modelo alternativo será escolhido silenciosamente.
                </p>
              </div>
            )}
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
