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
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  activated_at: string | null;
  deactivated_at: string | null;
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
