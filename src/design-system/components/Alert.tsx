import type { HTMLAttributes, ReactNode } from 'react';

import { cx } from '../../lib/cx';
import type { PanelTone } from '../panelStyles';

export type AlertTone = Exclude<PanelTone, 'neutral'>;

export type AlertProps = HTMLAttributes<HTMLDivElement> & {
  tone?: AlertTone;
  title?: string;
  action?: ReactNode;
  children: ReactNode;
};

export default function Alert({ tone = 'accent', title, action, className, children, ...props }: AlertProps) {
  return (
    <div className={cx('kds-alert', `kds-alert-${tone}`, className)} {...props}>
      <div className="min-w-0 flex-1">
        {title && <p className="kds-alert-title">{title}</p>}
        <div className="kds-alert-content">{children}</div>
      </div>
      {action && <div className="kds-alert-action">{action}</div>}
    </div>
  );
}
