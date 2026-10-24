import { forwardRef, type InputHTMLAttributes } from 'react';

import { cx } from '../../lib/cx';
import {
  panelCheckboxBaseClass,
  panelCheckboxSizeClasses,
  type PanelCheckboxSize,
} from '../tokens';

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> & {
  touchTarget?: boolean;
  size?: PanelCheckboxSize;
};

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { size = 'sm', className, disabled, touchTarget = false, ...props },
  ref,
) {
  const input = (
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
  return touchTarget ? <label className="kds-checkbox-target">{input}</label> : input;
});

export default Checkbox;
