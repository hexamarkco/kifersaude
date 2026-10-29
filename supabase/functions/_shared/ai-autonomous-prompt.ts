import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import { loadGlobalConfig, type ResolvedAIFeatureConfig, type ResolvedAIGlobalConfig } from './ai-config-resolver.ts';
import { AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, buildReferencePrompt, buildStylePrompt, type QuickReplyRef } from './ai-autonomous-helpers.ts';
import type { MessageRow } from './comm-whatsapp-transcript.ts';

export type AutonomousStyleMessage = MessageRow & { created_by: string | null; metadata: unknown };

// Remove only known obsolete instructions, sentence by sentence. Preserve local
// preferences without allowing the old playbook to compete with runtime policy.
export const sanitizeAutonomousPreferences = (content: string): string => content
  .replace(/\\n/g, '\n')
  .split(/(?<=[.!?])\s+|\n/)
  .filter((sentence) => !/colete tamb[eé]m o bairro|bairro quando necess[aá]rio|cnpj ou mei pertence aos benefici[aá]rios|se o plano for para um filho, pergunte pelo filho|perfeito, nick|j[aá] consegui as informa[cç][oõ]es que precisava/i.test(sentence))
  .join('\n');

export const selectHumanStyleMessages = (messages: readonly AutonomousStyleMessage[]): AutonomousStyleMessage[] => (
  messages.filter((message) => {
    if (!message.created_by || message.direction !== 'outbound' || message.message_type !== 'text' || message.delivery_status === 'failed') return false;
    const text = message.text_content?.trim() ?? '';
    if (text.length < 12 || text.length > 320 || /https?:|\b(?:pix|cpf|boleto)\b|\[\[HANDOFF|\d{6,}/i.test(text)) return false;
    const metadata = message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)
      ? message.metadata as Record<string, unknown> : {};
    return !metadata.automation && !metadata.ai_generated && !String(metadata.provider ?? '').startsWith('ai_');
  }).filter((message, index, selected) => selected.findIndex((row) => row.text_content?.trim() === message.text_content?.trim()) === index)
    .sort((a, b) => b.message_at.localeCompare(a.message_at)).slice(0, 6)
);

export const buildAutonomousSystemPrompt = (params: {
  config: ResolvedAIFeatureConfig;
  globals: { instructions: ResolvedAIGlobalConfig | null; style: ResolvedAIGlobalConfig | null };
  styleMessages: readonly AutonomousStyleMessage[];
  quickReplies: QuickReplyRef[];
}): string => [
  AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS,
  'PREFERENCIAS CONFIGURAVEIS. Aplique apenas quando compativeis com as regras operacionais acima. Nomes em exemplos nao identificam o cliente nem mudam a identidade do atendimento.',
  params.config.useGlobalInstructions ? sanitizeAutonomousPreferences(params.globals.instructions?.content ?? '') : '',
  params.config.useGlobalStyle ? sanitizeAutonomousPreferences(params.globals.style?.content ?? '') : '',
  sanitizeAutonomousPreferences(params.config.featurePrompt),
  sanitizeAutonomousPreferences(params.config.outputInstructions),
  params.config.useGlobalStyle ? buildStylePrompt(selectHumanStyleMessages(params.styleMessages)) : '',
  // Similar-situation retrieval does not identify human authors. Do not feed
  // autonomous responses back into the attendant as examples of human style.
  buildReferencePrompt(params.quickReplies, []),
].filter(Boolean).join('\n\n');

export const composeAutonomousPrompt = async (params: {
  supabaseAdmin: SupabaseClient;
  config: ResolvedAIFeatureConfig;
  styleMessages: readonly AutonomousStyleMessage[];
  quickReplies: QuickReplyRef[];
}) => {
  const [instructions, style] = await Promise.all([
    params.config.useGlobalInstructions ? loadGlobalConfig(params.supabaseAdmin, 'global_instructions') : null,
    params.config.useGlobalStyle ? loadGlobalConfig(params.supabaseAdmin, 'global_style') : null,
  ]);
  const systemPrompt = buildAutonomousSystemPrompt({ ...params, globals: { instructions, style } });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(systemPrompt));
  const trace = {
    featureConfigVersion: params.config.version,
    globalInstructionsRevision: instructions?.version ?? null,
    globalStyleRevision: style?.version ?? null,
    humanStyleCount: params.config.useGlobalStyle ? selectHumanStyleMessages(params.styleMessages).length : 0,
    systemPromptLength: systemPrompt.length,
    systemPromptHash: Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(''),
  };
  console.log('[autonomous-prompt] composition', trace);
  return { systemPrompt, trace };
};
