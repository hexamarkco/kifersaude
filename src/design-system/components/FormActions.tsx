import type { ReactNode } from 'react';
import Button from './Button';

export type FormActionsProps = {
  onCancel: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  form?: string;
  message?: ReactNode;
};

/** Place inside a form, or associate the submit button with an external form id. */
export function FormActions({
  onCancel,
  submitLabel = 'Salvar alterações',
  cancelLabel = 'Cancelar',
  loading = false,
  disabled = false,
  form,
  message,
}: FormActionsProps) {
  return (
    <div className="kds-form-actions">
      {message && <div className="kds-form-actions-message">{message}</div>}
      <div className="kds-form-actions-buttons">
        <Button variant="secondary" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button type="submit" form={form} loading={loading} disabled={disabled}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
