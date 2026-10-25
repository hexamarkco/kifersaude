import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';

import { cx } from '../../lib/cx';

export type SurfaceVariant = 'default' | 'muted' | 'strong' | 'hero' | 'danger' | 'warning' | 'success' | 'info';
export type SurfacePadding = 'none' | 'sm' | 'md' | 'lg';

type SurfaceProps = HTMLAttributes<HTMLDivElement> & {
  variant?: SurfaceVariant;
  padding?: SurfacePadding;
  children: ReactNode;
};

type ActionSurfaceProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: SurfaceVariant | 'plain';
  padding?: SurfacePadding;
  selected?: boolean;
  children?: ReactNode;
};

const paddingClasses: Record<SurfacePadding, string> = {
  none: '',
  sm: 'kds-card-padding-sm',
  md: 'kds-card-padding-md',
  lg: 'kds-card-padding-lg',
};

export function Surface({ variant = 'default', padding = 'md', className, children, ...props }: SurfaceProps) {
  return (
    <div className={cx('kds-surface', `kds-surface-${variant}`, paddingClasses[padding], className)} {...props}>
      {children}
    </div>
  );
}

export const ActionSurface = forwardRef<HTMLButtonElement, ActionSurfaceProps>(function ActionSurface({
  variant = 'default',
  padding = 'md',
  selected = false,
  className,
  children,
  type,
  ...props
}: ActionSurfaceProps, ref) {
  return (
    <button
      ref={ref}
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
});
