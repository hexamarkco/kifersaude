import { useCallback, useEffect, useMemo, useState } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export type MotionPreset = 'premium' | 'balanced' | 'ultra-smooth';

type MotionProfile = 'full' | 'eco' | 'ultra' | 'minimal';

const MOTION_PRESET_STORAGE_KEY = 'painel.motion.preset.v2';
const MOTION_PRESET_QUERY_KEY = 'motion';
const MOTION_PRESET_EVENT = 'painel:motion-preset-change';

const DEFAULT_MOTION_PRESET: MotionPreset = 'ultra-smooth';
const PANEL_ROUTE_PREFIXES = ['/painel', '/app'] as const;

export const MOTION_PRESET_OPTIONS: ReadonlyArray<{
  value: MotionPreset;
  label: string;
  hint: string;
}> = [
  {
    value: 'premium',
    label: 'Premium',
    hint: 'Visual mais rico e transições mais expressivas.',
  },
  {
    value: 'balanced',
    label: 'Balanced',
    hint: 'Equilibrio entre aparência e fluidez.',
  },
  {
    value: 'ultra-smooth',
    label: 'Ultra',
    hint: 'Prioriza resposta rápida em todas as interações.',
  },
];

const isMotionPreset = (value: string | null | undefined): value is MotionPreset =>
  value === 'premium' || value === 'balanced' || value === 'ultra-smooth';

const getMotionPresetFromQuery = (): MotionPreset | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const value = params.get(MOTION_PRESET_QUERY_KEY);
  return isMotionPreset(value) ? value : null;
};

const isPanelWorkspaceRoute = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return PANEL_ROUTE_PREFIXES.some((prefix) => window.location.pathname.startsWith(prefix));
};

const getStoredMotionPreset = (): MotionPreset => {
  if (typeof window === 'undefined') {
    return DEFAULT_MOTION_PRESET;
  }

  const queryPreset = getMotionPresetFromQuery();
  if (queryPreset) {
    return queryPreset;
  }

  const storedPreset = window.localStorage.getItem(MOTION_PRESET_STORAGE_KEY);
  return isMotionPreset(storedPreset) ? storedPreset : DEFAULT_MOTION_PRESET;
};

export const setPanelMotionPreset = (preset: MotionPreset) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(MOTION_PRESET_STORAGE_KEY, preset);
  window.dispatchEvent(new CustomEvent<MotionPreset>(MOTION_PRESET_EVENT, { detail: preset }));
};

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

const getPresetBaseProfile = (preset: MotionPreset): MotionProfile => {
  if (preset === 'premium') {
    return 'full';
  }

  if (preset === 'ultra-smooth') {
    return 'ultra';
  }

  return 'eco';
};

const resolveMotionProfile = (
  prefersReducedMotion: boolean,
  isLowPowerDevice: boolean,
  prefersSaveData: boolean,
  motionPreset: MotionPreset,
  inPanelWorkspace: boolean,
): MotionProfile => {
  if (prefersReducedMotion) {
    return 'minimal';
  }

  if (inPanelWorkspace) {
    if (prefersSaveData || isLowPowerDevice) {
      return 'minimal';
    }

    return 'ultra';
  }

  const baseProfile = getPresetBaseProfile(motionPreset);

  if (baseProfile === 'full' && (prefersSaveData || isLowPowerDevice)) {
    return 'eco';
  }

  if (baseProfile === 'eco' && prefersSaveData) {
    return 'ultra';
  }

  if (baseProfile === 'ultra') {
    return 'ultra';
  }

  return baseProfile;
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
  const [inPanelWorkspace] = useState<boolean>(isPanelWorkspaceRoute);
  const [isLowPowerDevice] = useState<boolean>(getIsLowPowerDevice);
  const [prefersSaveData, setPrefersSaveData] = useState<boolean>(getPrefersSaveData);
  const [motionPreset, setMotionPresetState] = useState<MotionPreset>(getStoredMotionPreset);

  const setMotionPreset = useCallback((preset: MotionPreset) => {
    setMotionPresetState(preset);
    setPanelMotionPreset(preset);
  }, []);

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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const queryPreset = getMotionPresetFromQuery();
    if (queryPreset) {
      setMotionPresetState(queryPreset);
      window.localStorage.setItem(MOTION_PRESET_STORAGE_KEY, queryPreset);
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== MOTION_PRESET_STORAGE_KEY || !isMotionPreset(event.newValue)) {
        return;
      }

      setMotionPresetState(event.newValue);
    };

    const handlePresetEvent = (event: Event) => {
      const preset = (event as CustomEvent<MotionPreset>).detail;
      if (!isMotionPreset(preset)) {
        return;
      }

      setMotionPresetState(preset);
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(MOTION_PRESET_EVENT, handlePresetEvent as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(MOTION_PRESET_EVENT, handlePresetEvent as EventListener);
    };
  }, []);

  const profile = useMemo(
    () =>
      resolveMotionProfile(
        prefersReducedMotion,
        isLowPowerDevice,
        prefersSaveData,
        motionPreset,
        inPanelWorkspace,
      ),
    [inPanelWorkspace, isLowPowerDevice, motionPreset, prefersReducedMotion, prefersSaveData],
  );

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.dataset.motionProfile = profile;
    document.documentElement.dataset.motionPreset = motionPreset;
  }, [motionPreset, profile]);

  return useMemo(
    () => {
      const tokens = {
        full: {
          motionEnabled: true,
          ambientMotionEnabled: true,
          enterDuration: 0.36,
          sectionDuration: 0.46,
          sectionStagger: 0.042,
          microDuration: 0.24,
          revealDistance: 18,
          ease: 'power3.out',
        },
        eco: {
          motionEnabled: true,
          ambientMotionEnabled: false,
          enterDuration: 0.3,
          sectionDuration: 0.36,
          sectionStagger: 0.028,
          microDuration: 0.19,
          revealDistance: 12,
          ease: 'power2.out',
        },
        ultra: {
          motionEnabled: true,
          ambientMotionEnabled: false,
          enterDuration: 0.2,
          sectionDuration: 0.25,
          sectionStagger: 0.016,
          microDuration: 0.14,
          revealDistance: 8,
          ease: 'power1.out',
        },
        minimal: {
          motionEnabled: false,
          ambientMotionEnabled: false,
          enterDuration: 0.01,
          sectionDuration: 0.01,
          sectionStagger: 0,
          microDuration: 0.01,
          revealDistance: 0,
          ease: 'none',
        },
      } as const;

      return {
        ...tokens[profile],
        profile,
        motionPreset,
        setMotionPreset,
      };
    },
    [motionPreset, profile, setMotionPreset],
  );
}
