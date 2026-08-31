import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';

import { cx } from '../../lib/cx';
import { panelInputIconSizeClasses, panelInputSizeClasses, type PanelInputSize } from '../tokens';

export type FilterTriggerProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon: LucideIcon;
  value: ReactNode;
  active?: boolean;
  open?: boolean;
  size?: PanelInputSize;
  leadingLabel?: ReactNode;
  trailingSlot?: ReactNode;
};

const triggerPaddingClasses: Record<PanelInputSize, string> = {
  compact: 'pl-8 pr-8 text-xs',
  default: 'pl-9 pr-9 text-sm',
  large: 'pl-10 pr-10 text-base',
};

const leadingIconPositionClasses: Record<PanelInputSize, string> = {
  compact: 'left-2',
  default: 'left-3',
  large: 'left-3.5',
};

const trailingIconPositionClasses: Record<PanelInputSize, string> = {
  compact: 'right-2',
  default: 'right-3',
  large: 'right-3.5',
};

export const FilterTrigger = forwardRef<HTMLButtonElement, FilterTriggerProps>(function FilterTrigger(
  {
    icon: Icon,
    value,
    active = false,
    open = false,
    size = 'default',
    leadingLabel,
    trailingSlot,
    className,
    type,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cx(
        'kds-filter-trigger kds-select panel-ui-input relative w-full text-left',
        panelInputSizeClasses[size],
        triggerPaddingClasses[size],
        active && 'is-active',
        className,
      )}
      aria-expanded={open}
      {...props}
    >
      <Icon
        className={cx(
          'kds-filter-trigger-icon absolute top-1/2 -translate-y-1/2',
          leadingIconPositionClasses[size],
          panelInputIconSizeClasses[size],
        )}
        aria-hidden="true"
      />
      <span className="block min-w-0 truncate whitespace-nowrap">
        {leadingLabel && <span className="kds-filter-trigger-label">{leadingLabel}: </span>}
        <span className={active ? 'kds-filter-trigger-value-active' : 'kds-filter-trigger-value'}>
          {value}
        </span>
      </span>
      {trailingSlot ?? (
        <ChevronDown
          className={cx(
            'kds-filter-trigger-chevron absolute top-1/2 -translate-y-1/2 transition-transform',
            trailingIconPositionClasses[size],
            panelInputIconSizeClasses[size],
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      )}
    </button>
  );
});

export default FilterTrigger;
