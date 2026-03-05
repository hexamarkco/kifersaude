import { useEffect, useState } from 'react';

export type AdaptiveLoadingPhase = 'hidden' | 'bar' | 'skeleton';

type AdaptiveLoadingOptions = {
  barDelayMs?: number;
  skeletonDelayMs?: number;
};

const DEFAULT_BAR_DELAY = 300;
const DEFAULT_SKELETON_DELAY = 1200;

export function useAdaptiveLoading(
  loading: boolean,
  options: AdaptiveLoadingOptions = {},
) {
  const { barDelayMs = DEFAULT_BAR_DELAY, skeletonDelayMs = DEFAULT_SKELETON_DELAY } = options;
  const [phase, setPhase] = useState<AdaptiveLoadingPhase>('hidden');

  useEffect(() => {
    let barTimeout: number | undefined;
    let skeletonTimeout: number | undefined;

    if (loading) {
      setPhase('hidden');
      barTimeout = window.setTimeout(() => {
        setPhase('bar');
      }, barDelayMs);

      skeletonTimeout = window.setTimeout(() => {
        setPhase('skeleton');
      }, skeletonDelayMs);
    } else {
      setPhase('hidden');
    }

    return () => {
      if (barTimeout !== undefined) {
        window.clearTimeout(barTimeout);
      }
      if (skeletonTimeout !== undefined) {
        window.clearTimeout(skeletonTimeout);
      }
    };
  }, [barDelayMs, loading, skeletonDelayMs]);

  return {
    phase,
    showBar: phase === 'bar' || phase === 'skeleton',
    showSkeleton: phase === 'skeleton',
  };
}
