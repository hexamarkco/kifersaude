import type { HTMLAttributes } from 'react';
import {
  AppearanceContext,
  type DesignSystemTheme,
} from '../appearanceContext';
import { cx } from '../../lib/cx';

export type DesignSystemProviderProps = HTMLAttributes<HTMLDivElement> & {
  theme?: DesignSystemTheme;
  workspace?: boolean;
  onThemeChange?: (theme: DesignSystemTheme) => void;
};

/** Shared theme boundary for application screens and their portal content. */
export function DesignSystemProvider({
  theme = 'light',
  workspace = false,
  onThemeChange,
  className,
  children,
  ...props
}: DesignSystemProviderProps) {
  return (
    <AppearanceContext.Provider value={{ theme, workspace, onThemeChange }}>
      <div
        className={cx(
          'painel-theme kifer-ds kds-operational',
          `theme-${theme}`,
          workspace && 'kds-workspace-theme',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </AppearanceContext.Provider>
  );
}
