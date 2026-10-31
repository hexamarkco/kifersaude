import { createContext, useContext, useEffect, useId, useRef, type HTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import { cx } from '../../lib/cx';
import { useDesignSystemAppearance } from '../appearanceContext';
import InfoTooltip from './InfoTooltip';

export type DialogSize = 'sm' | 'md' | 'form' | 'lg' | 'xl' | 'wide' | 'full';
export type DialogPresentation = 'standard' | 'workspace';

export type DialogProps = HTMLAttributes<HTMLDivElement> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  size?: DialogSize;
  initialFocus?: 'first' | 'first-content';
  closeOnOverlay?: boolean;
  closeOnEscape?: boolean;
  presentation?: DialogPresentation;
};

const sizeClasses: Record<DialogSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  form: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-6xl',
  wide: 'kds-dialog-wide',
  full: 'max-w-[90rem]',
};

let scrollLockCount = 0;
let originalOverflow = '';
const DialogTitleIdContext = createContext<string | undefined>(undefined);
const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function Dialog({
  open,
  onOpenChange,
  size = 'md',
  initialFocus = 'first',
  closeOnOverlay = true,
  closeOnEscape = true,
  presentation = 'standard',
  className,
  children,
  ...props
}: DialogProps) {
  const titleId = useId();
  const appearance = useDesignSystemAppearance();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const isDarkThemeActive =
    appearance ? appearance.theme === 'dark' : typeof document !== 'undefined' && document.querySelector('.painel-theme')?.classList.contains('theme-dark');

  useEffect(() => {
    if (!open) return;

    previouslyFocusedElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;

      const content = initialFocus === 'first-content'
        ? dialog.querySelector<HTMLElement>('.kds-dialog-body')
        : null;
      const focusTarget = content?.querySelector<HTMLElement>(focusableSelector)
        ?? (initialFocus === 'first-content'
          ? null
          : dialog.querySelector<HTMLElement>(focusableSelector));
      (focusTarget ?? dialog).focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (previouslyFocusedElementRef.current?.isConnected) {
        previouslyFocusedElementRef.current.focus();
      }
    };
  }, [initialFocus, open]);

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

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusableElements = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));

      if (focusableElements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', trapFocus);
    return () => document.removeEventListener('keydown', trapFocus);
  }, [open]);

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
        appearance && 'kds-operational',
      )}
    >
      <div
        className="kds-dialog-backdrop"
        onClick={() => closeOnOverlay && onOpenChange(false)}
      />
      <div className="kds-dialog-container">
        <div
          ref={dialogRef}
          data-size={size}
          role="dialog"
          aria-modal="true"
          aria-labelledby={props['aria-label'] ? undefined : titleId}
          tabIndex={props.tabIndex ?? -1}
          className={cx('kds-dialog', presentation === 'workspace' && 'kds-dialog-workspace', sizeClasses[size], className)}
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
          <X aria-hidden="true" />
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

export type DialogDescriptionPlacement = 'tooltip' | 'visible';
export type DialogDescriptionProps = HTMLAttributes<HTMLParagraphElement> & {
  placement?: DialogDescriptionPlacement;
};

export function DialogDescription({ className, children, placement = 'tooltip', ...props }: DialogDescriptionProps) {
  if (placement === 'tooltip') {
    return (
      <p className={cx('kds-dialog-description kds-dialog-description-tooltip', className)} {...props}>
        <InfoTooltip content={children} label="Informações sobre esta janela" />
      </p>
    );
  }

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

export type DialogShellProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: string;
  descriptionPlacement?: DialogDescriptionPlacement;
  children: ReactNode;
  footer?: ReactNode;
  size?: DialogSize;
  initialFocus?: 'first' | 'first-content';
  presentation?: DialogPresentation;
  closeOnOverlay?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  panelClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  bodyScrollable?: boolean;
};

/** Canonical composed dialog for flows that do not need custom compound markup. */
export function DialogShell({
  isOpen,
  onClose,
  title,
  description,
  descriptionPlacement = 'tooltip',
  children,
  footer,
  size = 'md',
  initialFocus = 'first',
  presentation = 'standard',
  closeOnOverlay = true,
  closeOnEscape = true,
  showCloseButton = true,
  panelClassName,
  bodyClassName,
  footerClassName,
  bodyScrollable = true,
}: DialogShellProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}
      size={size}
      initialFocus={initialFocus}
      presentation={presentation}
      closeOnOverlay={closeOnOverlay}
      closeOnEscape={closeOnEscape}
      className={panelClassName}
    >
      {(title || description || showCloseButton) && (
        <DialogHeader onClose={onClose} showCloseButton={showCloseButton}>
          {title && <DialogTitle>{title}</DialogTitle>}
          {description && <DialogDescription placement={descriptionPlacement}>{description}</DialogDescription>}
        </DialogHeader>
      )}
      <DialogBody scrollable={bodyScrollable} className={bodyClassName}>{children}</DialogBody>
      {footer && <DialogFooter className={footerClassName}>{footer}</DialogFooter>}
    </Dialog>
  );
}

export type WorkspaceDialogProps = Omit<DialogShellProps, 'presentation'>;

export function WorkspaceDialog(props: WorkspaceDialogProps) {
  return <DialogShell {...props} presentation="workspace" />;
}
