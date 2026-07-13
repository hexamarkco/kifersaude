import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cx } from '../../lib/cx';

let bodyScrollLockCount = 0;
let originalBodyOverflow = '';

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
  bodyScrollable?: boolean;
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
  bodyScrollable = true,
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

    if (bodyScrollLockCount === 0) {
      originalBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }

    bodyScrollLockCount += 1;

    return () => {
      bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);

      if (bodyScrollLockCount === 0) {
        document.body.style.overflow = originalBodyOverflow;
      }
    };
  }, [isOpen]);

  if (!isOpen || !portalTarget) {
    return null;
  }

  return createPortal(
    <div className={cx('modal-theme-host painel-theme kifer-ds', isDarkThemeActive ? 'theme-dark' : 'theme-light')}>
      <div
        className="kds-dialog-backdrop fixed inset-0 z-[130]"
        aria-hidden="true"
        onClick={() => {
          if (closeOnOverlay) {
            onClose();
          }
        }}
      />
      <div className="fixed inset-0 z-[140] flex items-stretch justify-center overflow-y-auto px-0 py-0 sm:items-center sm:px-4 sm:py-6">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descriptionId : undefined}
          className={cx(
            'modal-panel kds-dialog flex w-full max-h-[100dvh] flex-col overflow-hidden rounded-none sm:max-h-[calc(100dvh-3rem)] sm:rounded-2xl',
            sizeClasses[size],
            panelClassName,
          )}
          onClick={(event) => event.stopPropagation()}
        >
          {(title || description || showCloseButton) && (
            <header className="kds-dialog-header relative">
              {title && (
                <h2
                  id={titleId}
                  className="kds-dialog-title pr-10"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p
                  id={descriptionId}
                  className="kds-dialog-description pr-10"
                >
                  {description}
                </p>
              )}

              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  className="kds-dialog-close absolute right-3 top-3"
                  aria-label="Fechar modal"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
            </header>
          )}

          <div
            className={cx(
              'modal-panel-content kds-dialog-body min-h-0 flex-1',
              bodyScrollable ? 'overflow-y-auto' : 'overflow-hidden',
              bodyClassName,
            )}
          >
            {children}
          </div>

          {footer && (
            <footer className="kds-dialog-footer">
              {footer}
            </footer>
          )}
        </section>
      </div>
    </div>,
    portalTarget,
  );
}
