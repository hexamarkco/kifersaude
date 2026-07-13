import { Alert, ConfirmDialog } from '../../design-system';

export type ConfirmationModalProps = {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  tone?: 'danger' | 'default';
};

/** Legacy confirmation API backed by the DS confirmation dialog. */
export function ConfirmationModal({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  isLoading = false,
  tone = 'default',
}: ConfirmationModalProps) {
  return (
    <ConfirmDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isLoading) onCancel();
      }}
      onConfirm={onConfirm}
      title={title}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      destructive={tone === 'danger'}
      loading={isLoading}
    >
      <Alert tone={tone === 'danger' ? 'danger' : 'warning'}>
        {description ?? 'Essa acao pode impactar os dados atuais. Confirme para continuar.'}
      </Alert>
    </ConfirmDialog>
  );
}
