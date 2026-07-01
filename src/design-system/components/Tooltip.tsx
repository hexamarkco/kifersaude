import { useState, useRef, useCallback, type ReactNode } from 'react';

import { cx } from '../../lib/cx';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';
export type TooltipSize = 'sm' | 'md';

export type TooltipProps = {
  content: ReactNode;
  side?: TooltipSide;
  size?: TooltipSize;
  delayMs?: number;
  children: ReactNode;
  className?: string;
};

const sideClasses: Record<TooltipSide, string> = {
  top: 'kds-tooltip-top',
  bottom: 'kds-tooltip-bottom',
  left: 'kds-tooltip-left',
  right: 'kds-tooltip-right',
};

export default function Tooltip({
  content,
  side = 'top',
  size = 'md',
  delayMs = 300,
  children,
  className,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const show = useCallback(() => {
    timeoutRef.current = setTimeout(() => setVisible(true), delayMs);
  }, [delayMs]);

  const hide = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setVisible(false);
  }, []);

  return (
    <div
      className={cx('kds-tooltip-anchor', className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && content && (
        <div
          role="tooltip"
          className={cx(
            'kds-tooltip',
            sideClasses[side],
            size === 'sm' && 'kds-tooltip-sm',
            size === 'md' && 'kds-tooltip-md',
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}
