/**
 * Prompt Composer
 *
 * Centralized prompt assembly for all AI features. Replaces inline template
 * strings with a layered composition system:
 *
 * 1. Global Instructions (Closer PRO persona/rules)
 * 2. Global Style (WhatsApp communication rules)
 * 3. Feature Prompt (feature-specific instructions)
 * 4. Output Instructions (format/response rules)
 * 5. Dynamic Context ({{variable}} interpolation)
 *
 * Features opt in/out of global layers via useGlobalInstructions/useGlobalStyle.
 * Variables are resolved from the context object passed at execution time.
 */

import {
  AI_FEATURE_META,
  type AIFeatureKey,
} from './ai-feature-registry.ts';
import {
  loadFeatureConfig,
  loadGlobalConfig,
  type ResolvedAIFeatureConfig,
} from './ai-config-resolver.ts';

// ============================================================
// Types
// ============================================================

export type ComposePromptOptions = {
  featureKey: AIFeatureKey;
  /** Dynamic context for variable interpolation */
  context: Record<string, unknown>;
  /** Optional custom instructions from the user (appended at the end) */
  customInstructions?: string;
};

export type ComposePromptResult = {
  systemPrompt: string;
  userPrompt: string;
  resolvedVariables: string[];
  unresolvedVariables: string[];
  totalLength: number;
  featureConfigVersion: number;
};

// ============================================================
// Global Prompt Keys
// ============================================================

export const GLOBAL_CONFIG_KEYS = {
  CLOSER_INSTRUCTIONS: 'closer_global_instructions',
  WHATSAPP_STYLE: 'whatsapp_style',
} as const;

// ============================================================
// Main Compose Function
// ============================================================

export async function composePrompt(
  supabaseAdmin: any,
  options: ComposePromptOptions,
): Promise<ComposePromptResult> {
  const { featureKey, context, customInstructions } = options;

  // Load feature config
  const featureConfig = await loadFeatureConfig(supabaseAdmin, featureKey);

  const layers: string[] = [];
  const resolvedVariables: string[] = [];
  const unresolvedVariables: string[] = [];

  // Layer 1: Global Instructions
  if (featureConfig.useGlobalInstructions) {
    const globalInstructions = await loadGlobalConfig(
      supabaseAdmin,
      GLOBAL_CONFIG_KEYS.CLOSER_INSTRUCTIONS,
    );
    if (globalInstructions?.content) {
      const { text, resolved, unresolved } = interpolateTemplate(
        globalInstructions.content,
        context,
      );
      layers.push(text);
      resolvedVariables.push(...resolved);
      unresolvedVariables.push(...unresolved);
    }
  }

  // Layer 2: Global Style
  if (featureConfig.useGlobalStyle) {
    const globalStyle = await loadGlobalConfig(
      supabaseAdmin,
      GLOBAL_CONFIG_KEYS.WHATSAPP_STYLE,
    );
    if (globalStyle?.content) {
      const { text, resolved, unresolved } = interpolateTemplate(
        globalStyle.content,
        context,
      );
      layers.push(text);
      resolvedVariables.push(...resolved);
      unresolvedVariables.push(...unresolved);
    }
  }

  // Layer 3: Feature Prompt
  if (featureConfig.featurePrompt) {
    const { text, resolved, unresolved } = interpolateTemplate(
      featureConfig.featurePrompt,
      context,
    );
    layers.push(text);
    resolvedVariables.push(...resolved);
    unresolvedVariables.push(...unresolved);
  }

  // Layer 4: Output Instructions
  if (featureConfig.outputInstructions) {
    const { text, resolved, unresolved } = interpolateTemplate(
      featureConfig.outputInstructions,
      context,
    );
    layers.push(text);
    resolvedVariables.push(...resolved);
    unresolvedVariables.push(...unresolved);
  }

  // Layer 5: Custom Instructions (from user, not templated)
  if (customInstructions?.trim()) {
    layers.push(`INSTRUÇÕES ADICIONAIS:\n${customInstructions.trim()}`);
  }

  // Compose system prompt
  const systemPrompt = layers
    .filter((l) => l.length > 0)
    .join('\n\n');

  // Compose user prompt from context
  const userPrompt = buildUserPrompt(featureKey, context, resolvedVariables, unresolvedVariables);

  // Deduplicate
  const uniqueResolved = [...new Set(resolvedVariables)];
  const uniqueUnresolved = [...new Set(unresolvedVariables)];

  return {
    systemPrompt,
    userPrompt,
    resolvedVariables: uniqueResolved,
    unresolvedVariables: uniqueUnresolved,
    totalLength: systemPrompt.length + userPrompt.length,
    featureConfigVersion: featureConfig.version,
  };
}

// ============================================================
// List Available Variables
// ============================================================

export function listAvailableVariables(
  featureKey: AIFeatureKey,
): Array<{ key: string; label: string; description: string }> {
  const meta = AI_FEATURE_META[featureKey];
  if (!meta) {
    return [];
  }
  return meta.availableVariables;
}

// ============================================================
// User Prompt Builder
// ============================================================

/**
 * Builds the user prompt from context. For most features, this is the
 * transcript/conversation data. Each feature can define how context
 * maps to the user prompt via its availableVariables.
 */
