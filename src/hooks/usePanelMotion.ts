import { useEffect, useMemo, useState } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

const getIsLowPowerDevice = () => {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const cores = navigator.hardwareConcurrency ?? 4;
  return cores <= 4;
};

const getPrefersReducedMotion = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
};

export function usePanelMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(
    getPrefersReducedMotion,
  );
  const [isLowPowerDevice] = useState<boolean>(getIsLowPowerDevice);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);

      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }

    mediaQuery.addListener(handleChange);
    return () => {
      mediaQuery.removeListener(handleChange);
    };
  }, []);

  return useMemo(
    () => ({
      motionEnabled: !prefersReducedMotion,
      enterDuration: prefersReducedMotion ? 0.01 : isLowPowerDevice ? 0.2 : 0.28,
      sectionDuration: prefersReducedMotion ? 0.01 : isLowPowerDevice ? 0.24 : 0.34,
      sectionStagger: prefersReducedMotion ? 0 : isLowPowerDevice ? 0.014 : 0.028,
      ease: 'power2.out',
    }),
    [isLowPowerDevice, prefersReducedMotion],
  );
}
