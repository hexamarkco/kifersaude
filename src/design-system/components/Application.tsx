import type { HTMLAttributes, ReactNode } from 'react';

import { cx } from '../../lib/cx';

export type PageContainerSize = 'default' | 'wide' | 'full';
export type PageContainerSpacing = 'sm' | 'md' | 'lg';

export type PageContainerProps = HTMLAttributes<HTMLDivElement> & {
  size?: PageContainerSize;
  spacing?: PageContainerSpacing;
  children: ReactNode;
};

export function PageContainer({
  size = 'default',
  spacing = 'md',
  className,
  children,
  ...props
}: PageContainerProps) {
  return (
    <div
      className={cx(
        'panel-page-shell kds-page-container',
        `kds-page-container-${size}`,
        `kds-page-container-spacing-${spacing}`,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export type PageSectionProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
};

export function PageSection({ className, children, ...props }: PageSectionProps) {
  return (
    <section className={cx('kds-page-section', className)} {...props}>
      {children}
    </section>
  );
}

export type ToolbarProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Toolbar({ className, children, ...props }: ToolbarProps) {
  return (
    <div className={cx('kds-toolbar kds-op-toolbar', className)} {...props}>
      {children}
    </div>
  );
}

export type ToolbarSearchProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function ToolbarSearch({ className, children, ...props }: ToolbarSearchProps) {
  return (
    <div className={cx('kds-toolbar-search kds-op-toolbar-search', className)} {...props}>
      {children}
    </div>
  );
}

export type ToolbarActionsProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function ToolbarActions({ className, children, ...props }: ToolbarActionsProps) {
  return (
    <div className={cx('kds-toolbar-actions kds-op-toolbar-actions', className)} {...props}>
      {children}
    </div>
  );
}
