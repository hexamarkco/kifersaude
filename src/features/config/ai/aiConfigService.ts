import { supabase } from "../../../lib/supabase";
import type {
  AiFeatureWithConfig,
  AiFeatureConfigRow,
  AiGlobalConfigRow,
  AiProviderSlug,
  AiModelCatalogCapability,
  AiModelCatalogWithPricing,
} from "./aiConfigTypes";
import { TASK_TYPE_REQUIRED_CAPABILITIES } from "./aiConfigTypes";

type ServiceResult<T> = { data: T | null; error: string | null };

const TABLE_FEATURES = "ai_features";
const TABLE_CONFIGS = "ai_feature_configs";
const TABLE_GLOBAL = "ai_global_configs";

export const aiConfigService = {
  async fetchFeaturesWithConfigs(): Promise<ServiceResult<AiFeatureWithConfig[]>> {
    const { data: features, error: featErr } = await supabase
      .from(TABLE_FEATURES)
      .select("*")
      .order("category")
      .order("name");

    if (featErr) return { data: null, error: featErr.message };

    const { data: configs, error: cfgErr } = await supabase
      .from(TABLE_CONFIGS)
      .select("*")
      .eq("is_active", true)
      .order("version", { ascending: false });

    if (cfgErr) return { data: null, error: cfgErr.message };

    const activeByFeature = new Map<string, AiFeatureConfigRow>();
    const countByFeature = new Map<string, number>();

    for (const cfg of configs ?? []) {
      if (!activeByFeature.has(cfg.feature_id)) {
        activeByFeature.set(cfg.feature_id, cfg);
      }
      const prev = countByFeature.get(cfg.feature_id) ?? 0;
      countByFeature.set(cfg.feature_id, prev + 1);
    }

    const result: AiFeatureWithConfig[] = (features ?? []).map((f: Record<string, unknown>) => ({
      ...(f as AiFeatureWithConfig),
      active_config: activeByFeature.get(f.id as string) ?? null,
      config_count: countByFeature.get(f.id as string) ?? 0,
    }));

    return { data: result, error: null };
  },

  async fetchConfigHistory(featureId: string): Promise<ServiceResult<AiFeatureConfigRow[]>> {
    const { data, error } = await supabase
      .from(TABLE_CONFIGS)
      .select("*")
      .eq("feature_id", featureId)
      .order("version", { ascending: false });

    return { data: data ?? [], error: error?.message ?? null };
  },

  async createConfig(
    featureId: string,
    payload: {
      feature_prompt: string;
      output_instructions: string;
      temperature: number;
      max_output_tokens: number;
      provider?: AiProviderSlug;
      model?: string;
      model_override_enabled?: boolean;
    },
  ): Promise<ServiceResult<AiFeatureConfigRow>> {
    const { data: existing, error: fetchErr } = await supabase
      .from(TABLE_CONFIGS)
      .select("version")
      .eq("feature_id", featureId)
      .order("version", { ascending: false })
      .limit(1);

    if (fetchErr) return { data: null, error: fetchErr.message };

    const nextVersion = (existing?.[0]?.version ?? 0) + 1;

    // Desativar todas as versões ativas anteriores desta feature
    const { error: deactivateError } = await supabase
      .from(TABLE_CONFIGS)
      .update({ is_active: false })
      .eq("feature_id", featureId)
      .eq("is_active", true);

    if (deactivateError) {
      console.error('[AIConfig] Failed to deactivate old versions:', deactivateError.message);
    }

    const insertPayload: Record<string, unknown> = {
      feature_id: featureId,
      version: nextVersion,
      feature_prompt: payload.feature_prompt,
      output_instructions: payload.output_instructions,
      temperature: payload.temperature,
      max_output_tokens: payload.max_output_tokens,
      is_active: true,
    };

    if (payload.provider !== undefined) insertPayload.provider = payload.provider;
    if (payload.model !== undefined) insertPayload.model = payload.model;
    if (payload.model_override_enabled !== undefined) {
      insertPayload.model_override_enabled = payload.model_override_enabled;
    }

    const { data, error } = await supabase
      .from(TABLE_CONFIGS)
      .insert(insertPayload)
      .select()
      .single();

    return { data: data ?? null, error: error?.message ?? null };
  },

  async deactivateConfig(configId: string): Promise<ServiceResult<boolean>> {
    const { error } = await supabase
      .from(TABLE_CONFIGS)
      .update({ is_active: false })
      .eq("id", configId);

    return { data: error ? null : true, error: error?.message ?? null };
  },

  async activateConfig(configId: string): Promise<ServiceResult<boolean>> {
    const { error } = await supabase
      .from(TABLE_CONFIGS)
      .update({
        is_active: true,
      })
      .eq("id", configId);

    return { data: error ? null : true, error: error?.message ?? null };
  },

  async fetchGlobalConfigs(): Promise<ServiceResult<AiGlobalConfigRow[]>> {
    const { data, error } = await supabase
      .from(TABLE_GLOBAL)
      .select("*")
      .order("key");

    return { data: data ?? [], error: error?.message ?? null };
  },

  async updateGlobalConfig(
    key: string,
    value: string,
  ): Promise<ServiceResult<AiGlobalConfigRow>> {
    const { data, error } = await supabase
      .from(TABLE_GLOBAL)
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" })
      .select()
      .single();

    return { data: data ?? null, error: error?.message ?? null };
  },

  async deleteConfig(configId: string): Promise<ServiceResult<boolean>> {
    const { error } = await supabase
      .from(TABLE_CONFIGS)
      .delete()
      .eq("id", configId);

    return { data: error ? null : true, error: error?.message ?? null };
  },

  async fetchAvailableModels(): Promise<ServiceResult<AiModelCatalogWithPricing[]>> {
    const { data, error } = await supabase
      .from("ai_models")
      .select(`
        id, provider, model, display_name, capabilities, active, deprecated_at, created_at, updated_at,
        ai_model_pricing!left(input_per_million, output_per_million)
      `)
      .eq("active", true)
      .order("provider")
      .order("display_name");

    if (error) return { data: null, error: error.message };

    const models: AiModelCatalogWithPricing[] = (data ?? []).map((row: Record<string, unknown>) => {
      const pricing = Array.isArray(row.ai_model_pricing) ? row.ai_model_pricing[0] : row.ai_model_pricing;
      return {
        id: row.id as string,
        provider: row.provider as AiProviderSlug,
        model: row.model as string,
        display_name: row.display_name as string,
        capabilities: (row.capabilities ?? []) as AiModelCatalogCapability[],
        active: row.active as boolean,
        deprecated_at: row.deprecated_at as string | null,
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
        has_pricing: pricing != null,
        input_per_million: pricing?.input_per_million ?? null,
        output_per_million: pricing?.output_per_million ?? null,
      };
    });

    return { data: models, error: null };
  },

  async validateModelOverride(
    provider: AiProviderSlug,
    model: string,
    taskType: string,
  ): Promise<{ valid: boolean; error?: string }> {
    const requiredCaps = TASK_TYPE_REQUIRED_CAPABILITIES[taskType];
    if (!requiredCaps) return { valid: true };

    const { data, error } = await supabase
      .from("ai_models")
      .select("capabilities, active, deprecated_at")
      .eq("provider", provider)
      .eq("model", model)
      .single();

    if (error || !data) {
      return { valid: false, error: `Modelo "${model}" não encontrado no catálogo.` };
    }

    if (!data.active) {
      return { valid: false, error: `Modelo "${model}" está desativado.` };
    }

    if (data.deprecated_at) {
      return { valid: false, error: `Modelo "${model}" foi descontinuado pelo provider.` };
    }

    const caps = (data.capabilities ?? []) as AiModelCatalogCapability[];
    const missing = requiredCaps.filter((c) => !caps.includes(c));
    if (missing.length > 0) {
      return {
        valid: false,
        error: `Modelo "${model}" não suporta: ${missing.join(", ")}. Capacidades necessárias para esta feature: ${requiredCaps.join(", ")}.`,
      };
    }

    return { valid: true };
  },

  async fetchEffectiveModel(
    featureKey: string,
    aiTask: string,
  ): Promise<ServiceResult<{ provider: string; model: string; source: string; sourceLabel: string }>> {
    const { data, error } = await supabase.functions.invoke("resolve-ai-model", {
      body: { featureKey, aiTask },
    });

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  },
};
