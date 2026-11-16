import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import { buildSandboxApproachMessages } from './auto-contact-approach.ts';
import { generateAttendanceTurn } from './autonomous-attendance-v2/generate-turn.ts';
import { V2_ADVISOR_NAME, V2_DEPLOYMENT_VERSION, V2_MODEL_PROFILE, V2_STYLE_LIBRARY } from './autonomous-attendance-v2/deployment.ts';
import { isRecord, type V2Message } from './autonomous-attendance-v2/domain/state.ts';
import { groupV2ReplyMessages } from './autonomous-attendance-v2/domain/rollout.ts';
import type { HandoffCode } from './ai-autonomous-helpers.ts';

type SandboxMessage = { id: string; role: 'ai' | 'lead'; content: string; created_at: string; handoff_code: string | null };
export async function generateSandboxReply(params: {
  client: SupabaseClient; conversationId: string; leadName?: string; advisorName?: string; startWithApproach?: boolean;
}) {
  const { client, conversationId } = params;
  const conversation = await client.from('ai_sandbox_conversations').select('attendance_state').eq('id', conversationId).maybeSingle();
  if (conversation.error) throw new Error('Não foi possível recuperar a memória do teste.');
  if (!conversation.data) throw new Error('Conversa de teste não encontrada.');
  // Load all sandbox messages. The engine retains persistent facts and controls its own context window.
  const history: SandboxMessage[] = [];
  for (let offset = 0; ; offset += 500) {
    const result = await client.from('ai_sandbox_messages').select('id, role, content, created_at, handoff_code')
      .eq('conversation_id', conversationId).order('created_at', { ascending: true }).order('id', { ascending: true }).range(offset, offset + 499);
    if (result.error) throw new Error('Não foi possível carregar o histórico do teste.');
    const rows = (result.data ?? []) as SandboxMessage[];
    history.push(...rows);
    if (rows.length < 500) break;
  }
  const envelope = { success: true, conversationId, engine: 'v2', deploymentVersion: V2_DEPLOYMENT_VERSION,
    provider: 'openai', model: V2_MODEL_PROFILE.model, reasoningEffort: V2_MODEL_PROFILE.reasoningEffort, fallbackUsed: false };
  if (history.some(row => row.role === 'ai' && row.handoff_code))
    return { ...envelope, messages: [] as string[], handoffCode: null, handoffReason: null, alreadyHandedOff: true, skipped: false };
  const latest = history.at(-1);
  if (latest && latest.role !== 'lead')
    return { ...envelope, messages: [] as string[], handoffCode: null, handoffReason: null, alreadyHandedOff: false, skipped: true };
  const previousMemory: unknown = conversation.data.attendance_state;
  let memory = previousMemory;
  let messages: string[];
  let handoffCode: HandoffCode | null = null;
  let handoffReason: string | null = null;
  if (!latest) {
    const integration = await client.from('integration_settings').select('settings').eq('slug', 'whatsapp_auto_contact').maybeSingle();
    if (integration.error) throw new Error('Não foi possível carregar a abordagem configurada.');
    messages = buildSandboxApproachMessages(integration.data?.settings, params.leadName ?? '');
  } else {
    // Consecutive bubbles are one logical turn, exactly as in the WhatsApp worker.
    let deliveryGroup = 'opening';
    const promptMessages: V2Message[] = groupV2ReplyMessages(history.map(row => {
      if (row.role === 'lead') deliveryGroup = row.id;
      return { id: row.id, role: row.role, content: row.content, messageAt: row.created_at, receivedAt: row.created_at,
        deliveryGroup: row.role === 'ai' ? deliveryGroup : undefined };
    }));
    const turn = await generateAttendanceTurn({ client, chatId: conversationId, leadId: conversationId, sourceId: latest.id,
      messages: promptMessages, previousMemory, lead: { nome_completo: params.leadName }, styleMessages: [], quickReplies: [],
      allowlist: conversationId, advisorName: params.advisorName || V2_ADVISOR_NAME, sandbox: true,
      deployment: { version: V2_DEPLOYMENT_VERSION, modelProfile: V2_MODEL_PROFILE, styleLibrary: V2_STYLE_LIBRARY, splitReplies: true },
      record: async () => { /* Test state is stored only in ai_sandbox_conversations, never in real attendance events. */ },
    });
    memory = turn.memoryAfterSend;
    messages = turn.messages;
    handoffCode = turn.handoffCode;
    const decision = isRecord(memory) && isRecord(memory.v2Decision) ? memory.v2Decision : null;
    handoffReason = handoffCode && decision && typeof decision.reason === 'string' ? decision.reason : null;
  }
  const saved = await client.rpc('commit_ai_sandbox_turn', { p_conversation_id: conversationId,
    p_source_message_id: latest?.id ?? null, p_expected_state: previousMemory, p_state: memory,
    p_messages: messages.map((content, index) => ({ content, handoff_code: index === messages.length - 1 ? handoffCode : null,
      handoff_reason: index === messages.length - 1 ? handoffReason : null,
      provider: latest ? envelope.provider : null, model: latest ? envelope.model : null })) });
  if (saved.error) throw new Error('Não foi possível salvar a resposta e a memória do teste.');
  return { ...envelope, messages: saved.data === 'saved' ? messages : [],
    handoffCode: saved.data === 'saved' ? handoffCode : null, handoffReason: saved.data === 'saved' ? handoffReason : null,
    alreadyHandedOff: saved.data === 'handed_off', skipped: saved.data !== 'saved' };
}
