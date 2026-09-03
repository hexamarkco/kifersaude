/**
 * AI Feature Registry
 *
 * Central registry of all AI features in the system. Each feature has:
 * - A stable key (never changes after creation)
 * - Metadata (name, description, task type)
 * - Which ai-router task it maps to
 * - Default parameters (temperature, maxTokens)
 * - Available template variables for prompt interpolation
 *
 * This file is the SINGLE SOURCE OF TRUTH for what AI features exist.
 * The database config defines HOW each feature behaves.
 * This registry defines WHAT features exist structurally.
 */

import type { AiTask } from './ai-router.ts';

// ============================================================
// Feature Key Constants
// ============================================================

export const AI_FEATURES = {
  FOLLOWUP_GENERATE: 'followup.generate',
  FOLLOWUP_ANALYSIS: 'followup.analysis',
  FOLLOWUP_REFINE: 'followup.refine',
  MESSAGE_REWRITE: 'message.rewrite',
  MESSAGE_SUGGEST: 'message.suggest',
  ATTENDANCE_CRITIQUE: 'attendance.critique',
  AUDIO_TRANSCRIBE: 'audio.transcribe',
  AUTONOMOUS_REPLY: 'autonomous.reply',
  SANDBOX_CHAT: 'sandbox.chat',
  SANDBOX_SCENARIO: 'sandbox.scenario',
  CAMPAIGN_INTENT: 'campaign.intent',
  AGENDA_ORGANIZE: 'agenda.organize',
} as const;

export type AIFeatureKey = typeof AI_FEATURES[keyof typeof AI_FEATURES];

// ============================================================
// Feature Metadata
// ============================================================

export type AIFeatureTaskType = 'text' | 'structured_output' | 'transcription';

export type AIFeatureMeta = {
  key: AIFeatureKey;
  name: string;
  description: string;
  taskType: AIFeatureTaskType;
  aiTask: AiTask;
  defaultProvider: 'openai' | 'gemini' | 'claude';
  defaultModel: string;
  defaultTemperature: number;
  defaultMaxTokens: number;
  defaultReasoningEffort: 'none' | 'minimal' | null;
  /** Which context blocks this feature uses */
  defaultContextConfig: Record<string, boolean>;
  /** Template variables available for prompt interpolation */
  availableVariables: Array<{ key: string; label: string; description: string }>;
};

