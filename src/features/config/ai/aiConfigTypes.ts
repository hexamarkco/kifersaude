export type AiFeatureKey =
  | "audio_transcribe"
  | "message_rewrite"
  | "suggest_reply"
  | "attendance_critique"
  | "campaign_intent"
  | "agenda_organize"
  | "followup_analysis"
  | "followup_generate"
  | "followup_refine"
  | "autonomous_reply"
  | "sandbox_chat"
  | "sandbox_scenario";

export type AiProviderSlug = "openai" | "gemini" | "claude";

export type AiModelResolutionSource = "feature" | "ai_routing" | "provider_default" | "fallback";

export type AiFeatureRow = {
  id: string;
  key: AiFeatureKey;
  name: string;
  description: string | null;
  category: string;
  available_variables: string[];
  default_feature_prompt: string;
  default_output_instructions: string;
  default_temperature: number;
  default_max_output_tokens: number;
  created_at: string;
};

export type AiFeatureConfigRow = {
  id: string;
  feature_id: string;
  version: number;
  feature_prompt: string;
  output_instructions: string;
  temperature: number;
  max_output_tokens: number;
  provider: AiProviderSlug | null;
  model: string | null;
  model_override_enabled: boolean;
  reasoning_effort: "none" | "minimal" | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
};

export type AiGlobalConfigRow = {
  id: string;
  key: string;
  value: string;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
};

export type AiConfigVersionRow = {
  id: string;
  feature_id: string;
  version: number;
  snapshot: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
};

export type AiFeatureWithConfig = AiFeatureRow & {
  active_config: AiFeatureConfigRow | null;
  config_count: number;
};

export type AiFeatureCategory = {
  label: string;
  features: AiFeatureWithConfig[];
};

export type AiModelPricingRow = {
  id: string;
  provider: AiProviderSlug;
  model: string;
  input_per_million: number;
  cached_input_per_million: number | null;
  output_per_million: number;
  is_transcription: boolean;
  transcription_per_minute: number | null;
  active: boolean;
  effective_from: string;
  effective_to: string | null;
};

export type AiEffectiveModel = {
  provider: AiProviderSlug;
  model: string;
  source: AiModelResolutionSource;
  sourceLabel: string;
};

export type AiModelCatalogCapability = "text" | "structured_output" | "reasoning" | "transcription" | "multimodal";

export type AiModelCatalogRow = {
  id: string;
  provider: AiProviderSlug;
  model: string;
  display_name: string;
  capabilities: AiModelCatalogCapability[];
  active: boolean;
  deprecated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AiModelCatalogWithPricing = AiModelCatalogRow & {
  has_pricing: boolean;
  input_per_million: number | null;
  output_per_million: number | null;
};

/** taskType from ai-feature-registry → required capabilities */
export const TASK_TYPE_REQUIRED_CAPABILITIES: Record<string, AiModelCatalogCapability[]> = {
  text: ["text"],
  structured_output: ["text", "structured_output"],
  transcription: ["transcription"],
};

export const AI_PROVIDER_OPTIONS: Array<{ value: AiProviderSlug; label: string }> = [
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Google Gemini" },
  { value: "claude", label: "Anthropic Claude" },
];

export const AI_FEATURE_LABELS: Record<AiFeatureKey, string> = {
  audio_transcribe: "Transcrição de Áudio",
  message_rewrite: "Reescrita de Mensagem",
  suggest_reply: "Sugestão de Resposta",
  attendance_critique: "Crítica de Atendimento",
  campaign_intent: "Classificação de Intenção",
  agenda_organize: "Organização de Agenda",
  followup_analysis: "Análise de Follow-up",
  followup_generate: "Geração de Follow-up",
  followup_refine: "Refinamento de Follow-up",
  autonomous_reply: "Resposta Autônoma",
  sandbox_chat: "Chat Sandbox",
  sandbox_scenario: "Cenário Sandbox",
};

export const AI_FEATURE_CATEGORIES: Record<string, string> = {
  transcription: "Transcrição",
  messaging: "Mensagens",
  campaign: "Campanha",
  agenda: "Agenda",
  followup: "Follow-up",
  autonomous: "Atendimento Autônomo",
  sandbox: "Sandbox",
};

export const AI_MODEL_RESOLUTION_SOURCE_LABELS: Record<AiModelResolutionSource, string> = {
  feature: "Personalizado (esta feature)",
  ai_routing: "Roteamento por funcionalidade",
  provider_default: "Default do provider",
  fallback: "Fallback",
};

/** Features deprecated from the admin UI — kept for backward compat but hidden */
export const AI_FEATURE_DEPRECATED_KEYS = new Set<AiFeatureKey>([
  "sandbox_chat",
]);
