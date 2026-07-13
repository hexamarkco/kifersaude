import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { cx } from '../../lib/cx';

export type BreadcrumbProps = {
  children: ReactNode;
  className?: string;
  separator?: ReactNode;
};

export function Breadcrumb({ children, className, separator }: BreadcrumbProps) {
  void separator;
  return (
    <nav aria-label="Breadcrumb" className={cx('kds-breadcrumb', className)}>
      <ol className="kds-breadcrumb-list">
        {children}
      </ol>
    </nav>
  );
}

export type BreadcrumbItemProps = {
  children: ReactNode;
  className?: string;
  isCurrent?: boolean;
};

export function BreadcrumbItem({ children, className, isCurrent }: BreadcrumbItemProps) {
  return (
    <li
      className={cx('kds-breadcrumb-item', isCurrent && 'kds-breadcrumb-item-current', className)}
      aria-current={isCurrent ? 'page' : undefined}
    >
      {children}
    </li>
  );
}

export type BreadcrumbLinkProps = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
};

export function BreadcrumbLink({ children, href, onClick, className }: BreadcrumbLinkProps) {
  if (href) {
    return (
      <a href={href} className={cx('kds-breadcrumb-link', className)}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cx('kds-breadcrumb-link', className)}>
      {children}
    </button>
  );
}

export type BreadcrumbSeparatorProps = {
  children?: ReactNode;
  className?: string;
};

export function BreadcrumbSeparator({ children, className }: BreadcrumbSeparatorProps) {
  return (
    <li className={cx('kds-breadcrumb-separator', className)} aria-hidden="true">
      {children ?? <ChevronRight className="h-3.5 w-3.5" />}
    </li>
  );
}
