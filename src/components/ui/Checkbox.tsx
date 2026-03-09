import { forwardRef, type InputHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';

type CheckboxSize = 'sm' | 'md';

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> & {
  size?: CheckboxSize;
};

const checkboxSizeClasses: Record<CheckboxSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
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
        'panel-ui-checkbox rounded border-slate-300 text-amber-600 transition-colors focus:ring-2 focus:ring-amber-500 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-60',
        checkboxSizeClasses[size],
        className,
      )}
      {...props}
    />
  );
});

export default Checkbox;