function buildUserPrompt(
  featureKey: AIFeatureKey,
  context: Record<string, unknown>,
  resolvedVariables: string[],
  unresolvedVariables: string[],
): string {
  const parts: string[] = [];

  // Transcript is the most common context — always include if present
  if (context.transcript) {
    parts.push(`--- HISTÓRICO DA CONVERSA ---\n${context.transcript}`);
  }

  // Temporal facts
  if (context.temporalFacts) {
    parts.push(`--- FATOS TEMPORAIS ---\n${context.temporalFacts}`);
  }

  // Lead context
  if (context.leadContext) {
    parts.push(`--- CONTEXTO DO LEAD ---\n${context.leadContext}`);
  }

  // Recent follow-ups
  if (context.recentFollowUps) {
    parts.push(`--- FOLLOW-UPS ANTERIORES ---\n${context.recentFollowUps}`);
  }

  // Commercial state
  if (context.commercialState) {
    parts.push(`--- ESTADO COMERCIAL ---\n${context.commercialState}`);
  }

  // Style profile
  if (context.styleProfile) {
    parts.push(`--- PERFIL DE ESTILO ---\n${context.styleProfile}`);
  }

  // Rewrite-specific
  if (context.originalText) {
    parts.push(`--- TEXTO ORIGINAL ---\n${context.originalText}`);
  }
  if (context.adjustment) {
    parts.push(`--- INSTRUÇÃO DE AJUSTE ---\n${context.adjustment}`);
  }
  if (context.tone) {
    parts.push(`--- TOM DESEJADO ---\n${context.tone}`);
  }

  // Suggest-specific
  if (context.draftText) {
    parts.push(`--- RASCUNHO DO USUÁRIO ---\n${context.draftText}`);
  }

  // Scenario-specific
  if (context.scenarioDescription) {
    parts.push(`--- CENÁRIO DE TESTE ---\n${context.scenarioDescription}`);
  }
  if (context.leadPersona) {
    parts.push(`--- PERSONA DO LEAD ---\n${context.leadPersona}`);
  }

  // Campaign-specific
  if (context.inboundMessage) {
    parts.push(`--- MENSAGEM RECEBIDA ---\n${context.inboundMessage}`);
  }
  if (context.campaignContext) {
    parts.push(`--- CONTEXTO DA CAMPANHA ---\n${context.campaignContext}`);
  }

  // Quick replies
  if (context.quickReplies) {
    parts.push(`--- RESPOSTAS RÁPIDAS ---\n${context.quickReplies}`);
  }

  // Similar situations
  if (context.similarSituations) {
    parts.push(`--- SITUAÇÕES SIMILARES ---\n${context.similarSituations}`);
  }

  // Validation feedback
  if (context.validationFeedback) {
    parts.push(`--- FEEDBACK DO VALIDADOR ---\n${context.validationFeedback}`);
  }

  // Pending follow-ups (agenda)
  if (context.pendingFollowUps) {
    parts.push(`--- FOLLOW-UPS PENDENTES ---\n${context.pendingFollowUps}`);
  }

  // Any remaining context keys not yet handled
  const handledKeys = new Set([
    'transcript', 'temporalFacts', 'leadContext', 'recentFollowUps',
    'commercialState', 'styleProfile', 'originalText', 'adjustment',
    'tone', 'draftText', 'scenarioDescription', 'leadPersona',
    'inboundMessage', 'campaignContext', 'quickReplies', 'similarSituations',
    'validationFeedback', 'pendingFollowUps', 'leadData', 'temporalContext',
    'suggestionMode', 'currentMessage', 'adjustmentInstruction',
    'conversationHistory', 'sellerName',
  ]);

  for (const [key, value] of Object.entries(context)) {
    if (!handledKeys.has(key) && value != null && value !== '') {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
      parts.push(`--- ${label.toUpperCase()} ---\n${String(value)}`);
    }
  }

  // Unresolved variables warning
  if (unresolvedVariables.length > 0) {
    parts.push(`[AVISO] Variáveis não resolvidas: ${unresolvedVariables.join(', ')}`);
  }

  return parts.join('\n\n');
}

// ============================================================
// Template Interpolation
// ============================================================

const VARIABLE_REGEX = /\{\{([a-zA-Z0-9_]+)\}\}/g;

function interpolateTemplate(
  template: string,
  context: Record<string, unknown>,
): { text: string; resolved: string[]; unresolved: string[] } {
  const resolved: string[] = [];
  const unresolved: string[] = [];

  const text = template.replace(VARIABLE_REGEX, (match, varName: string) => {
    const value = resolveVariable(varName, context);
    if (value !== undefined) {
      resolved.push(varName);
      return String(value);
    }
    unresolved.push(varName);
    return match; // Keep original {{var}} if not resolved
  });

  return { text, resolved, unresolved };
}

/**
 * Resolves a variable name from the context object.
 * Supports both camelCase and snake_case lookups.
 */
function resolveVariable(
  varName: string,
  context: Record<string, unknown>,
): unknown {
  // Direct lookup
  if (varName in context) {
    return context[varName];
  }

  // Try snake_case → camelCase conversion
  const camelCase = varName.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
  if (camelCase in context) {
    return context[camelCase];
  }

  // Try camelCase → snake_case conversion
  const snakeCase = varName.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
  if (snakeCase in context) {
    return context[snakeCase];
  }

  return undefined;
}
