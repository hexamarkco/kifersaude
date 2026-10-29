import { cloneElement, isValidElement, useId, type HTMLAttributes, type ReactElement, type ReactNode } from 'react';

import { cx } from '../../lib/cx';
import InfoTooltip from './InfoTooltip';

export type FieldProps = HTMLAttributes<HTMLDivElement> & {
  label?: ReactNode;
  htmlFor?: string;
  description?: string;
  descriptionPlacement?: 'below' | 'tooltip';
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

export default function Field({ label, htmlFor, description, descriptionPlacement = 'tooltip', hint, error, success, required = false, disabled = false, children, className, ...props }: FieldProps) {
  const generatedId = useId();
  const child = isValidElement<FieldControlProps>(children) ? children as ReactElement<FieldControlProps> : null;
  const controlId = htmlFor ?? child?.props.id ?? `field-${generatedId.replace(/:/g, '')}`;
  const messageId = `${controlId}-message`;
  const descriptionId = `${controlId}-description`;
  const describedBy = [child?.props['aria-describedby'], description ? descriptionId : null, (hint || error || success) ? messageId : null].filter(Boolean).join(' ') || undefined;
  const control = child ? cloneElement(child, {
    id: controlId,
    disabled: disabled || child.props.disabled,
    required: required || child.props.required,
    'aria-invalid': Boolean(error) || child.props['aria-invalid'] || undefined,
    'aria-describedby': describedBy,
  }) : children;

  return (
    <div className={cx('kds-field', disabled && 'kds-field-disabled', className)} {...props}>
      {(label || description) && (
        <div className="kds-field-copy">
          <div className="kds-field-label-row">
            {label && <label className="kds-field-label" htmlFor={controlId}>{label}{required && <span className="kds-field-required" aria-hidden="true"> *</span>}</label>}
            {description && descriptionPlacement === 'tooltip' && (
              <InfoTooltip
                content={description}
                label={`Ajuda: ${typeof label === 'string' ? label : 'campo'}`}
                className="kds-field-description-trigger"
              />
            )}
          </div>
        </div>
      )}
      {control}
      {description && <p id={descriptionId} className={descriptionPlacement === 'tooltip' ? 'sr-only' : 'kds-field-description'}>{description}</p>}
      {hint && !error && !success && <p id={messageId} className="kds-field-description">{hint}</p>}
      {error && <p id={messageId} className="kds-field-error" role="alert">{error}</p>}
      {!error && success && <p id={messageId} className="kds-field-success" role="status">{success}</p>}
    </div>
  );
}
