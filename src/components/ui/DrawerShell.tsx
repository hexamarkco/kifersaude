import type { ReactNode } from 'react';
import { X } from 'lucide-react';

import { Drawer, DrawerBody, DrawerFooter, DrawerHeader } from '../../design-system';

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

/** Compatibility adapter for right-side DS drawers. */
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
  void overlayClassName;

  return (
    <Drawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      closeOnOverlay={closeOnOverlay}
      closeOnEscape={closeOnEscape}
      side="right"
      aria-label={title ? undefined : ariaLabel}
      className={panelClassName}
    >
      {(eyebrow || title || description || showCloseButton) && (
        <DrawerHeader className="relative">
          {eyebrow && <p className="kds-eyebrow">{eyebrow}</p>}
          {title && <h2 className="kds-drawer-title">{title}</h2>}
          {description && <p className="kds-drawer-description">{description}</p>}
          {showCloseButton && (
            <button type="button" onClick={onClose} className="kds-dialog-close" aria-label={closeButtonLabel}>
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </DrawerHeader>
      )}
      <DrawerBody className={bodyClassName}>{children}</DrawerBody>
      {footer && <DrawerFooter className={footerClassName}>{footer}</DrawerFooter>}
    </Drawer>
  );
}
