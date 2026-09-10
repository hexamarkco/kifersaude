import type {
  AiFeatureWithConfig,
  AiGlobalConfigRow,
  AiModelCatalogCapability,
  AiModelCatalogWithPricing,
  AiModelResolutionSource,
  AiProviderSlug,
  AiReasoningEffort,
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
    reasoning_effort: AiReasoningEffort | null;
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
  reasoning_efforts: AiReasoningEffort[];
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

export type AiConfigExample = {
  id: string;
  title: string;
  description: string;
  importable: false;
  example: {
    key: string;
    active_config: AiExportFeature["active_config"];
  };
};

export type AiConfigExportV3 = Omit<AiConfigExportV2, "version"> & {
  version: 3;
  format: "kifer-saude-ai-config";
  documentation: {
    description: string;
    import_behavior: string[];
    field_notes: Record<string, string>;
  };
  configuration_examples: AiConfigExample[];
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
    reasoning_effort?: AiReasoningEffort | null;
    provider?: AiProviderSlug;
    model?: string;
    model_override_enabled?: boolean;
  };
  modelMode: "custom" | "default" | "legacy";
  modelLabel: string | null;
  warnings: string[];
};

export type AiConfigImportPlan = {
  version: 1 | 2 | 3;
  features: AiImportFeaturePlan[];
  globalConfigs: Array<{ key: string; value: string }>;
  warnings: string[];
  skippedFeatures: number;
};

type EffectiveModelSnapshot = {
  provider: string;
  model: string;
  source: AiModelResolutionSource;
};

type SelectableModel = {
  value: string;
  label: string;
  reasoningEfforts?: AiReasoningEffort[];
};

type BuildAiConfigExportParams = {
  features: AiFeatureWithConfig[];
  globalConfigs: AiGlobalConfigRow[];
  effectiveModels: Map<string, EffectiveModelSnapshot>;
  selectableByProvider: Record<AiProviderSlug, SelectableModel[]>;
  modelCatalog: AiModelCatalogWithPricing[];
  routingSettings: Record<string, unknown> | null;
  exportedAt?: string;
};

