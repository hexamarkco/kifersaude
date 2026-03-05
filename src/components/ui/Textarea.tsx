import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';
import { panelInputBaseClass, panelInputStateClasses } from './standards';

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
        panelInputBaseClass,
        'py-2.5',
        sizeClasses[size],
        invalid ? panelInputStateClasses.invalid : panelInputStateClasses.valid,
        className,
      )}
      {...props}
    />
  );
});

export default Textarea;
