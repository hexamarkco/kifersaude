import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';

import { cx } from '../../lib/cx';
import { panelInputIconSizeClasses, panelInputSizeClasses, type PanelInputSize } from '../tokens';

export type FilterTriggerProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'value'> & {
  icon: LucideIcon;
  value: ReactNode;
  active?: boolean;
  open?: boolean;
  size?: PanelInputSize;
  leadingLabel?: ReactNode;
  trailingSlot?: ReactNode;
};

const triggerPaddingClasses: Record<PanelInputSize, string> = {
  sm: 'kds-filter-trigger-sm',
  md: 'kds-filter-trigger-md',
  lg: 'kds-filter-trigger-lg',
};

const leadingIconPositionClasses: Record<PanelInputSize, string> = {
  sm: 'left-2.5',
  md: 'left-3.5',
  lg: 'left-4',
};

const trailingIconPositionClasses: Record<PanelInputSize, string> = {
  sm: 'right-2.5',
  md: 'right-3.5',
  lg: 'right-4',
};

export const FilterTrigger = forwardRef<HTMLButtonElement, FilterTriggerProps>(function FilterTrigger(
  {
    icon: Icon,
    value,
    active = false,
    open = false,
    size = 'md',
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
