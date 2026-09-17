import type { HTMLAttributes, ReactNode } from 'react';

import { cx } from '../../lib/cx';

export type PublicTheme = 'light' | 'dark';
export type PublicWidth = 'narrow' | 'default' | 'wide' | 'full';

export type PublicShellProps = HTMLAttributes<HTMLDivElement> & {
  theme?: PublicTheme;
  width?: PublicWidth;
  children: ReactNode;
};

export function PublicShell({
  theme = 'light',
  width = 'default',
  className,
  children,
  ...props
}: PublicShellProps) {
  return (
    <div
      className={cx('painel-theme kifer-ds kds-public-shell', theme === 'dark' && 'theme-dark', className)}
      {...props}
    >
      <div className={cx('kds-public-shell-inner', `kds-public-width-${width}`)}>{children}</div>
    </div>
  );
}

export type PublicSectionProps = HTMLAttributes<HTMLElement> & {
  tone?: 'canvas' | 'surface' | 'muted' | 'brand' | 'inverse';
  children: ReactNode;
};

export function PublicSection({ tone = 'surface', className, children, ...props }: PublicSectionProps) {
  return (
    <section className={cx('kds-public-section', `kds-public-section-${tone}`, className)} {...props}>
      {children}
    </section>
  );
}

export type PublicCardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
};

export function PublicCard({ className, children, ...props }: PublicCardProps) {
  return (
    <article className={cx('kds-public-card', className)} {...props}>
      {children}
    </article>
  );
}

export type PublicEmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
};

export function PublicEmptyState({ icon, title, description, className, children, ...props }: PublicEmptyStateProps) {
  return (
    <div className={cx('kds-public-empty-state', className)} {...props}>
      {icon && <div className="kds-public-empty-state-icon">{icon}</div>}
      <p className="kds-public-empty-state-title">{title}</p>
      {description && <p className="kds-public-empty-state-description">{description}</p>}
      {children}
    </div>
  );
}
