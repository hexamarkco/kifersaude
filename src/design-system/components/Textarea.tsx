import { forwardRef, type TextareaHTMLAttributes } from 'react';

import { cx } from '../../lib/cx';
import { panelInputBaseClass, panelInputStateClasses, type PanelInputState } from '../tokens';

export type TextareaSize = 'default' | 'compact';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  size?: TextareaSize;
  invalid?: boolean;
  state?: PanelInputState;
};

const sizeClasses: Record<TextareaSize, string> = {
  default: 'min-h-[108px] text-sm',
  compact: 'min-h-[86px] text-xs',
};

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { size = 'default', invalid = false, state = 'default', className, disabled, ...props },
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
