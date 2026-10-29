import type { ReactNode } from 'react';
import { Info } from 'lucide-react';

import { cx } from '../../lib/cx';
import Tooltip from './Tooltip';

export type InfoTooltipProps = {
  content: ReactNode;
  label?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
};

/** Compact, keyboard-accessible home for secondary explanatory notes. */
export function InfoTooltip({
  content,
  label = 'Mais informações',
  side = 'top',
  className,
}: InfoTooltipProps) {
  return (
    <Tooltip content={content} side={side} delayMs={0}>
      <button
        type="button"
        className={cx('kds-info-trigger', className)}
        aria-label={label}
      >
        <Info aria-hidden="true" />
      </button>
    </Tooltip>
  );
}

export default InfoTooltip;
