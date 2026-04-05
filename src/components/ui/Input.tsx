import { forwardRef, type ChangeEvent, type InputHTMLAttributes, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cx } from '../../lib/cx';
import { formatInputValue, type InputAutoFormat } from '../../lib/inputFormatters';
import {
  panelInputBaseClass,
  panelInputIconSizeClasses,
  panelInputSizeClasses,
  panelInputStateClasses,
  type PanelInputSize,
} from './standards';

export type InputSize = PanelInputSize;

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  size?: InputSize;
  invalid?: boolean;
  leftIcon?: LucideIcon;
  rightSlot?: ReactNode;
  autoFormat?: InputAutoFormat;
};

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    size = 'default',
    invalid = false,
    leftIcon: LeftIcon,
    rightSlot,
    autoFormat,
    className,
    disabled,
    onChange,
    ...props
  },
  ref,
) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (!autoFormat) {
      onChange?.(event);
      return;
    }

    const formattedValue = formatInputValue(event.target.value, autoFormat);
    const formattedEvent = {
      ...event,
      target: { ...event.target, value: formattedValue },
      currentTarget: { ...event.currentTarget, value: formattedValue },
    } as ChangeEvent<HTMLInputElement>;

    onChange?.(formattedEvent);
  };

  return (
    <div className="relative w-full">
      {LeftIcon && (
        <LeftIcon
          className={cx(
            'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--panel-placeholder,var(--panel-text-muted,#876f5c))]',
            panelInputIconSizeClasses[size],
          )}
          aria-hidden="true"
        />
      )}
      <input
        ref={ref}
        disabled={disabled}
        onChange={handleChange}
        className={cx(
          panelInputBaseClass,
          panelInputSizeClasses[size],
          LeftIcon && (size === 'compact' ? 'pl-8' : 'pl-10'),
          Boolean(rightSlot) && (size === 'compact' ? 'pr-8' : 'pr-10'),
          invalid ? panelInputStateClasses.invalid : panelInputStateClasses.valid,
          className,
        )}
        {...props}
      />
      {rightSlot && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--panel-placeholder,var(--panel-text-muted,#876f5c))]" aria-hidden="true">
          {rightSlot}
        </span>
      )}
    </div>
  );
});

export default Input;
