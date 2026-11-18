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
