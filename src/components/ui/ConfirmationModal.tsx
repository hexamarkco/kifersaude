import { AlertTriangle } from 'lucide-react';
import Button from './Button';
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
      <div className="flex items-start gap-3">
        <span
          className={`rounded-full p-2 ${
            tone === 'danger' ? 'bg-red-100 text-red-600' : 'bg-teal-100 text-teal-700'
          }`}
          aria-hidden="true"
        >
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="space-y-1">
          {description ? (
            <p className="text-sm text-slate-600">{description}</p>
          ) : (
            <p className="text-sm text-slate-600">Essa acao pode impactar os dados atuais. Confirme para continuar.</p>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
