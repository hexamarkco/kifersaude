import type { HTMLAttributes, ReactNode } from 'react';
import { Info } from 'lucide-react';

import { cx } from '../../lib/cx';
import Tooltip from './Tooltip';

export type FieldProps = HTMLAttributes<HTMLDivElement> & {
  label?: ReactNode;
  htmlFor?: string;
  description?: string;
  error?: string;
  success?: string;
  children: ReactNode;
};

export default function Field({ label, htmlFor, description, error, success, children, className, ...props }: FieldProps) {
  return (
    <div className={cx('kds-field', className)} {...props}>
      {(label || description) && (
        <div className="kds-field-copy">
          <div className="kds-field-label-row">
            {label && <label className="kds-field-label" htmlFor={htmlFor}>{label}</label>}
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
      {error && <p className="kds-field-error">{error}</p>}
      {!error && success && <p className="kds-field-success">{success}</p>}
    </div>
  );
}
