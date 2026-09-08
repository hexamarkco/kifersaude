import type {
  AiFeatureWithConfig,
  AiGlobalConfigRow,
  AiModelCatalogCapability,
  AiModelCatalogWithPricing,
  AiModelResolutionSource,
  AiProviderSlug,
} from "./aiConfigTypes";
import { TASK_TYPE_REQUIRED_CAPABILITIES } from "./aiConfigTypes";

export type AiExportModelConfig = {
  mode: "custom" | "default";
  model_override_enabled: boolean;
  provider: AiProviderSlug | null;
  model: string | null;
  effective_provider: string | null;
  effective_model: string | null;
  resolution_source: AiModelResolutionSource | null;
};

export type AiExportFeature = {
  key: string;
  name: string;
  active_config: {
    feature_prompt: string;
    output_instructions: string;
    temperature: number;
    max_output_tokens: number;
    model_config: AiExportModelConfig;
  } | null;
};

export type AiModelCatalogSnapshotEntry = {
  model: string;
  display_name: string;
  capabilities: AiModelCatalogCapability[];
  active: boolean;
  deprecated: boolean;
  pricing_available: boolean;
};

export type AiConfigExportV2 = {
  version: 2;
  exported_at: string;
  features: AiExportFeature[];
  global_configs: Array<{ key: string; value: string }>;
  model_catalog_snapshot: {
    generated_at: string;
    providers: Record<AiProviderSlug, AiModelCatalogSnapshotEntry[]>;
  };
  routing_snapshot: Record<string, { provider: string; model: string }>;
};

export type AiImportFeaturePlan = {
  key: string;
  name: string;
  featureId: string;
  taskType: AiFeatureWithConfig["task_type"];
  payload: {
    feature_prompt: string;
    output_instructions: string;
    temperature: number;
    max_output_tokens: number;
    provider?: AiProviderSlug;
    model?: string;
    model_override_enabled?: boolean;
  };
  modelMode: "custom" | "default" | "legacy";
  modelLabel: string | null;
  warnings: string[];
};

export type AiConfigImportPlan = {
  version: 1 | 2;
  features: AiImportFeaturePlan[];
  globalConfigs: Array<{ key: string; value: string }>;
  warnings: string[];
};

type EffectiveModelSnapshot = {
  provider: string;
  model: string;
  source: AiModelResolutionSource;
};

type SelectableModel = { value: string; label: string };

