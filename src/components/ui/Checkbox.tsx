import { forwardRef, type InputHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';
import {
  panelCheckboxBaseClass,
  panelCheckboxSizeClasses,
  type PanelCheckboxSize,
} from './standards';

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> & {
  size?: PanelCheckboxSize;
};

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { size = 'sm', className, disabled, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type="checkbox"
      disabled={disabled}
      className={cx(
        panelCheckboxBaseClass,
        panelCheckboxSizeClasses[size],
        className,
      )}
      {...props}
    />
  );
});

export default Checkbox;
