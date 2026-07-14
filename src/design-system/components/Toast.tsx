import { createContext, useCallback, useContext, useEffect, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, XCircle, AlertTriangle, Info, X, type LucideIcon } from 'lucide-react';

import { cx } from '../../lib/cx';
import Button, { type ButtonSize, type ButtonVariant } from './Button';

export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

export type Toast = {
  id: string;
  title?: string;
  description: string;
  variant: ToastVariant;
  duration: number;
  actions?: ToastAction[];
};

export type ToastAction = {
  label: ReactNode;
  onClick: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

export type ToastInput = {
  title?: string;
  description: string;
  variant?: ToastVariant;
  duration?: number;
  actions?: ToastAction[];
};

export type ToastProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  title?: ReactNode;
  description?: ReactNode;
  variant?: ToastVariant;
  icon?: LucideIcon;
  onDismiss?: () => void;
  actions?: ToastAction[];
  duration?: number;
  showProgress?: boolean;
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
        actions: input.actions,
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

export function Toast({
  title,
  description,
  variant = 'default',
  icon,
  onDismiss,
  actions,
  duration = 5000,
  showProgress = false,
  className,
  style,
  children,
  role = 'alert',
  ...props
}: ToastProps) {
  const Icon = icon ?? variantIcons[variant];

  return (
    <div
      className={cx('kds-toast', variantClasses[variant], className)}
      role={role}
      style={
        showProgress
          ? ({ ...style, '--toast-duration': `${duration}ms` } as CSSProperties)
          : style
      }
      {...props}
    >
      <Icon className="kds-toast-icon" aria-hidden="true" />
      <div className="kds-toast-content">
        {title && <p className="kds-toast-title">{title}</p>}
        {description && <p className="kds-toast-description">{description}</p>}
        {children}
        {actions && actions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {actions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant ?? 'primary'}
                size={action.size ?? 'sm'}
                fullWidth={action.fullWidth}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="kds-toast-close"
          aria-label="Fechar notificacao"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {showProgress && duration > 0 && <span className="kds-toast-progress" aria-hidden="true" />}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  useEffect(() => {
    if (toast.duration <= 0) return;
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <Toast
      title={toast.title}
      description={toast.description}
      variant={toast.variant}
      actions={toast.actions}
      onDismiss={() => onDismiss(toast.id)}
      duration={toast.duration}
      showProgress={toast.duration > 0}
    />
  );
}
