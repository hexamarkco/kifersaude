import type { HTMLAttributes, ReactNode } from 'react';

import { cx } from '../../lib/cx';
import type { PanelTone } from '../panelStyles';

export type BadgeTone = PanelTone;
export type BadgeSize = 'sm' | 'md';

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  size?: BadgeSize;
  children: ReactNode;
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-3 py-1.5 text-xs',
};

export default function Badge({ tone = 'neutral', size = 'md', className, children, ...props }: BadgeProps) {
  return (
    <span className={cx('kds-badge', `kds-badge-${tone}`, sizeClasses[size], className)} {...props}>
      {children}
    </span>
  );
}
