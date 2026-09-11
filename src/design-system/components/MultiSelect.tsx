import { forwardRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { cx } from '../../lib/cx';
import { panelInputSizeClasses, type ControlSize } from '../tokens';
import Checkbox from './Checkbox';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';
import type { SelectOption } from './Select';

export type MultiSelectProps = {
  id?: string;
  values: string[];
  options: readonly SelectOption[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  size?: ControlSize;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  'aria-label'?: string;
};

const MultiSelect = forwardRef<HTMLButtonElement, MultiSelectProps>(function MultiSelect({
  id,
  values,
  options,
  onChange,
  placeholder = 'Selecione',
  size = 'md',
  disabled = false,
  invalid = false,
  className,
  'aria-label': ariaLabel,
}, ref) {
  const [open, setOpen] = useState(false);
  const selected = options.filter((option) => values.includes(option.value));
  const display = selected.length === 0
    ? placeholder
    : selected.length <= 2
      ? selected.map((option) => option.label).join(', ')
      : `${selected.length} selecionados`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="block w-full">
        <button
          ref={ref}
          id={id}
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          className={cx(
            'kds-select kds-select-trigger panel-ui-input flex w-full items-center justify-between text-left',
            panelInputSizeClasses[size],
            invalid && 'kds-input-invalid',
            className,
          )}
        >
          <span className={cx('min-w-0 flex-1 truncate', selected.length === 0 && 'text-[var(--text-muted)]')}>{display}</span>
          <ChevronDown className="kds-control-icon shrink-0" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="kds-dropdown-menu w-[min(20rem,calc(100vw-1rem))] p-2" role="listbox" aria-label={ariaLabel ?? placeholder} aria-multiselectable="true">
        {options.map((option) => {
          const checked = values.includes(option.value);
          return (
            <label key={option.value} role="option" aria-selected={checked} className="kds-dropdown-option flex cursor-pointer items-center gap-2 px-3 py-2 text-sm">
              <Checkbox
                checked={checked}
                disabled={option.disabled}
                onChange={() => onChange(checked ? values.filter((item) => item !== option.value) : [...values, option.value])}
              />
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
            </label>
          );
        })}
      </PopoverContent>
    </Popover>
  );
});

export default MultiSelect;
