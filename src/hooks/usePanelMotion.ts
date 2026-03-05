import { useEffect, useMemo, useState } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

type MotionProfile = 'full' | 'eco' | 'minimal';

type NavigatorConnection = {
  saveData?: boolean;
  addEventListener?: (type: 'change', listener: () => void) => void;
  removeEventListener?: (type: 'change', listener: () => void) => void;
};

const getNavigatorConnection = (): NavigatorConnection | null => {
  if (typeof navigator === 'undefined') {
    return null;
  }

  const nav = navigator as Navigator & { connection?: NavigatorConnection };
  return nav.connection ?? null;
};

const getIsLowPowerDevice = () => {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : 8;

  return cores <= 4 || memory <= 4;
};

const getPrefersSaveData = () => {
  const connection = getNavigatorConnection();
  return Boolean(connection?.saveData);
};

const resolveMotionProfile = (
  prefersReducedMotion: boolean,
  isLowPowerDevice: boolean,
  prefersSaveData: boolean,
): MotionProfile => {
  if (prefersReducedMotion) {
    return 'minimal';
  }

  if (prefersSaveData || isLowPowerDevice) {
    return 'eco';
  }

  return 'full';
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
  const [prefersSaveData, setPrefersSaveData] = useState<boolean>(getPrefersSaveData);

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

  useEffect(() => {
    const connection = getNavigatorConnection();
    if (!connection || typeof connection.addEventListener !== 'function') {
      return;
    }

    const syncSaveDataPreference = () => {
      setPrefersSaveData(Boolean(connection.saveData));
    };

    connection.addEventListener('change', syncSaveDataPreference);
    return () => {
      connection.removeEventListener?.('change', syncSaveDataPreference);
    };
  }, []);

  const profile = useMemo(
    () => resolveMotionProfile(prefersReducedMotion, isLowPowerDevice, prefersSaveData),
    [isLowPowerDevice, prefersReducedMotion, prefersSaveData],
  );

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.dataset.motionProfile = profile;
  }, [profile]);

  return useMemo(
    () => ({
      motionEnabled: profile !== 'minimal',
      ambientMotionEnabled: profile === 'full',
      profile,
      enterDuration: profile === 'minimal' ? 0.01 : profile === 'eco' ? 0.24 : 0.34,
      sectionDuration: profile === 'minimal' ? 0.01 : profile === 'eco' ? 0.28 : 0.4,
      sectionStagger: profile === 'minimal' ? 0 : profile === 'eco' ? 0.02 : 0.036,
      microDuration: profile === 'minimal' ? 0.01 : profile === 'eco' ? 0.16 : 0.22,
      revealDistance: profile === 'minimal' ? 0 : profile === 'eco' ? 10 : 16,
      ease: profile === 'full' ? 'power3.out' : 'power2.out',
    }),
    [profile],
  );
}
