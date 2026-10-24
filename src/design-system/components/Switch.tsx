import { forwardRef, useId, type InputHTMLAttributes } from 'react';

import { cx } from '../../lib/cx';

export type SwitchSize = 'sm' | 'md' | 'lg';

export type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> & {
  size?: SwitchSize;
  label?: string;
};

const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { size = 'md', label, id, 'aria-label': ariaLabel, className, disabled, ...props },
  ref,
) {
  const generatedId = useId();
  const controlId = id ?? `switch-${generatedId}`;
  const switchElement = (
    <label className={cx('kds-switch', `kds-switch-${size}`, disabled && 'kds-switch-disabled', className)}>
      <input
        ref={ref}
        type="checkbox"
        role="switch"
        id={controlId}
        aria-label={ariaLabel ?? label}
        disabled={disabled}
        className="kds-switch-input"
        {...props}
      />
      <span className="kds-switch-track" aria-hidden="true">
        <span className="kds-switch-thumb" />
      </span>
    </label>
  );

  if (label) {
    return (
      <div className="kds-switch-field">
        {switchElement}
        <label className="kds-switch-label" htmlFor={controlId}>{label}</label>
      </div>
    );
  }

  return switchElement;
});

export default Switch;
