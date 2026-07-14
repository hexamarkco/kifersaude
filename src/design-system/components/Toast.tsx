import { createContext, useCallback, useContext, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

import { cx } from '../../lib/cx';

export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

export type Toast = {
  id: string;
  title?: string;
  description: string;
  variant: ToastVariant;
  duration: number;
};

type ToastInput = {
  title?: string;
  description: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastContextValue = {
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const variantIcons: Record<ToastVariant, typeof CheckCircle2> = {
  default: Info,
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const variantClasses: Record<ToastVariant, string> = {
  default: 'kds-toast-default',
  success: 'kds-toast-success',
  error: 'kds-toast-error',
  warning: 'kds-toast-warning',
  info: 'kds-toast-info',
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

export type ToastProviderProps = {
  children: ReactNode;
  position?: ToastPosition;
  maxToasts?: number;
};

export function ToastProvider({ children, position = 'bottom-right', maxToasts = 5 }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const newToast: Toast = {
        id,
        title: input.title,
        description: input.description,
        variant: input.variant ?? 'default',
        duration: input.duration ?? 5000,
      };
      setToasts((prev) => [...prev.slice(-(maxToasts - 1)), newToast]);
      return id;
    },
    [maxToasts],
  );

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} position={position} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastContainer({
  toasts,
  position,
  onDismiss,
}: {
  toasts: Toast[];
  position: ToastPosition;
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  const isDarkThemeActive = document.querySelector('.painel-theme')?.classList.contains('theme-dark');

  return createPortal(
    <div
      className={cx(
        'kds-toast-container modal-theme-host painel-theme kifer-ds',
        isDarkThemeActive ? 'theme-dark' : 'theme-light',
        `kds-toast-${position}`,
      )}
      aria-live="polite"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const Icon = variantIcons[toast.variant];

  useEffect(() => {
    if (toast.duration <= 0) return;
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      className={cx('kds-toast', variantClasses[toast.variant])}
      role="alert"
      style={{ '--toast-duration': `${toast.duration}ms` } as CSSProperties}
    >
      <Icon className="kds-toast-icon" aria-hidden="true" />
      <div className="kds-toast-content">
        {toast.title && <p className="kds-toast-title">{toast.title}</p>}
        <p className="kds-toast-description">{toast.description}</p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="kds-toast-close"
        aria-label="Fechar notificacao"
      >
        <X className="h-4 w-4" />
      </button>
      {toast.duration > 0 && <span className="kds-toast-progress" aria-hidden="true" />}
    </div>
  );
}
