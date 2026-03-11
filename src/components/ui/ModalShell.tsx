import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cx } from '../../lib/cx';

export type ModalShellSize = 'sm' | 'md' | 'lg' | 'xl';

type ModalShellProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: ModalShellSize;
  closeOnOverlay?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  panelClassName?: string;
  bodyClassName?: string;
};

const sizeClasses: Record<ModalShellSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
};

export default function ModalShell({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnOverlay = true,
  closeOnEscape = true,
  showCloseButton = true,
  panelClassName,
  bodyClassName,
}: ModalShellProps) {
  const titleId = useId();
  const descriptionId = useId();

  const portalTarget = typeof document === 'undefined' ? null : document.body;
  const isDarkThemeActive =
    typeof document !== 'undefined' && document.querySelector('.painel-theme')?.classList.contains('theme-dark');

  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [closeOnEscape, isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !portalTarget) {
    return null;
  }

  return createPortal(
    <div className={cx('modal-theme-host painel-theme kifer-ds', isDarkThemeActive ? 'theme-dark' : 'theme-light')}>
      <div
        className="fixed inset-0 z-[80] bg-stone-950/60 backdrop-blur-sm"
        aria-hidden="true"
        onClick={() => {
          if (closeOnOverlay) {
            onClose();
          }
        }}
      />
      <div className="fixed inset-0 z-[90] flex items-stretch justify-center overflow-y-auto px-0 py-0 sm:items-center sm:px-4 sm:py-6">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descriptionId : undefined}
          className={cx(
            'modal-panel panel-glass-strong flex w-full max-h-[100dvh] flex-col overflow-hidden rounded-2xl border border-amber-200 sm:max-h-[calc(100dvh-3rem)]',
            sizeClasses[size],
            panelClassName,
          )}
          onClick={(event) => event.stopPropagation()}
        >
          {(title || description || showCloseButton) && (
            <header className="relative border-b border-amber-200 px-5 py-4 sm:px-6">
              {title && (
                <h2 id={titleId} className="pr-10 text-base font-semibold text-slate-900 sm:text-lg">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descriptionId} className="mt-1 pr-10 text-sm text-slate-600">
                  {description}
                </p>
              )}

              {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-3 top-3 rounded-lg p-2 text-slate-400 transition-colors hover:bg-amber-50 hover:text-amber-700"
                    aria-label="Fechar modal"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                )}
            </header>
          )}

          <div className={cx('modal-panel-content min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5', bodyClassName)}>
            {children}
          </div>

          {footer && <footer className="border-t border-amber-200 px-5 py-4 sm:px-6">{footer}</footer>}
        </section>
      </div>
    </div>,
    portalTarget,
  );
}
