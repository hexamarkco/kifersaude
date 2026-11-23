import { createContext, useContext } from 'react';

export type DesignSystemTheme = 'light' | 'dark';
export const AppearanceContext = createContext<{
  theme: DesignSystemTheme;
  workspace: boolean;
  onThemeChange?: (theme: DesignSystemTheme) => void;
} | null>(null);
export function useDesignSystemAppearance() {
  return useContext(AppearanceContext);
}
