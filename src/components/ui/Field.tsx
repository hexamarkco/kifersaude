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
    <div className={cx('space-y-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
          {required ? <span className="ml-1 text-red-500">*</span> : null}
        </label>
      )}

      {children}

      {errorText ? (
        <p className="text-xs font-medium text-red-600">{errorText}</p>
      ) : helperText ? (
        <p className="text-xs text-slate-500">{helperText}</p>
      ) : null}
    </div>
  );
}
