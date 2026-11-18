import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import { loadFeatureConfig } from '../ai-config-resolver.ts';
import { AI_FEATURES } from '../ai-feature-registry.ts';
import { generateTextForFeature, type RuntimeModelProfile } from '../ai-router.ts';
import { decisionTrace } from './domain/decision.ts';
import { isRecord, type V2Message } from './domain/state.ts';
import { restoreV2State, resumePreparedTurn, runV2Turn, stateAfterSend, type V2Turn } from './domain/turn.ts';
import type { StyleLibrary } from './domain/style.ts';

export async function generateAttendanceTurn(params: {
  client: SupabaseClient; chatId: string; leadId: string; sourceId: string; messages: V2Message[];
  previousMemory: unknown; lead: { nome_completo?: string | null; cidade?: string | null; estado?: string | null; operadora_atual?: string | null };
  advisorName?: string; sandbox?: boolean;
  deployment?: { version: string; modelProfile: RuntimeModelProfile; styleLibrary: StyleLibrary; splitReplies: boolean };
  record: (eventType: string, decision: Record<string, unknown>) => Promise<void>;
}) {
  const config = await loadFeatureConfig(params.client, AI_FEATURES.AUTONOMOUS_REPLY);
  const base = { supabaseAdmin: params.client, featureKey: AI_FEATURES.AUTONOMOUS_REPLY, task: 'autonomous_attendance' as const,
    edgeFunction: params.sandbox ? 'ai-sandbox-chat' : 'ai-autonomous-reply-worker',
    ...(params.sandbox ? {} : { leadId: params.leadId, chatId: params.chatId, messageId: params.sourceId }),
    maxAttempts: 2, maxProviderRequestsPerAttempt: 1, retrySameResolvedModel: true, attemptTimeoutMs: 30_000 };
  let durationMs = 0;
  let retryCount = 0;
  let estimatedCostUsd: number | null = 0;
  let v2: V2Turn;
  let messages: string[];
  let generationConfigVersion = config.version;
  let failedStage: 'interpret' | 'write' = 'interpret';
  let reusedPreparedTurn = false;
  const prior = restoreV2State(params.previousMemory, { city: params.lead.cidade ?? undefined,
    state: params.lead.estado ?? undefined, currentOperator: params.lead.operadora_atual ?? undefined }, new Date().toISOString());
  try {
    const prepared = resumePreparedTurn(params.previousMemory, params.sourceId, params.advisorName);
    reusedPreparedTurn = prepared !== null;
    if (prepared && isRecord(params.previousMemory) && typeof params.previousMemory.v2ConfigVersion === 'number') generationConfigVersion = params.previousMemory.v2ConfigVersion;
    v2 = prepared ?? await runV2Turn({ messages: params.messages, previous: prior, now: new Date().toISOString(),
      configVersion: config.version, advisorName: params.advisorName, styleLibrary: params.deployment?.styleLibrary,
      allowSplitReplies: params.deployment?.splitReplies,
      generate: async (request) => {
        failedStage = request.stage;
        const result = await generateTextForFeature({ ...base, systemPrompt: request.systemPrompt, userPrompt: request.userPrompt,
          attemptTimeoutMs: 60_000,
          temperature: request.stage === 'interpret' ? 0 : config.temperature,
          maxTokens: request.stage === 'interpret' ? 3200 : 500,
          runtimeModelProfile: params.deployment?.modelProfile,
          promptCacheKey: `autonomous-v2-${request.stage}-${params.deployment?.version ?? '2026-11-14'}`,
          validateOutput: (text) => {
            try { request.validate(text); return { valid: true }; }
            catch { return { valid: false, stopReason: 'invalid_output', message: 'Saída incompatível com o contrato V2. Corrija JSON, evidências e ação autorizada.' }; }
          },
        });
        durationMs += result.durationMs;
        retryCount += result.retryCount;
        estimatedCostUsd = estimatedCostUsd === null || result.estimatedCostUsd === null ? null : estimatedCostUsd + result.estimatedCostUsd;
        return result.text;
      },
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : '';
    const reason = /(?:timeout|tempo limite|timed out|abort(?:ed)?)/i.test(details)
      ? 'provider_timeout' : /(?:json|saída|saida|interpreta|observa|contrato|formato|invalid|rejeitad)/i.test(details)
      ? 'interpretation_or_output_rejected' : 'v2_generation_failed';
    await params.record('v2_processing_failed', { engine: 'v2', configVersion: config.version, stage: failedStage, reason });
    throw error;
  }
  await params.record('v2_decision', decisionTrace(v2.state, v2.decision, generationConfigVersion));
  const storedContext = isRecord(params.previousMemory) && isRecord(params.previousMemory.v2Context) ? params.previousMemory.v2Context : undefined;
  const v2Context = reusedPreparedTurn ? storedContext : params.deployment ? {
    deploymentVersion: params.deployment.version, model: params.deployment.modelProfile.model,
    reasoningEffort: params.deployment.modelProfile.reasoningEffort,
    styleLibraryVersion: v2.styleTrace?.libraryVersion ?? null, referenceIds: v2.styleTrace?.referenceIds ?? [],
  } : undefined;
  if (v2Context) await params.record('v2_context', { ...v2Context, reusedPreparedTurn });
  const storedMessages = isRecord(params.previousMemory) ? params.previousMemory.v2Messages : undefined;
  if (reusedPreparedTurn && storedMessages !== undefined) {
    if (!Array.isArray(storedMessages) || storedMessages.length < 1 || storedMessages.length > 2
      || !storedMessages.every((message) => typeof message === 'string' && message.trim()) || storedMessages.join('\n\n') !== v2.text) {
      throw new Error('Turno preparado V2 inválido.');
    }
    messages = [...storedMessages];
  } else messages = params.deployment?.splitReplies ? v2.text.split(/\n\s*\n/).map((text) => text.trim()).filter(Boolean) : [v2.text];
  const memory: Record<string, unknown> = { ...(isRecord(params.previousMemory) ? params.previousMemory : {}), schemaVersion: 2,
    source_message_id: params.sourceId, source_message_at: params.messages.find((message) => message.id === params.sourceId)?.messageAt,
    attendanceV2: v2.state, briefing: v2.briefing, v2Decision: v2.decision, v2Reply: v2.text, v2ConfigVersion: generationConfigVersion,
    v2Messages: messages, ...(v2Context ? { v2Context } : {}) };
  const handoffCode = v2.decision.handoffCode;
  return { memory, messages, handoffCode, durationMs, retryCount, estimatedCostUsd,
    memoryAfterSend: { ...memory, attendanceV2: stateAfterSend(v2) } };
}
