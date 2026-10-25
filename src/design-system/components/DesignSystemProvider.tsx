import type { HTMLAttributes } from 'react';
import {
  AppearanceContext,
  type DesignSystemTheme,
} from '../appearanceContext';
import { cx } from '../../lib/cx';

export type DesignSystemProviderProps = HTMLAttributes<HTMLDivElement> & {
  theme?: DesignSystemTheme;
};

/** Shared theme boundary for application screens and their portal content. */
export function DesignSystemProvider({
  theme = 'light',
  className,
  children,
  ...props
}: DesignSystemProviderProps) {
  return (
    <AppearanceContext.Provider value={{ theme }}>
      <div
        className={cx(
          'painel-theme kifer-ds kds-operational',
          `theme-${theme}`,
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </AppearanceContext.Provider>
  );
}
