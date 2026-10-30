import { forwardRef, createContext, useContext, useState, type AriaAttributes, type InputHTMLAttributes, type ReactNode } from 'react';

import { cx } from '../../lib/cx';

type RadioGroupContextValue = {
  name: string;
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
};

const RadioGroupContext = createContext<RadioGroupContextValue>({
  name: '',
});

export type RadioGroupProps = Pick<AriaAttributes, 'aria-label' | 'aria-labelledby' | 'aria-describedby'> & {
  name: string;
  value?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  children: ReactNode;
};

export function RadioGroup({
  name,
  value,
  onValueChange,
  disabled = false,
  orientation = 'vertical',
  className,
  children,
  ...ariaProps
}: RadioGroupProps) {
  return (
    <RadioGroupContext.Provider value={{ name, value, onValueChange, disabled }}>
      <div
        {...ariaProps}
        role="radiogroup"
        aria-orientation={orientation}
        className={cx(
          'kds-radio-group',
          orientation === 'horizontal' && 'kds-radio-group-horizontal',
          className,
        )}
      >
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

export type RadioProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  value?: string;
  label?: ReactNode;
  description?: string;
};

const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { value: radioValue, label, description, className, disabled: radioDisabled, checked, defaultChecked, onChange, ...props },
  ref,
) {
  const ctx = useContext(RadioGroupContext);
  const isDisabled = radioDisabled || ctx.disabled;
  const [uncontrolledChecked, setUncontrolledChecked] = useState(defaultChecked ?? false);
  const grouped = Boolean(ctx.name);
  const isChecked = grouped ? ctx.value === radioValue : (checked ?? uncontrolledChecked);
  const Element = label || description ? 'label' : 'span';

  return (
    <Element
      className={cx(
        'kds-radio',
        isDisabled && 'kds-radio-disabled',
        isChecked && 'kds-radio-checked',
        className,
      )}
    >
      <input
        ref={ref}
        type="radio"
        name={ctx.name}
        value={radioValue}
        checked={isChecked}
        disabled={isDisabled}
        onChange={(event) => {
          if (grouped && radioValue !== undefined) ctx.onValueChange?.(radioValue);
          if (!grouped) setUncontrolledChecked(event.target.checked);
          onChange?.(event);
        }}
        className="kds-radio-input"
        {...props}
      />
      <span className="kds-radio-indicator" aria-hidden="true" />
      {(label || description) && (
        <span className="kds-radio-content">
          {label && <span className="kds-radio-label">{label}</span>}
          {description && <span className="kds-radio-description">{description}</span>}
        </span>
      )}
    </Element>
  );
});

export default Radio;
