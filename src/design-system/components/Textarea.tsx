import { forwardRef, type TextareaHTMLAttributes } from 'react';

import { cx } from '../../lib/cx';
import { panelInputBaseClass, panelInputSizeClasses, panelInputStateClasses, type PanelInputState } from '../tokens';

export type TextareaSize = 'sm' | 'md' | 'lg';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  size?: TextareaSize;
  invalid?: boolean;
  state?: PanelInputState;
};

const sizeClasses: Record<TextareaSize, string> = {
  sm: 'kds-textarea-sm',
  md: 'kds-textarea-md',
  lg: 'kds-textarea-lg',
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
        panelInputSizeClasses[size],
        sizeClasses[size],
        panelInputStateClasses[resolvedState],
        className,
      )}
      {...props}
    />
  );
});

export default Textarea;