const PROVIDERS: AiProviderSlug[] = ["openai"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isProvider = (value: unknown): value is AiProviderSlug =>
  value === "openai";

const isReasoningEffort = (value: unknown): value is AiReasoningEffort =>
  value === "none" || value === "minimal" || value === "low" || value === "medium" ||
  value === "high" || value === "xhigh" || value === "max";

const readFiniteNumber = (value: unknown, field: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Campo ${field} inválido.`);
  }
  return value;
};

const readBoundedNumber = (
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
  integer = false,
): number => {
  const parsed = readFiniteNumber(value, field);
  if (parsed < minimum || parsed > maximum || (integer && !Number.isInteger(parsed))) {
    throw new Error(`Campo ${field} deve estar entre ${minimum} e ${maximum}${integer ? " e ser inteiro" : ""}.`);
  }
  return parsed;
};

const readBoundedString = (value: unknown, field: string, maximumLength: number): string => {
  if (typeof value !== "string") throw new Error(`Campo ${field} inválido.`);
  if (value.length > maximumLength) throw new Error(`Campo ${field} excede ${maximumLength} caracteres.`);
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
        reasoning_efforts: option.reasoningEfforts ?? [],
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

export const buildAiConfigExportV2 = (params: BuildAiConfigExportParams): AiConfigExportV2 => {
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
          reasoning_effort: activeConfig.reasoning_effort,
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

const buildConfigurationExamples = (): AiConfigExample[] => [
  {
    id: "default-routing-automatic-reasoning",
    title: "Roteamento padrão com raciocínio automático",
    description: "A Feature acompanha o roteamento global atual e deixa o provider escolher o esforço suportado.",
    importable: false,
    example: {
      key: "example.default-routing",
      active_config: {
        feature_prompt: "Instruções específicas da Feature.",
        output_instructions: "Retorne somente o conteúdo final.",
        temperature: 0.4,
        max_output_tokens: 800,
        reasoning_effort: null,
        model_config: {
          mode: "default",
          model_override_enabled: false,
          provider: null,
          model: null,
          effective_provider: "openai",
          effective_model: "gpt-5.6-sol",
          resolution_source: "ai_routing",
        },
      },
    },
  },
  {
    id: "custom-reasoning-model",
    title: "Modelo personalizado com esforço explícito",
    description: "A Feature fixa provider/model e seleciona um esforço aceito pelo modelo.",
    importable: false,
    example: {
      key: "example.custom-reasoning",
      active_config: {
        feature_prompt: "Instruções específicas da Feature.",
        output_instructions: "Retorne somente o conteúdo final.",
        temperature: 0.4,
        max_output_tokens: 1200,
        reasoning_effort: "high",
        model_config: {
          mode: "custom",
          model_override_enabled: true,
          provider: "openai",
          model: "gpt-5.6-sol",
          effective_provider: "openai",
          effective_model: "gpt-5.6-sol",
          resolution_source: "feature",
        },
      },
    },
  },
  {
    id: "custom-non-reasoning-model",
    title: "Modelo personalizado sem esforço de raciocínio",
    description: "Modelos sem reasoning usam reasoning_effort null; a temperatura continua configurável quando suportada.",
    importable: false,
    example: {
      key: "example.custom-non-reasoning",
      active_config: {
        feature_prompt: "Instruções específicas da Feature.",
        output_instructions: "Retorne somente o conteúdo final.",
        temperature: 0.7,
        max_output_tokens: 800,
        reasoning_effort: null,
        model_config: {
          mode: "custom",
          model_override_enabled: true,
          provider: "openai",
          model: "gpt-4.1-mini",
          effective_provider: "openai",
          effective_model: "gpt-4.1-mini",
          resolution_source: "feature",
        },
      },
    },
  },
];

export const buildAiConfigExportV3 = (params: BuildAiConfigExportParams): AiConfigExportV3 => {
  const base = buildAiConfigExportV2(params);

  return {
    format: "kifer-saude-ai-config",
    version: 3,
    exported_at: base.exported_at,
    documentation: {
      description: "Backup autocontido das Configurações de IA da Kifer Saúde.",
      import_behavior: [
        "Somente os itens de features e global_configs são candidatos à importação.",
        "configuration_examples, model_catalog_snapshot, routing_snapshot e campos effective_* são apenas informativos.",
        "model_override_enabled=false mantém o roteamento padrão atual; effective_model nunca vira override.",
        "Overrides inválidos são preservados com aviso, sem substituição silenciosa de modelo.",
      ],
      field_notes: {
        reasoning_effort: "null usa o comportamento automático; valores explícitos só devem ser usados quando suportados pelo modelo.",
        model_config: "mode descreve a intenção e deve ser coerente com model_override_enabled.",
        configuration_examples: "Exemplos ilustrativos com importable=false; o importador nunca os aplica.",
      },
    },
    configuration_examples: buildConfigurationExamples(),
    features: base.features,
    global_configs: base.global_configs,
    model_catalog_snapshot: base.model_catalog_snapshot,
    routing_snapshot: base.routing_snapshot,
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

  if (rawData.version !== undefined && rawData.version !== 1 && rawData.version !== 2 && rawData.version !== 3) {
    throw new Error(`Versão de export não suportada: ${String(rawData.version)}.`);
  }

  const version: AiConfigImportPlan["version"] = rawData.version === 3 ? 3 : rawData.version === 2 ? 2 : 1;
  const strict = version === 3;
  if (strict && rawData.format !== "kifer-saude-ai-config") {
    throw new Error("Export v3 inválido: identificador de formato ausente ou incorreto.");
  }
  if (rawData.features.length > 500) {
    throw new Error("O arquivo excede o limite de 500 Features.");
  }

  const features: AiImportFeaturePlan[] = [];
  const warnings: string[] = [];
  const seenFeatureKeys = new Set<string>();
  let skippedFeatures = 0;

  for (const [index, rawFeature] of rawData.features.entries()) {
    if (!isRecord(rawFeature) || typeof rawFeature.key !== "string") {
      if (strict) throw new Error(`Feature na posição ${index + 1} é inválida.`);
      skippedFeatures++;
      continue;
    }

    const featureKey = rawFeature.key.trim();
    if (!featureKey) {
      if (strict) throw new Error(`Feature na posição ${index + 1} está sem key.`);
      skippedFeatures++;
      continue;
    }
    if (seenFeatureKeys.has(featureKey)) {
      throw new Error(`Feature duplicada no arquivo: ${featureKey}.`);
    }
    seenFeatureKeys.add(featureKey);

    if (rawFeature.active_config === null) {
      skippedFeatures++;
      continue;
    }
    if (!isRecord(rawFeature.active_config)) {
      if (strict) throw new Error(`${featureKey}: active_config inválido.`);
      skippedFeatures++;
      continue;
    }

    const feature = currentFeatures.find((candidate) => candidate.key === featureKey);
    if (!feature) {
      warnings.push(`Feature desconhecida ignorada: ${featureKey}.`);
      skippedFeatures++;
      continue;
    }
    if (feature.enabled === false) {
      warnings.push(`${feature.name}: Feature legada/desativada não será importada.`);
      skippedFeatures++;
      continue;
    }

    const rawConfig = rawFeature.active_config;
    const payload: AiImportFeaturePlan["payload"] = {
      feature_prompt: readBoundedString(rawConfig.feature_prompt, `${feature.key}.feature_prompt`, 100_000),
      output_instructions: readBoundedString(rawConfig.output_instructions, `${feature.key}.output_instructions`, 50_000),
      temperature: strict
        ? readBoundedNumber(rawConfig.temperature, `${feature.key}.temperature`, 0, 1)
        : readFiniteNumber(rawConfig.temperature, `${feature.key}.temperature`),
      max_output_tokens: strict
        ? readBoundedNumber(rawConfig.max_output_tokens, `${feature.key}.max_output_tokens`, 100, 8_000, true)
        : readFiniteNumber(rawConfig.max_output_tokens, `${feature.key}.max_output_tokens`),
    };

    if (rawConfig.reasoning_effort === null || isReasoningEffort(rawConfig.reasoning_effort)) {
      payload.reasoning_effort = rawConfig.reasoning_effort;
    } else if (strict || rawConfig.reasoning_effort !== undefined) {
      throw new Error(`Campo ${feature.key}.reasoning_effort inválido.`);
    }
    let modelMode: AiImportFeaturePlan["modelMode"] = "legacy";
    let modelLabel: string | null = null;
    const featureWarnings: string[] = [];

    if (version >= 2 && isRecord(rawConfig.model_config)) {
      const rawModelConfig = rawConfig.model_config;
      if (strict) {
        if (typeof rawModelConfig.model_override_enabled !== "boolean") {
          throw new Error(`${feature.name}: model_override_enabled deve ser booleano.`);
        }
        const expectedMode = rawModelConfig.model_override_enabled === true ? "custom" : "default";
        if (rawModelConfig.mode !== expectedMode) {
          throw new Error(`${feature.name}: mode e model_override_enabled são inconsistentes.`);
        }
        if (expectedMode === "default" && (rawModelConfig.provider !== null || rawModelConfig.model !== null)) {
          throw new Error(`${feature.name}: provider/model devem ser nulos no modo default.`);
        }
      }
      if (rawModelConfig.model_override_enabled === true) {
        const provider = rawModelConfig.provider;
        const model = typeof rawModelConfig.model === "string"
          ? readBoundedString(rawModelConfig.model.trim(), `${feature.key}.model`, 255)
          : "";
        if (!isProvider(provider) || !model) {
          throw new Error(`${feature.name}: override personalizado sem provider/model válido.`);
        }
        payload.model_override_enabled = true;
        payload.provider = provider;
        payload.model = model;
        modelMode = "custom";
        modelLabel = `${provider} / ${model}`;
        featureWarnings.push(...validateImportedOverride(feature, provider, model, currentCatalog));
        const catalogModel = currentCatalog.find((item) => item.provider === provider && item.model === model);
        if (
          payload.reasoning_effort &&
          payload.reasoning_effort !== "none" &&
          catalogModel &&
          !catalogModel.capabilities.includes("reasoning")
        ) {
          featureWarnings.push(
            `${feature.name}: ${provider}/${model} não aceita esforço de raciocínio; revise reasoning_effort.`,
          );
        }
      } else {
        payload.model_override_enabled = false;
        modelMode = "default";
      }
    } else if (strict) {
      throw new Error(`${feature.name}: model_config é obrigatório no export v3.`);
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

  const globalConfigs: Array<{ key: string; value: string }> = [];
  const seenGlobalKeys = new Set<string>();
  if (rawData.global_configs !== undefined && !Array.isArray(rawData.global_configs)) {
    if (strict) throw new Error("global_configs deve ser uma lista.");
  } else if (Array.isArray(rawData.global_configs)) {
    if (rawData.global_configs.length > 200) throw new Error("O arquivo excede o limite de 200 configurações globais.");
    for (const [index, item] of rawData.global_configs.entries()) {
      if (!isRecord(item) || typeof item.key !== "string" || typeof item.value !== "string") {
        if (strict) throw new Error(`Configuração global na posição ${index + 1} é inválida.`);
        continue;
      }
      const key = readBoundedString(item.key.trim(), `global_configs[${index}].key`, 255);
      const value = readBoundedString(item.value, `global_configs[${index}].value`, 100_000);
      if (!key) throw new Error(`Configuração global na posição ${index + 1} está sem key.`);
      if (seenGlobalKeys.has(key)) throw new Error(`Configuração global duplicada no arquivo: ${key}.`);
      seenGlobalKeys.add(key);
      globalConfigs.push({ key, value });
    }
  }

  return { version, features, globalConfigs, warnings, skippedFeatures };
};
