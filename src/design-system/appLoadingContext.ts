import { createContext, useContext, useLayoutEffect } from 'react';

import type { DesignSystemTheme } from './appearanceContext';

export const AppLoadingContext = createContext<{
  register: (theme?: DesignSystemTheme) => () => void;
  visible: boolean;
} | null>(null);

/** Let initial page data finish under an already-visible route fallback. */
export function useAppLoadingContinuation(loading: boolean) {
  const app = useContext(AppLoadingContext);
  const register = app?.register;
  const covered = app?.visible ?? false;

  useLayoutEffect(() => {
    if (loading && covered) return register?.();
  }, [loading, covered, register]);

  return covered;
}
