import { forwardRef, type TextareaHTMLAttributes } from 'react';

import { cx } from '../../lib/cx';
import { panelInputBaseClass, panelInputStateClasses, type PanelInputState } from '../tokens';

export type TextareaSize = 'sm' | 'md' | 'lg';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  size?: TextareaSize;
  invalid?: boolean;
  state?: PanelInputState;
};

const sizeClasses: Record<TextareaSize, string> = {
  sm: 'min-h-[86px] text-[13px]',
  md: 'min-h-[108px] text-sm',
  lg: 'min-h-[132px] text-base',
};

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { size = 'md', invalid = false, state = 'default', className, disabled, ...props },
  ref,
) {
  const resolvedState = invalid ? 'error' : state;

  return (
    <textarea
      ref={ref}
      disabled={disabled}
      className={cx(
        panelInputBaseClass,
        'kds-textarea',
        'py-2.5',
        sizeClasses[size],
        panelInputStateClasses[resolvedState],
        className,
      )}
      {...props}
    />
  );
});

export default Textarea;
