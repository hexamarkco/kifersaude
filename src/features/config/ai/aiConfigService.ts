import { supabase } from "../../../lib/supabase";
import type {
  AiFeatureWithConfig,
  AiFeatureConfigRow,
  AiGlobalConfigRow,
} from "./aiConfigTypes";

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
    await supabase
      .from(TABLE_CONFIGS)
      .update({ is_active: false, deactivated_at: new Date().toISOString() })
      .eq("feature_id", featureId)
      .eq("is_active", true);

    const { data, error } = await supabase
      .from(TABLE_CONFIGS)
      .insert({
        feature_id: featureId,
        version: nextVersion,
        feature_prompt: payload.feature_prompt,
        output_instructions: payload.output_instructions,
        temperature: payload.temperature,
        max_output_tokens: payload.max_output_tokens,
        is_active: true,
        activated_at: new Date().toISOString(),
      })
      .select()
      .single();

    return { data: data ?? null, error: error?.message ?? null };
  },

  async deactivateConfig(configId: string): Promise<ServiceResult<boolean>> {
    const { error } = await supabase
      .from(TABLE_CONFIGS)
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString(),
      })
      .eq("id", configId);

    return { data: error ? null : true, error: error?.message ?? null };
  },

  async activateConfig(configId: string): Promise<ServiceResult<boolean>> {
    const { error } = await supabase
      .from(TABLE_CONFIGS)
      .update({
        is_active: true,
        activated_at: new Date().toISOString(),
        deactivated_at: null,
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
};
