import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cx } from '../../lib/cx';

export type InputSize = 'default' | 'compact';

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  size?: InputSize;
  invalid?: boolean;
  leftIcon?: LucideIcon;
  rightSlot?: ReactNode;
};

const inputSizeClasses: Record<InputSize, string> = {
  default: 'h-11 text-sm',
  compact: 'h-9 text-xs',
};

const iconSizeClasses: Record<InputSize, string> = {
  default: 'h-[18px] w-[18px]',
  compact: 'h-4 w-4',
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
            iconSizeClasses[size],
          )}
          aria-hidden="true"
        />
      )}
      <input
        ref={ref}
        disabled={disabled}
        className={cx(
          'panel-ui-input w-full rounded-lg border bg-white px-3 shadow-sm transition-all',
          'focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500',
          'disabled:cursor-not-allowed disabled:opacity-60',
          inputSizeClasses[size],
          LeftIcon && (size === 'compact' ? 'pl-8' : 'pl-10'),
          Boolean(rightSlot) && (size === 'compact' ? 'pr-8' : 'pr-10'),
          invalid ? 'border-red-400 text-red-700 placeholder:text-red-300' : 'border-slate-300 text-slate-700 placeholder:text-slate-400',
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
