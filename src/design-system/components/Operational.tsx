import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

import { cx } from '../../lib/cx';

export type OperationalTone = 'neutral' | 'accent' | 'gold' | 'success' | 'warning' | 'danger' | 'info';
export type OperationalMetricChipSize = 'sm' | 'md' | 'lg';

export type OperationalMetricChipProps = HTMLAttributes<HTMLSpanElement> & {
  icon?: ReactNode;
  value: ReactNode;
  label?: ReactNode;
  tone?: OperationalTone;
  active?: boolean;
  size?: OperationalMetricChipSize;
};

export function OperationalMetricChip({
  icon,
  value,
  label,
  tone = 'neutral',
  active = false,
  size = 'md',
  className,
  ...props
}: OperationalMetricChipProps) {
  return (
    <span
      className={cx('kds-op-chip', `kds-op-chip-${tone}`, `kds-op-chip-${size}`, active && 'is-active', className)}
      {...props}
    >
      {icon && <span className="kds-op-chip-icon">{icon}</span>}
      <span className="kds-op-chip-copy">
        <span className="kds-op-chip-value">{value}</span>
        {label && <span className="kds-op-chip-label">{label}</span>}
      </span>
    </span>
  );
}

export type OperationalStatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  statusColor?: string | null;
  children: ReactNode;
};

export function OperationalStatusBadge({ statusColor, className, style, children, ...props }: OperationalStatusBadgeProps) {
  const statusStyle = {
    ...(statusColor ? { '--op-status-color': statusColor } : {}),
    ...style,
  } as CSSProperties;

  return (
    <span className={cx('kds-op-status-badge', className)} style={statusStyle} {...props}>
      <span className="kds-op-status-dot" aria-hidden="true" />
      {children}
    </span>
  );
}

export type OperationalStatusDotProps = HTMLAttributes<HTMLSpanElement> & {
  statusColor?: string | null;
};

export function OperationalStatusDot({ statusColor, className, style, ...props }: OperationalStatusDotProps) {
  const statusStyle = {
    ...(statusColor ? { '--op-status-color': statusColor } : {}),
    ...style,
  } as CSSProperties;

  return <span className={cx('kds-op-status-dot-only', className)} style={statusStyle} {...props} />;
}
