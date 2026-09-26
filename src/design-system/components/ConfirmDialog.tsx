import { useEffect, useRef, useState, type ReactNode } from 'react';

import Button from './Button';
import { Dialog, DialogBody, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './Dialog';

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  destructive?: boolean;
  loading?: boolean;
  closeOnConfirm?: boolean;
  children?: ReactNode;
};

/** A controlled confirmation dialog with consistent cancellation and destructive actions. */
export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  loading = false,
  closeOnConfirm = false,
  children,
}: ConfirmDialogProps) {
  const [confirming, setConfirming] = useState(false);
  const confirmingRef = useRef(false);
  const busy = loading || confirming;

  useEffect(() => {
    if (!open) {
      confirmingRef.current = false;
      setConfirming(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (busy || confirmingRef.current) return;

    confirmingRef.current = true;
    setConfirming(true);
    try {
      await onConfirm();
      if (closeOnConfirm) onOpenChange(false);
    } finally {
      confirmingRef.current = false;
      setConfirming(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && !busy && onOpenChange(false)}
      closeOnOverlay={!busy}
      closeOnEscape={!busy}
      size="sm"
    >
      <DialogHeader onClose={busy ? undefined : () => onOpenChange(false)}>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      {children && <DialogBody>{children}</DialogBody>}
      <DialogFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button variant={destructive ? 'destructive' : 'primary'} onClick={() => void handleConfirm()} loading={busy}>
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
