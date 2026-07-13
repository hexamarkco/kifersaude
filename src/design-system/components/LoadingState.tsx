import { Loader2 } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';

import { cx } from '../../lib/cx';

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
