import { createContext, useContext } from 'react';

import type { ToastInput } from './Toast';

export type ToastContextValue = {
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
