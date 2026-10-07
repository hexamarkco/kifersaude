import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import { loadGlobalConfig, type ResolvedAIFeatureConfig, type ResolvedAIGlobalConfig } from './ai-config-resolver.ts';
import { AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS, buildReferencePrompt, buildStylePrompt, type QuickReplyRef } from './ai-autonomous-helpers.ts';
import type { MessageRow } from './comm-whatsapp-transcript.ts';

export type AutonomousStyleMessage = MessageRow & { created_by: string | null; metadata: unknown };

export const selectHumanStyleMessages = (messages: readonly AutonomousStyleMessage[]): AutonomousStyleMessage[] => (
  messages.filter((message) => {
    if (!message.created_by || message.direction !== 'outbound' || message.delivery_status === 'failed') return false;
    const metadata = message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)
      ? message.metadata as Record<string, unknown> : {};
    return !metadata.automation && !String(metadata.provider ?? '').startsWith('ai_');
  })
);

export const buildAutonomousSystemPrompt = (params: {
  config: ResolvedAIFeatureConfig;
  globals: { instructions: ResolvedAIGlobalConfig | null; style: ResolvedAIGlobalConfig | null };
  styleMessages: readonly AutonomousStyleMessage[];
  quickReplies: QuickReplyRef[];
}): string => [
  params.config.useGlobalInstructions ? params.globals.instructions?.content : '',
  params.config.useGlobalStyle ? params.globals.style?.content : '',
  params.config.featurePrompt,
  params.config.outputInstructions,
  params.config.useGlobalStyle ? buildStylePrompt(selectHumanStyleMessages(params.styleMessages)) : '',
  // Similar-situation retrieval does not identify human authors. Do not feed
  // autonomous responses back into the attendant as examples of human style.
  buildReferencePrompt(params.quickReplies, []),
  AUTONOMOUS_CONVERSATION_QUALITY_GUARDRAILS,
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