const PROVIDERS: AiProviderSlug[] = ["openai", "gemini", "claude"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isProvider = (value: unknown): value is AiProviderSlug =>
  value === "openai" || value === "gemini" || value === "claude";

const readFiniteNumber = (value: unknown, field: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Campo ${field} inválido.`);
  }
  return value;
};

export const buildModelCatalogSnapshot = (
  selectableByProvider: Record<AiProviderSlug, SelectableModel[]>,
  catalog: AiModelCatalogWithPricing[],
): Record<AiProviderSlug, AiModelCatalogSnapshotEntry[]> => {
  const metadata = new Map(catalog.map((item) => [`${item.provider}:${item.model}`, item]));

  return Object.fromEntries(PROVIDERS.map((provider) => [
    provider,
    selectableByProvider[provider].map((option) => {
      const item = metadata.get(`${provider}:${option.value}`);
      return {
        model: option.value,
        display_name: item?.display_name ?? option.label,
        capabilities: item?.capabilities ?? [],
        active: item?.active ?? true,
        deprecated: item?.deprecated_at != null,
        pricing_available: item?.has_pricing ?? false,
      };
    }),
  ])) as Record<AiProviderSlug, AiModelCatalogSnapshotEntry[]>;
};

export const buildRoutingSnapshot = (
  settings: Record<string, unknown> | null,
): Record<string, { provider: string; model: string }> => {
  const tasks = isRecord(settings?.tasks) ? settings.tasks : {};
  const result: Record<string, { provider: string; model: string }> = {};

  for (const [task, rawRoute] of Object.entries(tasks)) {
    if (!isRecord(rawRoute)) continue;
    const provider = typeof rawRoute.provider === "string" ? rawRoute.provider.trim() : "";
    const model = typeof rawRoute.model === "string" ? rawRoute.model.trim() : "";
    if (provider && model) result[task] = { provider, model };
  }

  return result;
};

export const buildAiConfigExportV2 = (params: {
  features: AiFeatureWithConfig[];
  globalConfigs: AiGlobalConfigRow[];
  effectiveModels: Map<string, EffectiveModelSnapshot>;
  selectableByProvider: Record<AiProviderSlug, SelectableModel[]>;
  modelCatalog: AiModelCatalogWithPricing[];
  routingSettings: Record<string, unknown> | null;
  exportedAt?: string;
}): AiConfigExportV2 => {
  const exportedAt = params.exportedAt ?? new Date().toISOString();

  return {
    version: 2,
    exported_at: exportedAt,
    features: params.features.map((feature) => {
      const activeConfig = feature.active_config;
      if (!activeConfig) return { key: feature.key, name: feature.name, active_config: null };

      const effective = params.effectiveModels.get(feature.key);
      const custom = activeConfig.model_override_enabled === true;
      return {
        key: feature.key,
        name: feature.name,
        active_config: {
          feature_prompt: activeConfig.feature_prompt,
          output_instructions: activeConfig.output_instructions,
          temperature: activeConfig.temperature,
          max_output_tokens: activeConfig.max_output_tokens,
          model_config: {
            mode: custom ? "custom" : "default",
            model_override_enabled: custom,
            provider: custom ? activeConfig.provider : null,
            model: custom ? activeConfig.model : null,
            effective_provider: effective?.provider ?? null,
            effective_model: effective?.model ?? null,
            resolution_source: effective?.source ?? null,
          },
        },
      };
    }),
    global_configs: params.globalConfigs.map(({ key, value }) => ({ key, value })),
    model_catalog_snapshot: {
      generated_at: exportedAt,
      providers: buildModelCatalogSnapshot(params.selectableByProvider, params.modelCatalog),
    },
    routing_snapshot: buildRoutingSnapshot(params.routingSettings),
  };
};

const validateImportedOverride = (
  feature: AiFeatureWithConfig,
  provider: AiProviderSlug,
  model: string,
  catalog: AiModelCatalogWithPricing[],
): string[] => {
  const item = catalog.find((candidate) => candidate.provider === provider && candidate.model === model);
  if (!item) return [`${feature.name}: modelo ${provider}/${model} não existe no catálogo atual.`];

  const warnings: string[] = [];
  if (!item.active) warnings.push(`${feature.name}: modelo ${provider}/${model} está inativo.`);
  if (item.deprecated_at) warnings.push(`${feature.name}: modelo ${provider}/${model} está deprecated.`);

  const required = TASK_TYPE_REQUIRED_CAPABILITIES[feature.task_type] ?? ["text"];
  const missing = required.filter((capability) => !item.capabilities.includes(capability));
  if (missing.length > 0) {
    warnings.push(`${feature.name}: modelo ${provider}/${model} é incompatível com ${feature.task_type} (${missing.join(", ")} ausente).`);
  }
  return warnings;
};

export const createAiConfigImportPlan = (
  rawData: unknown,
  currentFeatures: AiFeatureWithConfig[],
  currentCatalog: AiModelCatalogWithPricing[],
): AiConfigImportPlan => {
  if (!isRecord(rawData) || !Array.isArray(rawData.features)) {
    throw new Error("Formato de arquivo inválido.");
  }

  if (rawData.version !== undefined && rawData.version !== 1 && rawData.version !== 2) {
    throw new Error(`Versão de export não suportada: ${String(rawData.version)}.`);
  }

  const version = rawData.version === 2 ? 2 : 1;
  const features: AiImportFeaturePlan[] = [];
  const warnings: string[] = [];

  for (const rawFeature of rawData.features) {
    if (!isRecord(rawFeature) || typeof rawFeature.key !== "string" || !isRecord(rawFeature.active_config)) continue;
    const feature = currentFeatures.find((candidate) => candidate.key === rawFeature.key);
    if (!feature) {
      warnings.push(`Feature desconhecida ignorada: ${rawFeature.key}.`);
      continue;
    }
    if (feature.enabled === false) {
      warnings.push(`${feature.name}: Feature legada/desativada não será importada.`);
      continue;
    }

    const rawConfig = rawFeature.active_config;
    if (typeof rawConfig.feature_prompt !== "string" || typeof rawConfig.output_instructions !== "string") {
      throw new Error(`Configuração inválida para ${feature.name}.`);
    }

    const payload: AiImportFeaturePlan["payload"] = {
      feature_prompt: rawConfig.feature_prompt,
      output_instructions: rawConfig.output_instructions,
      temperature: readFiniteNumber(rawConfig.temperature, `${feature.key}.temperature`),
      max_output_tokens: readFiniteNumber(rawConfig.max_output_tokens, `${feature.key}.max_output_tokens`),
    };
    let modelMode: AiImportFeaturePlan["modelMode"] = "legacy";
    let modelLabel: string | null = null;
    const featureWarnings: string[] = [];

    if (version === 2 && isRecord(rawConfig.model_config)) {
      const rawModelConfig = rawConfig.model_config;
      if (rawModelConfig.model_override_enabled === true) {
        const provider = rawModelConfig.provider;
        const model = typeof rawModelConfig.model === "string" ? rawModelConfig.model.trim() : "";
        if (!isProvider(provider) || !model) {
          throw new Error(`${feature.name}: override personalizado sem provider/model válido.`);
        }
        payload.model_override_enabled = true;
        payload.provider = provider;
        payload.model = model;
        modelMode = "custom";
        modelLabel = `${provider} / ${model}`;
        featureWarnings.push(...validateImportedOverride(feature, provider, model, currentCatalog));
      } else {
        payload.model_override_enabled = false;
        modelMode = "default";
      }
    }

    warnings.push(...featureWarnings);
    features.push({
      key: feature.key,
      name: feature.name,
      featureId: feature.id,
      taskType: feature.task_type,
      payload,
      modelMode,
      modelLabel,
      warnings: featureWarnings,
    });
  }

  const globalConfigs = Array.isArray(rawData.global_configs)
    ? rawData.global_configs.flatMap((item) => (
      isRecord(item) && typeof item.key === "string" && typeof item.value === "string"
        ? [{ key: item.key, value: item.value }]
        : []
    ))
    : [];

  return { version, features, globalConfigs, warnings };
};
