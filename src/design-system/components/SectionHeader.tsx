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
          <p className="kds-section-eyebrow">
            {eyebrow}
          </p>
        )}
        <HeadingTag
          className={cx(
            'kds-section-title',
            eyebrow ? 'mt-1.5' : '',
            HeadingTag === 'h2' ? 'kds-section-title-h2' : 'kds-section-title-h3',
          )}
        >
          {title}
        </HeadingTag>
        {description && (
          <p className="kds-section-description mt-1">
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
        'kds-empty flex flex-col items-center justify-center gap-3 border border-dashed px-6 py-12 text-center',
        className,
      )}
      {...props}
    >
      {icon && (
        <div className="kds-empty-icon">
          {icon}
        </div>
      )}
      {title && (
        <p className="kds-empty-title">
          {title}
        </p>
      )}
      {description && (
        <p className="kds-empty-description max-w-xs">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
      {children}
    </div>
  );
}
