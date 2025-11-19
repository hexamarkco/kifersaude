import { useCallback, useMemo, useState } from 'react';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';

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

  const ConfirmationDialog = useMemo(
    () => (
      <ConfirmationModal
        isOpen={!!confirmationState}
        title={confirmationState?.title ?? ''}
        description={confirmationState?.description}
        confirmLabel={confirmationState?.confirmLabel}
        cancelLabel={confirmationState?.cancelLabel}
        tone={confirmationState?.tone}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
      />
    ),
    [confirmationState, handleCancel, handleConfirm],
  );

  return { requestConfirmation, ConfirmationDialog } as const;
}
