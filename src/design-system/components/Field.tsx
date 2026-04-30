import type { HTMLAttributes, ReactNode } from 'react';

import { cx } from '../../lib/cx';

export type FieldProps = HTMLAttributes<HTMLDivElement> & {
  label?: string;
  description?: string;
  error?: string;
  children: ReactNode;
};

export default function Field({ label, description, error, children, className, ...props }: FieldProps) {
  return (
    <div className={cx('kds-field', className)} {...props}>
      {(label || description) && (
        <div className="kds-field-copy">
          {label && <label className="kds-field-label">{label}</label>}
          {description && <p className="kds-field-description">{description}</p>}
        </div>
      )}
      {children}
      {error && <p className="kds-field-error">{error}</p>}
    </div>
  );
}