export const AI_FEATURE_META: Record<AIFeatureKey, AIFeatureMeta> = {
  [AI_FEATURES.FOLLOWUP_GENERATE]: {
    key: AI_FEATURES.FOLLOWUP_GENERATE,
    name: 'Gerar Follow-up',
    description: 'Gera mensagem de follow-up para conversas WhatsApp usando análise comercial + Copy.',
    taskType: 'structured_output',
    aiTask: 'follow_up_generation',
    defaultProvider: 'openai',
    defaultModel: 'gpt-4o-mini',
    defaultTemperature: 0.5,
    defaultMaxTokens: 520,
    defaultReasoningEffort: 'minimal',
    defaultContextConfig: {
      transcript: true,
      temporalFacts: true,
      leadContext: true,
      recentFollowUps: true,
      commercialState: true,
    },
    availableVariables: [
      { key: 'transcript', label: 'Histórico da conversa', description: 'Transcrição completa da conversa WhatsApp.' },
      { key: 'temporal_facts', label: 'Fatos temporais', description: 'Datas, horários e intervalos relevantes.' },
      { key: 'lead_context', label: 'Contexto do lead', description: 'Nome, cidade, estágio, dados cadastrais.' },
      { key: 'recent_follow_ups', label: 'Follow-ups anteriores', description: 'Últimos follow-ups enviados.' },
      { key: 'commercial_state', label: 'Estado comercial', description: 'Estado comercial registrado (se existir).' },
      { key: 'style_profile', label: 'Perfil de estilo', description: 'Regras de estilo da operação.' },
      { key: 'validation_feedback', label: 'Feedback do validador', description: 'Feedback de retry do validador (quando houver).' },
      { key: 'nome', label: 'Nome do lead', description: 'Nome completo do lead.' },
      { key: 'primeiro_nome', label: 'Primeiro nome', description: 'Primeiro nome do lead.' },
      { key: 'data_hoje', label: 'Data de hoje', description: 'Data atual no fuso do sistema.' },
    ],
  },

  [AI_FEATURES.FOLLOWUP_ANALYSIS]: {
    key: AI_FEATURES.FOLLOWUP_ANALYSIS,
    name: 'Análise Comercial',
    description: 'Analisa a conversa e define a estratégia de follow-up ( Chamada 1 do V3).',
    taskType: 'structured_output',
    aiTask: 'follow_up_analysis',
    defaultProvider: 'openai',
    defaultModel: 'gpt-4o-mini',
    defaultTemperature: 0.3,
    defaultMaxTokens: 900,
    defaultReasoningEffort: 'minimal',
    defaultContextConfig: {
      transcript: true,
      temporalFacts: true,
      leadContext: true,
      recentFollowUps: true,
      previousState: true,
    },
    availableVariables: [
      { key: 'transcript', label: 'Histórico da conversa', description: 'Transcrição completa da conversa WhatsApp.' },
      { key: 'temporal_facts', label: 'Fatos temporais', description: 'Datas, horários e intervalos relevantes.' },
      { key: 'lead_context', label: 'Contexto do lead', description: 'Nome, cidade, estágio, dados cadastrais.' },
      { key: 'recent_follow_ups', label: 'Follow-ups anteriores', description: 'Últimos follow-ups enviados.' },
      { key: 'previous_state', label: 'Estado anterior', description: 'Estado comercial da última análise.' },
    ],
  },

  [AI_FEATURES.FOLLOWUP_REFINE]: {
    key: AI_FEATURES.FOLLOWUP_REFINE,
    name: 'Refinar Follow-up',
    description: 'Refina uma mensagem de follow-up existente com instruções do usuário.',
    taskType: 'text',
    aiTask: 'follow_up_generation',
    defaultProvider: 'openai',
    defaultModel: 'gpt-4o-mini',
    defaultTemperature: 0.5,
    defaultMaxTokens: 320,
    defaultReasoningEffort: null,
    defaultContextConfig: {
      currentMessage: true,
      adjustmentInstruction: true,
      conversationHistory: true,
    },
    availableVariables: [
      { key: 'current_message', label: 'Mensagem atual', description: 'Mensagem de follow-up atual para refinar.' },
      { key: 'adjustment_instruction', label: 'Instrução de ajuste', description: 'O que o usuário quer mudar.' },
      { key: 'transcript', label: 'Histórico da conversa', description: 'Trecho relevante da conversa.' },
      { key: 'nome', label: 'Nome do lead', description: 'Nome completo do lead.' },
    ],
  },

  [AI_FEATURES.MESSAGE_REWRITE]: {
    key: AI_FEATURES.MESSAGE_REWRITE,
    name: 'Reescrever Mensagem',
    description: 'Reescreve/ajusta uma mensagem WhatsApp com tom e instrução específicos.',
    taskType: 'text',
    aiTask: 'rewrite_message',
    defaultProvider: 'openai',
    defaultModel: 'gpt-4o-mini',
    defaultTemperature: 0.2,
    defaultMaxTokens: 420,
    defaultReasoningEffort: null,
    defaultContextConfig: {
      originalText: true,
      adjustment: true,
      tone: true,
      conversationHistory: true,
    },
    availableVariables: [
      { key: 'original_text', label: 'Texto original', description: 'Mensagem original a ser reescrita.' },
      { key: 'adjustment', label: 'Instrução', description: 'Instrução de ajuste do usuário.' },
      { key: 'tone', label: 'Tom', description: 'Tom desejado (profissional, amigável, etc).' },
      { key: 'transcript', label: 'Trecho da conversa', description: 'Trecho relevante para contexto.' },
    ],
  },

  [AI_FEATURES.MESSAGE_SUGGEST]: {
    key: AI_FEATURES.MESSAGE_SUGGEST,
    name: 'Sugerir Resposta',
    description: 'Sugere próxima mensagem ou completa rascunho no composer do WhatsApp.',
    taskType: 'text',
    aiTask: 'follow_up_generation',
    defaultProvider: 'openai',
    defaultModel: 'gpt-4o-mini',
    defaultTemperature: 0.4,
    defaultMaxTokens: 420,
    defaultReasoningEffort: null,
    defaultContextConfig: {
      conversationHistory: true,
      draftText: true,
      suggestionMode: true,
    },
    availableVariables: [
      { key: 'transcript', label: 'Histórico da conversa', description: 'Histórico da conversa WhatsApp.' },
      { key: 'draft_text', label: 'Rascunho', description: 'Texto que o usuário está digitando.' },
      { key: 'suggestion_mode', label: 'Modo', description: 'suggest_reply ou complete_draft.' },
      { key: 'nome', label: 'Nome do lead', description: 'Nome completo do lead.' },
    ],
  },

  [AI_FEATURES.ATTENDANCE_CRITIQUE]: {
    key: AI_FEATURES.ATTENDANCE_CRITIQUE,
    name: 'Avaliar Atendimento',
    description: 'Audita a qualidade do atendimento humano no WhatsApp.',
    taskType: 'structured_output',
    aiTask: 'attendance_critique',
    defaultProvider: 'openai',
    defaultModel: 'gpt-4o-mini',
    defaultTemperature: 0.3,
    defaultMaxTokens: 1100,
    defaultReasoningEffort: 'minimal',
    defaultContextConfig: {
      transcript: true,
      sellerName: true,
    },
    availableVariables: [
      { key: 'transcript', label: 'Histórico da conversa', description: 'Transcrição completa da conversa.' },
      { key: 'seller_name', label: 'Nome do vendedor', description: 'Nome do atendente humano.' },
    ],
  },

  [AI_FEATURES.AUDIO_TRANSCRIBE]: {
    key: AI_FEATURES.AUDIO_TRANSCRIBE,
    name: 'Transcrever Áudio',
    description: 'Transcreve mensagens de áudio do WhatsApp.',
    taskType: 'transcription',
    aiTask: 'whatsapp_audio_transcription',
    defaultProvider: 'openai',
    defaultModel: 'gpt-4o-mini-transcribe',
    defaultTemperature: 0,
    defaultMaxTokens: 0,
    defaultReasoningEffort: null,
    defaultContextConfig: {},
    availableVariables: [],
  },

  [AI_FEATURES.AUTONOMOUS_REPLY]: {
    key: AI_FEATURES.AUTONOMOUS_REPLY,
    name: 'Resposta Autônoma',
    description: 'Responde automaticamente mensagens inbound do WhatsApp (persona Luiza).',
    taskType: 'text',
    aiTask: 'autonomous_attendance',
    defaultProvider: 'openai',
    defaultModel: 'gpt-4o-mini',
    defaultTemperature: 0.6,
    defaultMaxTokens: 350,
    defaultReasoningEffort: 'minimal',
    defaultContextConfig: {
      transcript: true,
      leadContext: true,
      styleProfile: true,
      quickReplies: true,
      similarSituations: true,
    },
    availableVariables: [
      { key: 'transcript', label: 'Histórico da conversa', description: 'Transcrição da conversa.' },
      { key: 'lead_context', label: 'Contexto do lead', description: 'Nome, cidade, dados do lead.' },
      { key: 'style_profile', label: 'Perfil de estilo', description: 'Configurações de estilo da operação.' },
      { key: 'quick_replies', label: 'Respostas rápidas', description: 'Respostas rápidas disponíveis.' },
      { key: 'similar_situations', label: 'Situações similares', description: 'Conversas parecidas anteriores.' },
    ],
  },

  [AI_FEATURES.SANDBOX_CHAT]: {
    key: AI_FEATURES.SANDBOX_CHAT,
    name: 'Chat Sandbox',
    description: 'Simulação interativa do atendimento autônomo para testes.',
    taskType: 'text',
    aiTask: 'autonomous_attendance',
    defaultProvider: 'openai',
    defaultModel: 'gpt-4o-mini',
    defaultTemperature: 0.6,
    defaultMaxTokens: 350,
    defaultReasoningEffort: null,
    defaultContextConfig: {
      transcript: true,
      leadContext: true,
      styleProfile: true,
    },
    availableVariables: [
      { key: 'transcript', label: 'Histórico da simulação', description: 'Conversa simulada até o momento.' },
      { key: 'lead_context', label: 'Contexto do lead', description: 'Dados do lead simulado.' },
      { key: 'style_profile', label: 'Perfil de estilo', description: 'Configurações de estilo.' },
    ],
  },

  [AI_FEATURES.SANDBOX_SCENARIO]: {
    key: AI_FEATURES.SANDBOX_SCENARIO,
    name: 'Cenário Automatizado',
    description: 'Teste automatizado multi-turn: IA simula lead + atendente + juiz.',
    taskType: 'structured_output',
    aiTask: 'autonomous_attendance',
    defaultProvider: 'openai',
    defaultModel: 'gpt-4o-mini',
    defaultTemperature: 0.6,
    defaultMaxTokens: 350,
    defaultReasoningEffort: null,
    defaultContextConfig: {
      scenarioDescription: true,
      leadPersona: true,
      styleProfile: true,
    },
    availableVariables: [
      { key: 'scenario_description', label: 'Descrição do cenário', description: 'Descrição do cenário de teste.' },
      { key: 'lead_persona', label: 'Persona do lead', description: 'Persona do lead simulado.' },
      { key: 'style_profile', label: 'Perfil de estilo', description: 'Configurações de estilo.' },
    ],
  },

  [AI_FEATURES.CAMPAIGN_INTENT]: {
    key: AI_FEATURES.CAMPAIGN_INTENT,
    name: 'Classificar Intenção',
    description: 'Classifica a intenção de respostas inbound em campanhas WhatsApp.',
    taskType: 'structured_output',
    aiTask: 'follow_up_generation',
    defaultProvider: 'openai',
    defaultModel: 'gpt-4o-mini',
    defaultTemperature: 0.1,
    defaultMaxTokens: 280,
    defaultReasoningEffort: null,
    defaultContextConfig: {
      inboundMessage: true,
      campaignContext: true,
      conversationHistory: true,
    },
    availableVariables: [
      { key: 'inbound_message', label: 'Mensagem recebida', description: 'Mensagem inbound do lead.' },
      { key: 'campaign_context', label: 'Contexto da campanha', description: 'Etapa e configuração da campanha.' },
      { key: 'transcript', label: 'Histórico', description: 'Trecho da conversa.' },
    ],
  },

  [AI_FEATURES.AGENDA_ORGANIZE]: {
    key: AI_FEATURES.AGENDA_ORGANIZE,
    name: 'Organizar Agenda',
    description: 'Prioriza e organiza follow-ups pendentes com scoring de IA.',
    taskType: 'structured_output',
    aiTask: 'follow_up_agenda_organization',
    defaultProvider: 'openai',
    defaultModel: 'gpt-4o-mini',
    defaultTemperature: 0.15,
    defaultMaxTokens: 1800,
    defaultReasoningEffort: null,
    defaultContextConfig: {
      pendingFollowUps: true,
      leadData: true,
      temporalContext: true,
    },
    availableVariables: [
      { key: 'pending_follow_ups', label: 'Follow-ups pendentes', description: 'Lista de follow-ups aguardando.' },
      { key: 'lead_data', label: 'Dados dos leads', description: 'Informações dos leads associados.' },
      { key: 'temporal_context', label: 'Contexto temporal', description: 'Datas e horários relevantes.' },
    ],
  },
};

// ============================================================
// Helpers
// ============================================================

/** Get all feature keys */
export function getAllFeatureKeys(): AIFeatureKey[] {
  return Object.values(AI_FEATURES);
}

/** Get metadata for a feature */
export function getFeatureMeta(featureKey: AIFeatureKey): AIFeatureMeta | undefined {
  return AI_FEATURE_META[featureKey];
}

/** Get metadata for a feature, throwing if not found */
export function requireFeatureMeta(featureKey: AIFeatureKey): AIFeatureMeta {
  const meta = AI_FEATURE_META[featureKey];
  if (!meta) {
    throw new Error(`Unknown AI feature key: ${featureKey}`);
  }
  return meta;
}

/** Check if a string is a valid feature key */
export function isValidFeatureKey(key: string): key is AIFeatureKey {
  return key in AI_FEATURE_META;
}
