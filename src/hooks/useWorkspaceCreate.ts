import { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';

type WorkspaceCreateRequest = {
  createRequested: boolean;
  consumeCreateRequest: () => void;
};

/** Opens the destination's existing creation flow once for a workspace shortcut. */
export function useWorkspaceCreate(canCreate: boolean, open: () => void) {
  const { createRequested, consumeCreateRequest } = useOutletContext<WorkspaceCreateRequest | null>() ?? {};

  useEffect(() => {
    if (!createRequested) return;
    if (canCreate) open();
    consumeCreateRequest?.();
  }, [canCreate, consumeCreateRequest, createRequested, open]);
}
