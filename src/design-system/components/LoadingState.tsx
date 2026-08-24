import { Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useState, type HTMLAttributes, type ReactNode } from 'react';

import { cx } from '../../lib/cx';
import Button from './Button';

export type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  /** Hides the decorative placeholder from assistive technologies by default. */
  label?: string;
};

export function Skeleton({ className, label, ...props }: SkeletonProps) {
  return (
    <div
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cx('kds-skeleton', className)}
      {...props}
    />
  );
}

export type LoadingStateProps = HTMLAttributes<HTMLDivElement> & {
  label?: ReactNode;
  description?: ReactNode;
  compact?: boolean;
};

export function LoadingState({
  label = 'Carregando',
  description,
  compact = false,
  className,
  ...props
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cx('kds-loading-state', compact && 'kds-loading-state-compact', className)}
      {...props}
    >
      <Loader2 className="kds-loading-state-spinner" aria-hidden="true" />
      <div>
        <p className="kds-loading-state-label">{label}</p>
        {description && <p className="kds-loading-state-description">{description}</p>}
      </div>
    </div>
  );
}

export type AppLoadingScreenProps = {
  className?: string;
};

const APP_LOADING_STALL_MS = 8000;

/**
 * The single loading screen used everywhere the app has nothing to show yet:
 * route chunk loading, auth check, panel config, and every tab's data fetch.
 * Reusing one component keeps all of these visually identical instead of
 * flashing between differently styled/labelled spinners.
 *
 * If it stays mounted past APP_LOADING_STALL_MS (e.g. Supabase unreachable
 * or a stale/paused backend), it swaps the spinner for a clear message and a
 * reload action instead of spinning forever with no way out.
 */
export function AppLoadingScreen({ className }: AppLoadingScreenProps) {
  const [isStalled, setIsStalled] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setIsStalled(true), APP_LOADING_STALL_MS);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <div
      className={cx(
        'painel-theme kifer-ds flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] px-4',
        className,
      )}
    >
      {isStalled ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <LoadingState
            compact
            label="Isso está demorando mais que o esperado"
            description="Verifique sua conexão ou tente novamente em instantes."
          />
          <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4" />
            <span>Tentar novamente</span>
          </Button>
        </div>
      ) : (
        <LoadingState compact />
      )}
    </div>
  );
}
