/** One shared reactivation slot for a distinct conversation, never per message balloon.
 * Recalculate after each send using remaining same-day window and pending jobs.
 */
export type ReactivationFlowDemand = {
  remainingWindowSeconds: number;
  remainingDailySends: number;
  pendingSendJobs: number;
};

/**
 * Rate aggregation, not a hardcoded throttle:
 *   interval = 1 / Σ(min(remaining quota, pending jobs) / remaining window seconds)
 *
 * One flow, 08:00–17:00, 15 sends => 32400/15 = 2160 seconds (36 minutes).
 * Two flows with the same window and 15 + 10 sends => 1296 seconds (21m36s).
 * Return null rather than silently allowing unpaced sends with missing demand.
 */
export function calculateReactivationIntervalSeconds(
  flows: readonly ReactivationFlowDemand[],
): number | null {
  let sendsPerSecond = 0;
  for (const flow of flows) {
    const seconds = flow.remainingWindowSeconds;
    const available = Math.min(flow.remainingDailySends, flow.pendingSendJobs);
    if (!Number.isFinite(seconds) || seconds <= 0
      || !Number.isSafeInteger(available) || available <= 0) continue;
    sendsPerSecond += available / seconds;
  }
  if (sendsPerSecond <= 0 || !Number.isFinite(sendsPerSecond)) return null;
  return Math.max(60, Math.min(86400, Math.ceil(1 / sendsPerSecond)));
}
