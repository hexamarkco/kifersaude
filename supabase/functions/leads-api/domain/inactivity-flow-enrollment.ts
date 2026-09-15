const LEGACY_FLOW_MESSAGE_MATCH_WINDOW_MS = 5 * 60 * 1000;

export type AutoContactOutboundMessage = {
  source: string | null;
  metadata: unknown;
  messageAt: string;
  completedSendJobAt?: string | null;
};

const getAutomationFlowId = (metadata: unknown): string | null => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;

  const flowId = (metadata as Record<string, unknown>).automation_flow_id;
  return typeof flowId === 'string' && flowId.trim() ? flowId.trim() : null;
};

/**
 * Returns true when an outbound message was produced by this same flow.
 * Older message rows did not store the flow id, so their completed send job
 * timestamp is used as a bounded fallback attribution signal.
 */
export function isAutoContactFlowOutputMessage({
  source,
  metadata,
  messageAt,
  completedSendJobAt,
}: AutoContactOutboundMessage, flowId: string): boolean {
  if (source !== 'auto_contact') return false;

  const messageFlowId = getAutomationFlowId(metadata);
  if (messageFlowId) return messageFlowId === flowId;
  if (!completedSendJobAt) return false;

  const messageTime = Date.parse(messageAt);
  const jobTime = Date.parse(completedSendJobAt);
  return Number.isFinite(messageTime)
    && Number.isFinite(jobTime)
    && Math.abs(messageTime - jobTime) <= LEGACY_FLOW_MESSAGE_MATCH_WINDOW_MS;
}

export const LEGACY_AUTO_CONTACT_FLOW_MESSAGE_MATCH_WINDOW_MS = LEGACY_FLOW_MESSAGE_MATCH_WINDOW_MS;
