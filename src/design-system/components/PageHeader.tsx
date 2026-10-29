import type { HTMLAttributes, ReactNode } from 'react';

import { cx } from '../../lib/cx';
import InfoTooltip from './InfoTooltip';

export type PageHeaderProps = HTMLAttributes<HTMLElement> & {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: ReactNode;
  identity?: ReactNode;
  status?: ReactNode;
  appearance?: 'default' | 'operational';
  descriptionPlacement?: 'tooltip' | 'visible';
  children?: ReactNode;
};

export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  breadcrumbs,
  identity,
  status,
  appearance = 'operational',
  descriptionPlacement = 'tooltip',
  children,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header
      className={cx(
        'kds-page-header',
        appearance === 'operational' && 'kds-page-header-operational',
        className,
      )}
      {...props}
    >
      {breadcrumbs && <div className="kds-page-breadcrumbs">{breadcrumbs}</div>}
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          {eyebrow && <p className="kds-page-eyebrow">{eyebrow}</p>}
          <div className="kds-page-identification">
            {identity}
            <div className="kds-page-title-row">
              <h1 className="kds-page-title">{title}</h1>
              {description && descriptionPlacement === 'tooltip' && (
                <InfoTooltip content={description} label={`Informações sobre ${title}`} />
              )}
              {status}
            </div>
          </div>
          {description && descriptionPlacement === 'visible' && <p className="kds-page-description">{description}</p>}
        </div>
        {actions && (
          <div className="kds-page-actions kds-control-group-md w-full lg:w-auto lg:justify-end">
            {actions}
          </div>
        )}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </header>
  );
}
