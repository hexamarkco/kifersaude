import { AlertTriangle } from 'lucide-react';
import { Alert, Button } from '../../design-system';
import ModalShell from './ModalShell';

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
  if (!isOpen) return null;

  const handleClose = () => {
    if (!isLoading) {
      onCancel();
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      size="sm"
      closeOnOverlay={!isLoading}
      closeOnEscape={!isLoading}
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={isLoading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <Alert tone={tone === 'danger' ? 'danger' : 'warning'}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p>
            {description ?? 'Essa acao pode impactar os dados atuais. Confirme para continuar.'}
          </p>
        </div>
      </Alert>
    </ModalShell>
  );
}
