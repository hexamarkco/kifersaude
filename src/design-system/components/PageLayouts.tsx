import type { FormHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import {
  PageContainer,
  Toolbar,
  ToolbarActions,
  ToolbarSearch,
} from './Application';
import PageHeader, { type PageHeaderProps } from './PageHeader';

export type PageLayoutProps = {
  header: PageHeaderProps;
  children: ReactNode;
  className?: string;
};
export type ListPageProps = PageLayoutProps & {
  search?: ReactNode;
  filters?: ReactNode;
  summary?: ReactNode;
  pagination?: ReactNode;
};
export type DetailPageProps = PageLayoutProps & { aside?: ReactNode };
export type DashboardPageProps = PageLayoutProps & {
  filters?: ReactNode;
  indicators: ReactNode;
};
export type FormPageProps = PageLayoutProps &
  Pick<
    FormHTMLAttributes<HTMLFormElement>,
    'id' | 'onSubmit' | 'noValidate'
  > & { actions: ReactNode; aside?: ReactNode };

function PageFrame({ header, children, className }: PageLayoutProps) {
  return (
    <PageContainer
      size="full"
      className={cx('kds-page-layout kds-operational', className)}
    >
      <PageHeader {...header} appearance="operational" />
      {children}
    </PageContainer>
  );
}

export function ListPage({
  search,
  filters,
  summary,
  pagination,
  children,
  ...props
}: ListPageProps) {
  return (
    <PageFrame {...props}>
      {(search || filters) && (
        <Toolbar>
          {search && <ToolbarSearch>{search}</ToolbarSearch>}
          {filters && <ToolbarActions>{filters}</ToolbarActions>}
        </Toolbar>
      )}
      {summary && (
        <div className="kds-list-summary" role="status">
          {summary}
        </div>
      )}
      <div className="kds-page-content">{children}</div>
      {pagination}
    </PageFrame>
  );
}

export function DetailPage({ children, aside, ...props }: DetailPageProps) {
  return (
    <PageFrame {...props}>
      <div
        className={cx(
          'kds-detail-layout',
          Boolean(aside) && 'kds-detail-layout-aside',
        )}
      >
        <div className="kds-detail-sections">{children}</div>
        {aside && <aside className="kds-detail-aside">{aside}</aside>}
      </div>
    </PageFrame>
  );
}

export function FormPage({
  children,
  actions,
  aside,
  id,
  onSubmit,
  noValidate,
  ...props
}: FormPageProps) {
  return (
    <PageFrame {...props}>
      <div
        className={cx(
          'kds-form-layout',
          Boolean(aside) && 'kds-form-layout-aside',
        )}
      >
        <form
          id={id}
          onSubmit={onSubmit}
          noValidate={noValidate}
          className="kds-form-page"
        >
          <div className="kds-form-sections">{children}</div>
          {actions}
        </form>
        {aside && <aside className="kds-form-aside">{aside}</aside>}
      </div>
    </PageFrame>
  );
}

export function FormSection({
  title,
  step,
  description,
  children,
  className,
  ...props
}: Omit<HTMLAttributes<HTMLFieldSetElement>, 'title'> & {
  title: string;
  step?: string;
  description?: string;
}) {
  return (
    <fieldset className={cx('kds-form-section', className)} {...props}>
      <legend>{step && <span className="kds-form-section-step" aria-hidden="true">{step}</span>}<span>{title}</span></legend>
      {description && (
        <p className="kds-form-section-description">{description}</p>
      )}
      <div className="kds-form-fields">{children}</div>
    </fieldset>
  );
}

export function DashboardPage({
  children,
  filters,
  indicators,
  ...props
}: DashboardPageProps) {
  return (
    <PageFrame {...props}>
      {filters && <Toolbar>{filters}</Toolbar>}
      <div className="kds-dashboard-indicators">{indicators}</div>
      <div className="kds-dashboard-content">{children}</div>
    </PageFrame>
  );
}
