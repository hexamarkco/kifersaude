import type { DesignSystemTheme } from './appearanceContext';

export const PANEL_THEME_STORAGE_KEY = 'painel.theme.v2';

export function readPanelTheme(): DesignSystemTheme {
  if (typeof window === 'undefined') return 'light';

  try {
    return window.localStorage.getItem(PANEL_THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}
