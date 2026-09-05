/**
 * AI Config Resolver
 *
 * Central service for loading AI feature configurations from the database
 * with in-memory caching and fallback to defaults.
 *
 * Flow:
 * 1. Check in-memory cache (TTL: 60s)
 * 2. Query ai_feature_configs where is_active = true
 * 3. If not found → use defaults from AI_FEATURE_META
 * 4. Cache result
 *
 * Cache is invalidated when "Salvar e ativar" is called from the admin panel.
 */

import {
  AI_FEATURE_META,
  type AIFeatureKey,
} from './ai-feature-registry.ts';
import type { AiProvider } from './ai-router.ts';

// ============================================================
// Types
// ============================================================

export type ResolvedAIFeatureConfig = {
  featureKey: AIFeatureKey;
  provider: AiProvider;
  model: string;
  fallbackModel: string | null;
  modelOverrideEnabled: boolean;
  temperature: number;
  maxOutputTokens: number;
  reasoningEffort: 'none' | 'minimal' | null;
  timeoutMs: number | null;
  retryCount: number | null;
  useGlobalInstructions: boolean;
  useGlobalStyle: boolean;
  featurePrompt: string;
  outputInstructions: string;
  contextConfig: Record<string, boolean>;
  version: number;
};

export type ResolvedAIGlobalConfig = {
  key: string;
  content: string;
  version: number;
};

// ============================================================
// Cache
// ============================================================

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const CACHE_TTL_MS = 60_000; // 60 seconds

const featureConfigCache = new Map<string, CacheEntry<ResolvedAIFeatureConfig>>();
const globalConfigCache = new Map<string, CacheEntry<ResolvedAIGlobalConfig>>();

// ============================================================
// Resolve Feature Config
// ============================================================

export async function loadFeatureConfig(
  supabaseAdmin: any,
  featureKey: AIFeatureKey,
  options?: { noCache?: boolean },
): Promise<ResolvedAIFeatureConfig> {
  const cacheKey = featureKey;

  // Check cache
  if (!options?.noCache) {
    const cached = featureConfigCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
  }

  // Query database
  const { data: feature, error: featureError } = await supabaseAdmin
    .from('ai_features')
    .select('id')
    .eq('key', featureKey)
    .single();

  if (featureError || !feature) {
    // Feature not registered yet — use defaults
    console.warn(`[AIConfig] Feature not found in registry, using defaults: ${featureKey}`);
    return buildDefaultConfig(featureKey);
  }

  const { data: config, error: configError } = await supabaseAdmin
    .from('ai_feature_configs')
    .select('*')
    .eq('feature_id', feature.id)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (configError) {
    console.error(`[AIConfig] Error loading config for ${featureKey}:`, configError.message);
    return buildDefaultConfig(featureKey);
  }

  if (!config) {
    // No active config — use defaults
    console.warn(`[AIConfig] No active config for ${featureKey}, using defaults`);
    return buildDefaultConfig(featureKey);
  }

  const resolved = mergeWithDefaults(featureKey, config);

  // Cache
  featureConfigCache.set(cacheKey, {
    value: resolved,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return resolved;
}

// ============================================================
// Resolve Global Config
// ============================================================

export async function loadGlobalConfig(
  supabaseAdmin: any,
  configKey: string,
  options?: { noCache?: boolean },
): Promise<ResolvedAIGlobalConfig | null> {
  const cacheKey = configKey;

  // Check cache
  if (!options?.noCache) {
    const cached = globalConfigCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
  }

  const { data: config, error } = await supabaseAdmin
    .from('ai_global_configs')
    .select('key, content, version')
    .eq('key', configKey)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`[AIConfig] Error loading global config ${configKey}:`, error.message);
    return null;
  }

  if (!config) {
    return null;
  }

  const resolved: ResolvedAIGlobalConfig = {
    key: config.key,
    content: config.content ?? '',
    version: config.version,
  };

  // Cache
  globalConfigCache.set(cacheKey, {
    value: resolved,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return resolved;
}

// ============================================================
// Cache Invalidation
// ============================================================

export function invalidateConfigCache(featureKey?: AIFeatureKey): void {
  if (featureKey) {
    featureConfigCache.delete(featureKey);
  } else {
    featureConfigCache.clear();
  }
  globalConfigCache.clear();
}

// ============================================================
// Helpers
// ============================================================

function buildDefaultConfig(featureKey: AIFeatureKey): ResolvedAIFeatureConfig {
  const meta = AI_FEATURE_META[featureKey];
  if (!meta) {
    throw new Error(`Unknown AI feature key: ${featureKey}`);
  }

  return {
    featureKey,
    provider: meta.defaultProvider,
    model: meta.defaultModel,
    fallbackModel: null,
    modelOverrideEnabled: false,
    temperature: meta.defaultTemperature,
    maxOutputTokens: meta.defaultMaxTokens,
    reasoningEffort: meta.defaultReasoningEffort,
    timeoutMs: null,
    retryCount: null,
    useGlobalInstructions: true,
    useGlobalStyle: true,
    featurePrompt: '',
    outputInstructions: '',
    contextConfig: { ...meta.defaultContextConfig },
    version: 0, // 0 = default, not from DB
  };
}

function mergeWithDefaults(
  featureKey: AIFeatureKey,
  config: Record<string, any>,
): ResolvedAIFeatureConfig {
  const meta = AI_FEATURE_META[featureKey];
  if (!meta) {
    throw new Error(`Unknown AI feature key: ${featureKey}`);
  }

  return {
    featureKey,
    provider: (config.provider as AiProvider) || meta.defaultProvider,
    model: config.model || meta.defaultModel,
    fallbackModel: config.fallback_model ?? null,
    modelOverrideEnabled: Boolean(config.model_override_enabled),
    temperature: config.temperature ?? meta.defaultTemperature,
    maxOutputTokens: config.max_output_tokens ?? meta.defaultMaxTokens,
    reasoningEffort: config.reasoning_effort ?? meta.defaultReasoningEffort,
    timeoutMs: config.timeout_ms ?? null,
    retryCount: config.retry_count ?? null,
    useGlobalInstructions: config.use_global_instructions ?? true,
    useGlobalStyle: config.use_global_style ?? true,
    featurePrompt: config.feature_prompt ?? '',
    outputInstructions: config.output_instructions ?? '',
    contextConfig: config.context_config_json ?? { ...meta.defaultContextConfig },
    version: config.version ?? 1,
  };
}
