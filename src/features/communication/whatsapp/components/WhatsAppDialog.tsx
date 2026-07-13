import type { ReactNode } from 'react';

import {
  Dialog,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../design-system';

type WhatsAppDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnOverlay?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  panelClassName?: string;
  bodyClassName?: string;
  bodyScrollable?: boolean;
};

/** DS dialog adapter that preserves the inbox overlay API without its legacy shell. */
export default function WhatsAppDialog({
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
}: WhatsAppDialogProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      size={size}
      closeOnOverlay={closeOnOverlay}
      closeOnEscape={closeOnEscape}
      className={`flex max-h-[100dvh] w-full flex-col overflow-hidden sm:max-h-[calc(100dvh-3rem)] ${panelClassName ?? ''}`}
    >
      {(title || description || showCloseButton) && (
        <DialogHeader onClose={onClose} showCloseButton={showCloseButton}>
          {title && <DialogTitle>{title}</DialogTitle>}
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
      )}
      <DialogBody
        scrollable={bodyScrollable}
        className={`min-h-0 flex-1 ${!bodyScrollable ? 'overflow-hidden' : ''} ${bodyClassName ?? ''}`}
      >
        {children}
      </DialogBody>
      {footer && <DialogFooter>{footer}</DialogFooter>}
    </Dialog>
  );
}
