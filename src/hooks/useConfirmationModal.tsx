import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  content?: ReactNode;
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
        description={confirmationState?.content ? confirmationState.description : undefined}
        confirmLabel={confirmationState?.confirmLabel}
        cancelLabel={confirmationState?.cancelLabel}
        destructive={confirmationState?.tone === 'danger'}
        onConfirm={handleConfirm}
      >
        {confirmationState?.content ?? (
          <Alert tone={confirmationState?.tone === 'danger' ? 'danger' : 'warning'}>
            {confirmationState?.description ?? 'Essa ação pode impactar os dados atuais. Confirme para continuar.'}
          </Alert>
        )}
      </ConfirmDialog>
    ),
    [confirmationState, handleCancel, handleConfirm],
  );

  return { requestConfirmation, ConfirmationDialog: ConfirmationDialogElement } as const;
}
