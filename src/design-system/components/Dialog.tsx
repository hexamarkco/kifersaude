import { createContext, useContext, useEffect, useId, type HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import { cx } from '../../lib/cx';

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export type DialogProps = HTMLAttributes<HTMLDivElement> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  size?: DialogSize;
  closeOnOverlay?: boolean;
  closeOnEscape?: boolean;
};

const sizeClasses: Record<DialogSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
  full: 'max-w-[90vw]',
};

let scrollLockCount = 0;
let originalOverflow = '';
const DialogTitleIdContext = createContext<string | undefined>(undefined);

export function Dialog({
  open,
  onOpenChange,
  size = 'md',
  closeOnOverlay = true,
  closeOnEscape = true,
  className,
  children,
  ...props
}: DialogProps) {
  const titleId = useId();
  const isDarkThemeActive =
    typeof document !== 'undefined' && document.querySelector('.painel-theme')?.classList.contains('theme-dark');

  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [closeOnEscape, open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    if (scrollLockCount === 0) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    scrollLockCount += 1;
    return () => {
      scrollLockCount = Math.max(0, scrollLockCount - 1);
      if (scrollLockCount === 0) document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className={cx(
        'kds-dialog-overlay modal-theme-host painel-theme kifer-ds',
        isDarkThemeActive ? 'theme-dark' : 'theme-light',
      )}
    >
      <div
        className="kds-dialog-backdrop"
        onClick={() => closeOnOverlay && onOpenChange(false)}
      />
      <div className="kds-dialog-container">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={props['aria-label'] ? undefined : titleId}
          className={cx('kds-dialog', sizeClasses[size], className)}
          onClick={(e) => e.stopPropagation()}
          {...props}
        >
          <DialogTitleIdContext.Provider value={titleId}>
            {children}
          </DialogTitleIdContext.Provider>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export type DialogHeaderProps = HTMLAttributes<HTMLDivElement> & {
  onClose?: () => void;
  showCloseButton?: boolean;
};

export function DialogHeader({
  onClose,
  showCloseButton = true,
  className,
  children,
  ...props
}: DialogHeaderProps) {
  return (
    <div className={cx('kds-dialog-header', className)} {...props}>
      <div className="min-w-0 flex-1">{children}</div>
      {showCloseButton && onClose && (
        <button
          type="button"
          onClick={onClose}
          className="kds-dialog-close"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export type DialogTitleProps = HTMLAttributes<HTMLHeadingElement>;

export function DialogTitle({ className, children, ...props }: DialogTitleProps) {
  const titleId = useContext(DialogTitleIdContext);

  return (
    <h2 id={props.id ?? titleId} className={cx('kds-dialog-title', className)} {...props}>
      {children}
    </h2>
  );
}

export type DialogDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

export function DialogDescription({ className, children, ...props }: DialogDescriptionProps) {
  return (
    <p className={cx('kds-dialog-description', className)} {...props}>
      {children}
    </p>
  );
}

export type DialogBodyProps = HTMLAttributes<HTMLDivElement> & {
  scrollable?: boolean;
};

export function DialogBody({ scrollable = true, className, children, ...props }: DialogBodyProps) {
  return (
    <div
      className={cx(
        'kds-dialog-body',
        scrollable && 'overflow-y-auto',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export type DialogFooterProps = HTMLAttributes<HTMLDivElement>;

export function DialogFooter({ className, children, ...props }: DialogFooterProps) {
  return (
    <div className={cx('kds-dialog-footer', className)} {...props}>
      {children}
    </div>
  );
}
