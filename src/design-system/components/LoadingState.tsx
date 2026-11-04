import { RefreshCw } from 'lucide-react';
import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type HTMLAttributes, type ReactNode } from 'react';

import { cx } from '../../lib/cx';
import { AppLoadingContext } from '../appLoadingContext';
import { useDesignSystemAppearance, type DesignSystemTheme } from '../appearanceContext';
import { readPanelTheme } from '../themePreference';
import type { ControlSize } from '../tokens';
import { useMinimumLoading } from '../useMinimumLoading';
import Button from './Button';
import { DesignSystemProvider } from './DesignSystemProvider';
import { LoadingMonogram } from './LoadingMonogram';

export type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  /** Hides the decorative placeholder from assistive technologies by default. */
  label?: string;
  variant?: 'block' | 'line' | 'control' | 'avatar' | 'card' | 'table-row';
  size?: ControlSize;
};

export function Skeleton({ className, label, variant = 'line', size = 'md', ...props }: SkeletonProps) {
  return (
    <div
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cx('kds-skeleton', `kds-skeleton-${variant}`, `kds-skeleton-${size}`, className)}
      {...props}
    />
  );
}

export type LoadingStateProps = HTMLAttributes<HTMLDivElement> & {
  label?: ReactNode;
  description?: ReactNode;
  compact?: boolean;
  active?: boolean;
  fallback?: () => ReactNode;
  /** Places a larger monogram above the label. */
  indicator?: 'brand';
};

export function LoadingState({
  label = 'Carregando',
  description,
  compact = false,
  active,
  fallback,
  indicator,
  className,
  ...props
}: LoadingStateProps) {
  const visible = useMinimumLoading(active === true);
  if (active !== undefined && !visible) return fallback?.() ?? null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cx(
        'kds-loading-state',
        compact && 'kds-loading-state-compact',
        indicator === 'brand' && 'kds-loading-state-brand',
        className,
      )}
      {...props}
    >
      <LoadingMonogram />
      <div>
        <p className="kds-loading-state-label">{label}</p>
        {description && <p className="kds-loading-state-description">{description}</p>}
      </div>
    </div>
  );
}

export type AppLoadingScreenProps = {
  className?: string;
  theme?: DesignSystemTheme;
};

const APP_LOADING_STALL_MS = 8000;

export function AppLoadingBoundary({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<{ count: number; theme: DesignSystemTheme }>({ count: 0, theme: 'light' });
  const register = useCallback((theme?: DesignSystemTheme) => {
    setPending((current) => ({ count: current.count + 1, theme: theme ?? current.theme }));
    return () => setPending((current) => ({ ...current, count: current.count - 1 }));
  }, []);
  const visible = useMinimumLoading(pending.count > 0);
  const context = useMemo(() => ({ register, visible }), [register, visible]);

  return (
    <AppLoadingContext.Provider value={context}>
      <div hidden={visible} className={visible ? undefined : 'contents'}>{children}</div>
      {visible && <AppLoadingView theme={pending.theme} />}
    </AppLoadingContext.Provider>
  );
}

/**
 * Full-screen fallback for route chunks, session checks and panel startup.
 * A prolonged wait offers a recovery action while keeping the same indicator.
 */
export function AppLoadingScreen({ className, theme }: AppLoadingScreenProps) {
  const appearance = useDesignSystemAppearance();
  const register = useContext(AppLoadingContext)?.register;
  const resolvedTheme = theme ?? appearance?.theme ?? readPanelTheme();

  useLayoutEffect(() => register?.(resolvedTheme), [register, resolvedTheme]);

  return register ? null : <AppLoadingView className={className} theme={resolvedTheme} />;
}

function AppLoadingView({ className, theme }: AppLoadingScreenProps) {
  const [isStalled, setIsStalled] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setIsStalled(true), APP_LOADING_STALL_MS);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <DesignSystemProvider
      theme={theme}
      className={cx(
        'flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] px-4',
        className,
      )}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <LoadingState
          compact
          indicator="brand"
          label={isStalled ? 'Isso está demorando mais que o esperado' : 'Carregando'}
          description={isStalled ? 'Verifique sua conexão ou tente novamente em instantes.' : undefined}
        />
        {isStalled && (
          <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="kds-control-icon" />
            <span>Tentar novamente</span>
          </Button>
        )}
      </div>
    </DesignSystemProvider>
  );
}
