import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';

type FieldProps = {
  label?: string;
  htmlFor?: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

export default function Field({
  label,
  htmlFor,
  helperText,
  errorText,
  required = false,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cx('kds-field', className)}>
      {label && (
        <label htmlFor={htmlFor} className="kds-field-label block uppercase tracking-wide">
          {label}
          {required ? <span className="ml-1 text-[var(--danger-text)]">*</span> : null}
        </label>
      )}

      {children}

      {errorText ? (
        <p className="kds-field-error">{errorText}</p>
      ) : helperText ? (
        <p className="kds-field-description">{helperText}</p>
      ) : null}
    </div>
  );
}
