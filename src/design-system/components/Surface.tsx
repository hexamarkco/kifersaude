import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

import { cx } from '../../lib/cx';

export type SurfaceVariant = 'default' | 'muted' | 'strong' | 'hero' | 'danger' | 'warning' | 'success' | 'info';
export type SurfacePadding = 'none' | 'sm' | 'md' | 'lg';

type SurfaceProps = HTMLAttributes<HTMLDivElement> & {
  variant?: SurfaceVariant;
  padding?: SurfacePadding;
  children: ReactNode;
};

type ActionSurfaceProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: SurfaceVariant;
  padding?: SurfacePadding;
  selected?: boolean;
  children: ReactNode;
};

const paddingClasses: Record<SurfacePadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6 sm:p-7',
  lg: 'p-7 sm:p-8',
};

export function Surface({ variant = 'default', padding = 'md', className, children, ...props }: SurfaceProps) {
  return (
    <div className={cx('kds-surface', `kds-surface-${variant}`, paddingClasses[padding], className)} {...props}>
      {children}
    </div>
  );
}

export function ActionSurface({
  variant = 'default',
  padding = 'md',
  selected = false,
  className,
  children,
  type,
  ...props
}: ActionSurfaceProps) {
  return (
    <button
      type={type ?? 'button'}
      className={cx(
        'kds-surface kds-action-surface',
        `kds-surface-${variant}`,
        selected && 'is-selected',
        paddingClasses[padding],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
