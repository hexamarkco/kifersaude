import { useEffect, useMemo, useState } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

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
      enterDuration: prefersReducedMotion ? 0.01 : 0.58,
      sectionDuration: prefersReducedMotion ? 0.01 : 0.72,
      sectionStagger: prefersReducedMotion ? 0 : 0.09,
      ease: 'power3.out',
    }),
    [prefersReducedMotion],
  );
}
