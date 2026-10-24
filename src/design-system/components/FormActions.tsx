import type { ReactNode } from 'react';
import { PageActions } from './PageActions';

export type FormActionsProps = {
  onCancel: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  form?: string;
  message?: ReactNode;
  sticky?: boolean;
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
  sticky = false,
}: FormActionsProps) {
  return (
    <PageActions
      placement="form"
      sticky={sticky}
      busy={loading}
      message={message}
      secondary={[{ label: cancelLabel, onClick: onCancel }]}
      primary={{ label: submitLabel, type: 'submit', form, loading, disabled }}
    />
  );
}
