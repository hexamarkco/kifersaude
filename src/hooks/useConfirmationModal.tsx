import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ConfirmDialog,
} from '../design-system';

type ConfirmationOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
};

type ConfirmationState = ConfirmationOptions;

export function useConfirmationModal() {
  const [confirmationState, setConfirmationState] = useState<ConfirmationState | null>(null);
  const pendingResolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  const requestConfirmation = useCallback(
    (options: ConfirmationOptions) =>
      new Promise<boolean>((resolve) => {
        pendingResolverRef.current?.(false);
        pendingResolverRef.current = resolve;
        setConfirmationState(options);
      }),
    [],
  );

  const resolveConfirmation = useCallback((confirmed: boolean) => {
    pendingResolverRef.current?.(confirmed);
    pendingResolverRef.current = null;
    setConfirmationState(null);
  }, []);

  const handleCancel = useCallback(() => {
    resolveConfirmation(false);
  }, [resolveConfirmation]);

  const handleConfirm = useCallback(() => {
    resolveConfirmation(true);
  }, [resolveConfirmation]);

  useEffect(() => {
    return () => {
      pendingResolverRef.current?.(false);
      pendingResolverRef.current = null;
    };
  }, []);

  const ConfirmationDialogElement = useMemo(
    () => (
      <ConfirmDialog
        open={!!confirmationState}
        onOpenChange={(open) => { if (!open) handleCancel(); }}
        title={confirmationState?.title ?? ''}
        confirmLabel={confirmationState?.confirmLabel}
        cancelLabel={confirmationState?.cancelLabel}
        destructive={confirmationState?.tone === 'danger'}
        onConfirm={handleConfirm}
      >
        <Alert tone={confirmationState?.tone === 'danger' ? 'danger' : 'warning'}>
          {confirmationState?.description ?? 'Essa ação pode impactar os dados atuais. Confirme para continuar.'}
        </Alert>
      </ConfirmDialog>
    ),
    [confirmationState, handleCancel, handleConfirm],
  );

  return { requestConfirmation, ConfirmationDialog: ConfirmationDialogElement } as const;
}
