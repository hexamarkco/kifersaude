import { createContext, useContext } from 'react';

export type DesignSystemTheme = 'light' | 'dark';
export const AppearanceContext = createContext<{
  theme: DesignSystemTheme;
} | null>(null);
export function useDesignSystemAppearance() {
  return useContext(AppearanceContext);
}
