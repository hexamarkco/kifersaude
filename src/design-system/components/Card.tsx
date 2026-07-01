import type { HTMLAttributes, ReactNode } from 'react';

import { cx } from '../../lib/cx';
import {
  panelCardBaseClass,
  panelCardPaddingClasses,
  panelCardKindClasses,
  panelCardVariantClasses,
  type PanelCardKind,
  type PanelCardPadding,
  type PanelCardVariant,
} from '../tokens';

export type CardVariant = PanelCardVariant;
export type CardPadding = PanelCardPadding;
export type CardKind = PanelCardKind;

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  padding?: CardPadding;
  kind?: CardKind;
  selected?: boolean;
};

export default function Card({
  variant = 'default',
  padding = 'md',
  kind = 'base',
  selected = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cx(
        panelCardBaseClass,
        panelCardVariantClasses[variant],
        panelCardKindClasses[kind],
        selected && 'is-selected',
        panelCardPaddingClasses[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export type CardIconProps = HTMLAttributes<HTMLDivElement> & {
  tone?: 'terracotta' | 'gold';
  children: ReactNode;
};

export function CardIcon({ tone = 'terracotta', className, children, ...props }: CardIconProps) {
  return (
    <div className={cx('kds-card-icon', tone === 'gold' && 'kds-card-icon-gold', className)} {...props}>
      {children}
    </div>
  );
}

export type CrmCardProps = CardProps & {
  eyebrow?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  iconTone?: 'terracotta' | 'gold';
  actions?: ReactNode;
};

export function CrmCard({
  eyebrow,
  title,
  subtitle,
  icon,
  iconTone = 'terracotta',
  actions,
  children,
  kind = 'base',
  className,
  ...props
}: CrmCardProps) {
  return (
    <Card kind={kind} className={cx('space-y-5', className)} {...props}>
      {(eyebrow || title || subtitle || icon || actions) && (
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            {icon && <CardIcon tone={iconTone}>{icon}</CardIcon>}
            <div className="min-w-0">
              {eyebrow && <p className="kds-card-subtitle uppercase tracking-[0.14em]">{eyebrow}</p>}
              {title && <h3 className="kds-card-title mt-1">{title}</h3>}
              {subtitle && <p className="kds-card-subtitle mt-1">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="kds-card-actions">{actions}</div>}
        </div>
      )}
      {children}
    </Card>
  );
}

export type KpiCardProps = Omit<CrmCardProps, 'kind'> & {
  value?: ReactNode;
  trend?: ReactNode;
  chart?: ReactNode;
};

export function KpiCard({ value, trend, chart, children, ...props }: KpiCardProps) {
  return (
    <CrmCard kind="kpi" {...props}>
      {value && <div className="text-3xl font-semibold tracking-tight text-[var(--text-primary)]">{value}</div>}
      {trend && <div className="text-sm text-[var(--text-secondary)]">{trend}</div>}
      {chart && <div className="pt-2">{chart}</div>}
      {children}
    </CrmCard>
  );
}

export const ClienteCard = (props: CrmCardProps) => <CrmCard kind="client" {...props} />;
export const CustomerCard = ClienteCard;
export const OpportunityCard = (props: CrmCardProps) => <CrmCard kind="opportunity" {...props} />;
export const LeadCard = (props: CrmCardProps) => <CrmCard kind="lead" {...props} />;
export const ActivityCard = (props: CrmCardProps) => <CrmCard kind="activity" {...props} />;
export const TaskCard = (props: CrmCardProps) => <CrmCard kind="task" {...props} />;
export const SummaryCard = (props: CrmCardProps) => <CrmCard kind="summary" {...props} />;
export const ChartCard = (props: CrmCardProps) => <CrmCard kind="chart" {...props} />;
