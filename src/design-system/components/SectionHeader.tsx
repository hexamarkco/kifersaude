import type { HTMLAttributes, ReactNode } from 'react';

import { cx } from '../../lib/cx';

export type SectionHeaderProps = HTMLAttributes<HTMLDivElement> & {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  as?: 'h2' | 'h3';
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  as: HeadingTag = 'h2',
  className,
  ...props
}: SectionHeaderProps) {
  return (
    <div
      className={cx(
        'flex flex-wrap items-start justify-between gap-4',
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">
            {eyebrow}
          </p>
        )}
        <HeadingTag
          className={cx(
            'font-semibold text-[var(--text-primary)]',
            eyebrow ? 'mt-1.5' : '',
            typeof title === 'string' ? (HeadingTag === 'h2' ? 'text-xl' : 'text-lg') : '',
          )}
        >
          {title}
        </HeadingTag>
        {description && (
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

export type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  children,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cx(
        'kds-empty flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] px-6 py-12 text-center',
        className,
      )}
      {...props}
    >
      {icon && (
        <div className="kds-empty-icon text-[var(--text-muted)]">
          {icon}
        </div>
      )}
      {title && (
        <p className="text-sm font-semibold text-[var(--text-secondary)]">
          {title}
        </p>
      )}
      {description && (
        <p className="max-w-xs text-xs text-[var(--text-muted)]">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
      {children}
    </div>
  );
}
