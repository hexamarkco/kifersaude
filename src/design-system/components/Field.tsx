import type { HTMLAttributes, ReactNode } from 'react';
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

export default function Field({ label, htmlFor, description, hint, error, success, required = false, disabled = false, children, className, ...props }: FieldProps) {
  return (
    <div className={cx('kds-field', disabled && 'kds-field-disabled', className)} {...props}>
      {(label || description) && (
        <div className="kds-field-copy">
          <div className="kds-field-label-row">
            {label && <label className="kds-field-label" htmlFor={htmlFor}>{label}{required && <span className="kds-field-required" aria-hidden="true"> *</span>}</label>}
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
      {children}
      {hint && !error && !success && <p className="kds-field-description">{hint}</p>}
      {error && <p className="kds-field-error">{error}</p>}
      {!error && success && <p className="kds-field-success">{success}</p>}
    </div>
  );
}
