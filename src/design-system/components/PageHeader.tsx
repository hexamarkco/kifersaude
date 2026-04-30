import type { HTMLAttributes, ReactNode } from 'react';

import { cx } from '../../lib/cx';

export type PageHeaderProps = HTMLAttributes<HTMLElement> & {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
};

export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header className={cx('kds-page-header', className)} {...props}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="kds-page-eyebrow">{eyebrow}</p>}
          <h1 className="kds-page-title">{title}</h1>
          {description && <p className="kds-page-description">{description}</p>}
        </div>
        {actions && <div className="kds-page-actions">{actions}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </header>
  );
}
