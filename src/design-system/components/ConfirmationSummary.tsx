import type { ReactNode } from 'react';

import { cx } from '../../lib/cx';
import Alert, { type AlertTone } from './Alert';

export type ConfirmationSummaryItem = {
  label: string;
  value: ReactNode;
};

export type ConfirmationSummaryProps = {
  warning: ReactNode;
  items: ConfirmationSummaryItem[];
  tone?: AlertTone;
  className?: string;
};

/** Contextual impact and record identity shown before a consequential action. */
export function ConfirmationSummary({
  warning,
  items,
  tone = 'danger',
  className,
}: ConfirmationSummaryProps) {
  return (
    <div className={cx('kds-confirmation-summary-content', className)}>
      <Alert tone={tone} role="note">
        {warning}
      </Alert>
      <dl className="kds-confirmation-summary">
        {items.map((item) => (
          <div className="kds-confirmation-summary-item" key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
