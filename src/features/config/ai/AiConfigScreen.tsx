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
  AiFeatureCategory,
  AiGlobalConfigRow,
} from "./aiConfigTypes";
import { AI_FEATURE_CATEGORIES } from "./aiConfigTypes";
import FeatureEditorDrawer from "./components/FeatureEditorDrawer";
import FeatureListCard from "./components/FeatureListCard";
import GlobalConfigSection from "./components/GlobalConfigSection";

type Section = "features" | "global";

export default function AiConfigScreen() {
  const [features, setFeatures] = useState<AiFeatureWithConfig[]>([]);
  const [globalConfigs, setGlobalConfigs] = useState<AiGlobalConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>("features");
  const [editingFeature, setEditingFeature] = useState<AiFeatureWithConfig | null>(null);
  const [search, setSearch] = useState("");
  const [importConfirm, setImportConfirm] = useState<{ data: string; count: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [featResult, globalResult] = await Promise.all([
      aiConfigService.fetchFeaturesWithConfigs(),
      aiConfigService.fetchGlobalConfigs(),
    ]);

    if (featResult.error) toast.error(`Erro ao carregar features: ${featResult.error}`);
    if (globalResult.error) toast.error(`Erro ao carregar configs globais: ${globalResult.error}`);

    setFeatures(featResult.data ?? []);
    setGlobalConfigs(globalResult.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredFeatures = useMemo(() => {
    if (!search.trim()) return features;
    const q = search.toLowerCase();
    return features.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.key.toLowerCase().includes(q) ||
        (f.description ?? "").toLowerCase().includes(q),
    );
  }, [features, search]);

  const categories = useMemo(() => {
    const map = new Map<string, AiFeatureWithConfig[]>();
    for (const f of filteredFeatures) {
      const cat = f.category ?? "outros";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(f);
    }
    const result: AiFeatureCategory[] = [];
    for (const [cat, items] of map) {
      result.push({ label: AI_FEATURE_CATEGORIES[cat] ?? cat, features: items });
    }
    return result;
  }, [filteredFeatures]);

  const activeCount = features.filter((f) => f.active_config).length;
  const totalCount = features.length;

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

  const handleExport = useCallback(() => {
    const exportData = {
      version: 1,
      exported_at: new Date().toISOString(),
      features: features.map((f) => ({
        key: f.key,
        name: f.name,
        active_config: f.active_config
          ? {
              feature_prompt: f.active_config.feature_prompt,
              output_instructions: f.active_config.output_instructions,
              temperature: f.active_config.temperature,
              max_output_tokens: f.active_config.max_output_tokens,
            }
          : null,
      })),
      global_configs: globalConfigs.map((g) => ({ key: g.key, value: g.value })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Configurações exportadas");
  }, [features, globalConfigs]);

  const handleImportFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (!data.features || !Array.isArray(data.features)) {
          return toast.error("Formato de arquivo inválido");
        }
        const withConfig = data.features.filter((f: { active_config: unknown }) => f.active_config);
        setImportConfirm({ data: reader.result as string, count: withConfig.length });
      } catch {
        toast.error("Erro ao ler o arquivo");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  const handleImportConfirm = useCallback(async () => {
    if (!importConfirm) return;

    try {
      const data = JSON.parse(importConfirm.data);
      let imported = 0;

      for (const feat of data.features) {
        if (!feat.active_config) continue;
        const feature = features.find((f) => f.key === feat.key);
        if (!feature) continue;

        const { error } = await aiConfigService.createConfig(feature.id, {
          feature_prompt: feat.active_config.feature_prompt,
          output_instructions: feat.active_config.output_instructions,
          temperature: feat.active_config.temperature,
          max_output_tokens: feat.active_config.max_output_tokens,
        });
        if (!error) imported++;
      }

      for (const gc of data.global_configs ?? []) {
        await aiConfigService.updateGlobalConfig(gc.key, gc.value);
      }

      toast.success(`${imported} configurações importadas`);
      setImportConfirm(null);
      load();
    } catch {
      toast.error("Erro ao importar configurações");
    }
  }, [importConfirm, features, load]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Inteligência Artificial"
        title="Configurações de IA"
        description="Gerencie prompts, parâmetros e versões das features de IA do sistema."
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleExport} disabled={loading}>
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
          { id: "features", label: "Features", icon: Sparkles },
          { id: "global", label: "Configurações Globais", icon: Settings },
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
              placeholder="Buscar feature..."
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
                Nenhuma feature encontrada.
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
        description={`Serão criadas ${importConfirm?.count ?? 0} novas versões de configurações a partir do arquivo importado. As versões atuais serão desativadas.`}
        confirmLabel="Importar"
        closeOnConfirm
      />
    </div>
  );
}
