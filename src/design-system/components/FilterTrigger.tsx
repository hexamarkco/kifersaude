import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';

import { cx } from '../../lib/cx';
import { panelInputSizeClasses, type PanelInputSize } from '../tokens';

export type FilterTriggerProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'value'> & {
  icon: LucideIcon;
  value: ReactNode;
  active?: boolean;
  open?: boolean;
  size?: PanelInputSize;
  leadingLabel?: ReactNode;
  trailingSlot?: ReactNode;
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
        'kds-filter-trigger kds-select panel-ui-input w-full text-left',
        panelInputSizeClasses[size],
        active && 'is-active',
        className,
      )}
      aria-expanded={open}
      {...props}
    >
      <Icon
        className="kds-filter-trigger-icon kds-control-icon"
        aria-hidden="true"
      />
      <span className="block min-w-0 truncate whitespace-nowrap">
        {leadingLabel && <span className="kds-filter-trigger-label">{leadingLabel}: </span>}
        <span className={active ? 'kds-filter-trigger-value-active' : 'kds-filter-trigger-value'}>
          {value}
        </span>
      </span>
      <span className="kds-filter-trigger-trailing">
        {trailingSlot ?? (
          <ChevronDown
            className={cx('kds-filter-trigger-chevron kds-control-icon transition-transform', open && 'rotate-180')}
            aria-hidden="true"
          />
        )}
      </span>
    </button>
  );
});

export default FilterTrigger;
