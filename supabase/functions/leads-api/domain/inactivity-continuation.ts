type ContinuationAnchorInput = {
  triggerType: string;
  actionType: string;
  completedAt: Date;
  inheritedTriggerMessageAt: string | null;
};

/**
 * The next inactivity step starts its reply window after the automatic message
 * that just completed. Reusing the enrollment's original trigger makes that
 * very message look like a newer manual outbound and skips the continuation.
 */
export function resolveContinuationTriggerMessageAt({
  triggerType,
  actionType,
  completedAt,
  inheritedTriggerMessageAt,
}: ContinuationAnchorInput): string | null {
  if (triggerType !== 'inactivity_duration' || actionType !== 'send_message') {
    return inheritedTriggerMessageAt;
  }

  return completedAt.toISOString();
}
