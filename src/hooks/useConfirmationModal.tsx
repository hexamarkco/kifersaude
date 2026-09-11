import { useCallback, useMemo, useState } from 'react';
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

type ConfirmationState = ConfirmationOptions & {
  resolver: (confirmed: boolean) => void;
};

export function useConfirmationModal() {
  const [confirmationState, setConfirmationState] = useState<ConfirmationState | null>(null);

  const requestConfirmation = useCallback(
    (options: ConfirmationOptions) =>
      new Promise<boolean>((resolve) => {
        setConfirmationState({ ...options, resolver: resolve });
      }),
    [],
  );

  const handleCancel = useCallback(() => {
    confirmationState?.resolver(false);
    setConfirmationState(null);
  }, [confirmationState]);

  const handleConfirm = useCallback(() => {
    confirmationState?.resolver(true);
    setConfirmationState(null);
  }, [confirmationState]);

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
