import { cloneElement, isValidElement, useId, type HTMLAttributes, type ReactElement, type ReactNode } from 'react';
import { Info } from 'lucide-react';

import { cx } from '../../lib/cx';
import Tooltip from './Tooltip';

export type FieldProps = HTMLAttributes<HTMLDivElement> & {
  label?: ReactNode;
  htmlFor?: string;
  description?: string;
  hint?: ReactNode;
  error?: string;
  success?: string;
  required?: boolean;
  disabled?: boolean;
  children: ReactNode;
};

type FieldControlProps = {
  id?: string;
  disabled?: boolean;
  required?: boolean;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
};

export default function Field({ label, htmlFor, description, hint, error, success, required = false, disabled = false, children, className, ...props }: FieldProps) {
  const generatedId = useId();
  const child = isValidElement<FieldControlProps>(children) ? children as ReactElement<FieldControlProps> : null;
  const controlId = htmlFor ?? child?.props.id ?? `field-${generatedId.replace(/:/g, '')}`;
  const messageId = `${controlId}-message`;
  const describedBy = [child?.props['aria-describedby'], (hint || error || success) ? messageId : null].filter(Boolean).join(' ') || undefined;
  const control = child ? cloneElement(child, {
    id: controlId,
    disabled: child.props.disabled ?? disabled,
    required: child.props.required ?? required,
    'aria-invalid': child.props['aria-invalid'] ?? (Boolean(error) || undefined),
    'aria-describedby': describedBy,
  }) : children;

  return (
    <div className={cx('kds-field', disabled && 'kds-field-disabled', className)} {...props}>
      {(label || description) && (
        <div className="kds-field-copy">
          <div className="kds-field-label-row">
            {label && <label className="kds-field-label" htmlFor={controlId}>{label}{required && <span className="kds-field-required" aria-hidden="true"> *</span>}</label>}
            {description && (
              <Tooltip content={description} side="bottom">
                <button
                  type="button"
                  className="kds-field-description-trigger"
                  aria-label={`Mais informações: ${description}`}
                >
                  <Info aria-hidden="true" size={14} strokeWidth={2} />
                </button>
              </Tooltip>
            )}
          </div>
        </div>
      )}
      {control}
      {hint && !error && !success && <p id={messageId} className="kds-field-description">{hint}</p>}
      {error && <p id={messageId} className="kds-field-error" role="alert">{error}</p>}
      {!error && success && <p id={messageId} className="kds-field-success" role="status">{success}</p>}
    </div>
  );
}
