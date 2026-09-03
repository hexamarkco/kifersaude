import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Brain,
  RefreshCw,
  Settings,
  Sparkles,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
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

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Inteligência Artificial"
        title="Configurações de IA"
        description="Gerencie prompts, parâmetros e versões das features de IA do sistema."
        action={
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
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
    </div>
  );
}
