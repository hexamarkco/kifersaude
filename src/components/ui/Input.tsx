import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cx } from '../../lib/cx';
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
};

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    size = 'default',
    invalid = false,
    leftIcon: LeftIcon,
    rightSlot,
    className,
    disabled,
    ...props
  },
  ref,
) {
  return (
    <div className="relative w-full">
      {LeftIcon && (
        <LeftIcon
          className={cx(
            'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400',
            panelInputIconSizeClasses[size],
          )}
          aria-hidden="true"
        />
      )}
      <input
        ref={ref}
        disabled={disabled}
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
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true">
          {rightSlot}
        </span>
      )}
    </div>
  );
});

export default Input;
