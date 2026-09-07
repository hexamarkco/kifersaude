const DEFAULT_RECOVERY_DELAYS_MS = [0, 750, 1500] as const;

const wait = (delayMs: number): Promise<void> =>
  delayMs <= 0
    ? Promise.resolve()
    : new Promise((resolve) => window.setTimeout(resolve, delayMs));

/**
 * Gives a timed-out invocation a short reconciliation window. The Edge
 * Function can finish and persist its audit row after the browser has lost the
 * response, and that persisted result is safer to reuse than generating again.
 */
export const pollForCompletedFollowUp = async <Result>(
  lookup: () => Promise<Result | null>,
  delaysMs: readonly number[] = DEFAULT_RECOVERY_DELAYS_MS,
  waitForDelay: (delayMs: number) => Promise<void> = wait,
): Promise<Result | null> => {
  for (const delayMs of delaysMs) {
    await waitForDelay(delayMs);
    const recovered = await lookup().catch(() => null);
    if (recovered) {
      return recovered;
    }
  }

  return null;
};
