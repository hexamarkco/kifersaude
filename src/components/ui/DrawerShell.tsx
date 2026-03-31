import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import { cx } from '../../lib/cx';

type DrawerShellProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  closeOnOverlay?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  closeButtonLabel?: string;
  panelClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  overlayClassName?: string;
  ariaLabel?: string;
};

export default function DrawerShell({
  isOpen,
  onClose,
  title,
  description,
  eyebrow,
  children,
  footer,
  closeOnOverlay = true,
  closeOnEscape = true,
  showCloseButton = true,
  closeButtonLabel = 'Fechar painel lateral',
  panelClassName,
  bodyClassName,
  footerClassName,
  overlayClassName,
  ariaLabel,
}: DrawerShellProps) {
  const titleId = useId();
  const descriptionId = useId();
  const portalTarget = typeof document === 'undefined' ? null : document.body;
  const themedAncestor = typeof document === 'undefined' ? null : document.querySelector('.painel-theme');
  const themeScopeClassName = cx(
    'modal-theme-host painel-theme kifer-ds',
    themedAncestor?.classList.contains('theme-dark') ? 'theme-dark' : 'theme-light',
  );

  useEffect(() => {
    if (!isOpen || !closeOnEscape) {
      return;
    }

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

  if (!isOpen || !portalTarget) {
    return null;
  }

  return createPortal(
    <div className={themeScopeClassName}>
      <div
        className={cx('fixed inset-0 z-[95] bg-stone-950/50 backdrop-blur-[2px]', overlayClassName)}
        aria-hidden="true"
        onClick={() => {
          if (closeOnOverlay) {
            onClose();
          }
        }}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title ? undefined : ariaLabel}
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        className={cx(
          'fixed inset-y-0 right-0 z-[100] flex w-full max-w-[440px] flex-col border-l border-[var(--panel-border-subtle,#d7c7b2)] bg-[var(--panel-surface,#fffdfa)] shadow-2xl',
          panelClassName,
        )}
      >
        {(eyebrow || title || description || showCloseButton) && (
          <header className="relative border-b border-[var(--panel-border-subtle,#e7dac8)] px-5 py-4">
            {eyebrow ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--panel-text-muted,#8a735f)]">
                {eyebrow}
              </p>
            ) : null}

            {title ? (
              <h2 id={titleId} className="mt-1 pr-10 text-lg font-semibold text-[var(--panel-text,#1c1917)]">
                {title}
              </h2>
            ) : null}

            {description ? (
              <p id={descriptionId} className="mt-1 pr-10 text-sm text-[var(--panel-text-muted,#876f5c)]">
                {description}
              </p>
            ) : null}

            {showCloseButton ? (
              <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 rounded-full p-2 text-[var(--panel-text-muted,#8a735f)] transition-colors hover:bg-[var(--panel-surface-soft,#f4ede3)] hover:text-[var(--panel-text,#1c1917)]"
                aria-label={closeButtonLabel}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            ) : null}
          </header>
        )}

        <div className={cx('min-h-0 flex-1 overflow-y-auto px-5 py-4', bodyClassName)}>{children}</div>

        {footer ? (
          <footer className={cx('border-t border-[var(--panel-border-subtle,#e7dac8)] px-5 py-4', footerClassName)}>
            {footer}
          </footer>
        ) : null}
      </aside>
    </div>,
    portalTarget,
  );
}
