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

export const AI_PROVIDER_OPTIONS: Array<{ value: AiProviderSlug; label: string }> = [
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Google Gemini" },
  { value: "claude", label: "Anthropic Claude" },
];

export const AI_MODEL_LABELS: Record<string, string> = {
  "gpt-5.5": "GPT-5.5",
  "gpt-4o": "GPT-4o",
  "gpt-4o-mini": "GPT-4o Mini",
  "gpt-4o-transcribe": "GPT-4o Transcribe",
  "gpt-4o-mini-transcribe": "GPT-4o Mini Transcribe",
  "gemini-2.0-flash": "Gemini 2.0 Flash",
  "claude-3-5-sonnet-latest": "Claude 3.5 Sonnet",
};

export const AI_MODEL_OPTIONS: Record<AiProviderSlug, Array<{ value: string; label: string }>> = {
  openai: [
    { value: "gpt-5.5", label: "GPT-5.5" },
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini" },
    { value: "gpt-4o-transcribe", label: "GPT-4o Transcribe" },
    { value: "gpt-4o-mini-transcribe", label: "GPT-4o Mini Transcribe" },
  ],
  gemini: [
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  ],
  claude: [
    { value: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet" },
  ],
};

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
