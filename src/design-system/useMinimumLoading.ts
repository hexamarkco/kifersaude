import { useEffect, useRef, useState } from 'react';

export const LOADING_CYCLE_MS = 2400;

/** Keep a visible indicator mounted long enough to complete its first cycle. */
export function useMinimumLoading(loading: boolean, enabled = true): boolean {
  const startedAt = useRef<number | null>(null);
  const [visible, setVisible] = useState(loading);

  useEffect(() => {
    if (!enabled) {
      startedAt.current = null;
      setVisible(false);
      return;
    }
    if (loading) {
      startedAt.current ??= performance.now();
      setVisible(true);
      return;
    }

    if (startedAt.current === null) return;

    const finish = () => {
      startedAt.current = null;
      setVisible(false);
    };
    const remaining = LOADING_CYCLE_MS - (performance.now() - startedAt.current);
    if (remaining <= 0) {
      finish();
      return;
    }

    const timeout = window.setTimeout(finish, Math.ceil(remaining));
    return () => window.clearTimeout(timeout);
  }, [enabled, loading]);

  return enabled && (loading || visible);
}
