import type { ReactNode } from 'react';
import DesignSystemField from '../../design-system/components/Field';

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
    <DesignSystemField
      className={className}
      htmlFor={htmlFor}
      label={label ? (
        <>
          {label}
          {required ? <span className="ml-1 text-[var(--danger-text)]">*</span> : null}
        </>
      ) : undefined}
      description={helperText}
      error={errorText}
    >
      {children}
    </DesignSystemField>
  );
}
