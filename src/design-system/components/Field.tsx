import type { HTMLAttributes, ReactNode } from 'react';

import { cx } from '../../lib/cx';

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
          {label && <label className="kds-field-label" htmlFor={htmlFor}>{label}</label>}
          {description && <p className="kds-field-description">{description}</p>}
        </div>
      )}
      {children}
      {error && <p className="kds-field-error">{error}</p>}
      {!error && success && <p className="kds-field-success">{success}</p>}
    </div>
  );
}
