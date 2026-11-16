export type V2Rollout = { enabledAt: string | null; percentage: number; ddd: string | null; includeExisting?: boolean };

type RolloutInput = { leadId: string; leadCreatedAt: string | null | undefined;
  chatCreatedAt: string | null | undefined; phone: string | null | undefined; rollout: V2Rollout; legacyStarted?: boolean;
  messageReceivedAt?: string; hasV2State?: boolean };

/** Stable cohort assignment; all dates and contact permissions are still checked by the worker. */
export function inV2Rollout(input: RolloutInput): boolean {
  const { rollout } = input;
  if (!rollout.enabledAt || !Number.isFinite(Date.parse(rollout.enabledAt)) || !Number.isInteger(rollout.percentage)
    || rollout.percentage < 1 || rollout.percentage > 100
    || (rollout.ddd !== null && !/^\d{2}$/.test(rollout.ddd)) || !input.leadId) return false;
  const start = Date.parse(rollout.enabledAt);
  if (rollout.includeExisting) {
    if (!input.hasV2State && (!input.messageReceivedAt || !Number.isFinite(Date.parse(input.messageReceivedAt)) || Date.parse(input.messageReceivedAt) < start)) return false;
  } else if (input.legacyStarted || !input.leadCreatedAt || !input.chatCreatedAt || !Number.isFinite(Date.parse(input.leadCreatedAt))
    || !Number.isFinite(Date.parse(input.chatCreatedAt)) || Date.parse(input.leadCreatedAt) < start || Date.parse(input.chatCreatedAt) < start) return false;
  if (rollout.ddd !== null) {
    let phone = (input.phone ?? '').replace(/\D/g, '');
    if ((phone.length === 12 || phone.length === 13) && phone.startsWith('55')) phone = phone.slice(2);
    if (![10, 11].includes(phone.length) || !phone.startsWith(rollout.ddd)) return false;
  }
  let bucket = 2166136261;
  for (const character of input.leadId) bucket = Math.imul(bucket ^ character.charCodeAt(0), 16777619) >>> 0;
  return bucket % 100 < rollout.percentage;
}

/** A full replacement never falls back to V1, including while paused or awaiting a fresh inbound. */
export function selectAutonomousEngine(input: RolloutInput & { paused: boolean; allowlisted?: boolean }): 'v2' | 'legacy' | 'wait' {
  if (!input.paused && (input.allowlisted || inV2Rollout(input))) return 'v2';
  if (input.hasV2State || (input.rollout.percentage === 100 && input.rollout.ddd === null)) return 'wait';
  return 'legacy';
}

/** Rebuild the V2 logical turns from the persisted per-bubble idempotency keys. */
export function groupV2ReplyMessages<T extends { id: string; role: 'ai' | 'lead'; content: string; deliveryGroup?: string }>(messages: readonly T[]): T[] {
  const grouped: T[] = [];
  for (const message of messages) {
    const previous = grouped.at(-1);
    if (message.role === 'ai' && message.deliveryGroup && previous?.role === 'ai' && previous.deliveryGroup === message.deliveryGroup) {
      previous.content += `\n\n${message.content}`;
    } else grouped.push({ ...message });
  }
  return grouped;
}
