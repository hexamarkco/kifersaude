import { forwardRef, type InputHTMLAttributes } from 'react';

import { cx } from '../../lib/cx';

export type SwitchSize = 'sm' | 'md' | 'lg';

export type SwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> & {
  size?: SwitchSize;
  label?: string;
};

const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { size = 'md', label, className, disabled, ...props },
  ref,
) {
  const switchElement = (
    <label className={cx('kds-switch', `kds-switch-${size}`, disabled && 'kds-switch-disabled', className)}>
      <input
        ref={ref}
        type="checkbox"
        role="switch"
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
        <span className="kds-switch-label">{label}</span>
      </div>
    );
  }

  return switchElement;
});

export default Switch;
