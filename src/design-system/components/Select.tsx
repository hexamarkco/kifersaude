import { forwardRef, type ReactNode, type SelectHTMLAttributes } from 'react';

import { cx } from '../../lib/cx';
import { panelInputSizeClasses, panelInputStateClasses, type PanelInputSize, type PanelInputState } from '../tokens';

export type SelectSize = PanelInputSize;
export type SelectState = PanelInputState;

export type SelectOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  size?: SelectSize;
  invalid?: boolean;
  state?: SelectState;
  placeholder?: string;
  options?: readonly SelectOption[];
};

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { size = 'default', invalid = false, state = 'default', placeholder, options, className, children, ...props },
  ref,
) {
  const resolvedState = invalid ? 'error' : state;

  return (
    <select
      ref={ref}
      className={cx(
        'kds-select panel-ui-input w-full px-3 disabled:cursor-not-allowed',
        panelInputSizeClasses[size],
        panelInputStateClasses[resolvedState],
        className,
      )}
      {...props}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options?.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
      {children}
    </select>
  );
});

export type MultiSelectProps = Omit<SelectProps, 'multiple'>;

export const MultiSelect = forwardRef<HTMLSelectElement, MultiSelectProps>(function MultiSelect(
  { className, ...props },
  ref,
) {
  return <Select ref={ref} multiple className={cx('min-h-[7rem] py-2', className)} {...props} />;
});

export default Select;
