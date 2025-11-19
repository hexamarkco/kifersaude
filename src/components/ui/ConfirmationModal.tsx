import { Fragment } from 'react';
import { AlertTriangle, X } from 'lucide-react';

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

  const confirmButtonClasses =
    tone === 'danger'
      ? 'bg-red-600 hover:bg-red-700 focus-visible:outline-red-600'
      : 'bg-sky-600 hover:bg-sky-700 focus-visible:outline-sky-600';

  return (
    <Fragment>
      <div className="fixed inset-0 z-40 bg-slate-900/60" aria-hidden="true" onClick={() => !isLoading && onCancel()} />
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 relative">
          <button
            type="button"
            className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
            onClick={onCancel}
            disabled={isLoading}
            aria-label="Fechar modal de confirmação"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start gap-3">
            <span
              className={`p-2 rounded-full ${
                tone === 'danger' ? 'bg-red-100 text-red-600' : 'bg-sky-100 text-sky-600'
              }`}
              aria-hidden="true"
            >
              <AlertTriangle className="w-5 h-5" />
            </span>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
              {description && <p className="text-sm text-slate-600">{description}</p>}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
              onClick={onCancel}
              disabled={isLoading}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 transition-colors ${confirmButtonClasses} ${
                isLoading ? 'opacity-70 cursor-not-allowed' : ''
              }`}
              onClick={onConfirm}
              disabled={isLoading}
            >
              {isLoading && (
                <span className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
              )}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </Fragment>
  );
}
