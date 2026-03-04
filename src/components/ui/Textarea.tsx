import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';

export type TextareaSize = 'default' | 'compact';

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  size?: TextareaSize;
  invalid?: boolean;
};

const sizeClasses: Record<TextareaSize, string> = {
  default: 'min-h-[108px] text-sm',
  compact: 'min-h-[86px] text-xs',
};

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { size = 'default', invalid = false, className, disabled, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      disabled={disabled}
      className={cx(
        'panel-ui-input w-full rounded-lg border bg-white px-3 py-2.5 shadow-sm transition-all',
        'focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500',
        'disabled:cursor-not-allowed disabled:opacity-60',
        sizeClasses[size],
        invalid ? 'border-red-400 text-red-700 placeholder:text-red-300' : 'border-slate-300 text-slate-700 placeholder:text-slate-400',
        className,
      )}
      {...props}
    />
  );
});

export default Textarea;
