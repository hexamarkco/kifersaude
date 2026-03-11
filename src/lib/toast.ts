type ToastTone = 'success' | 'error' | 'warning' | 'info';

export type ToastItem = {
  id: string;
  message: string;
  title?: string;
  tone: ToastTone;
  durationMs?: number;
};

type ToastInput = Omit<ToastItem, 'id'>;
type ToastListener = (items: ToastItem[]) => void;

const listeners = new Set<ToastListener>();
let items: ToastItem[] = [];

const emit = () => {
  listeners.forEach((listener) => listener(items));
};

const subscribe = (listener: ToastListener) => {
  listeners.add(listener);
  listener(items);
  return () => {
    listeners.delete(listener);
  };
};

const dismiss = (id: string) => {
  items = items.filter((item) => item.id !== id);
  emit();
};

const show = ({ tone, title, message, durationMs = 4200 }: ToastInput) => {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  items = [...items, { id, tone, title, message, durationMs }];
  emit();
  return id;
};

const createToneDispatcher = (tone: ToastTone) => (message: string, options?: Omit<ToastInput, 'tone' | 'message'>) =>
  show({
    tone,
    message,
    title: options?.title,
    durationMs: options?.durationMs,
  });

export const toastStore = {
  subscribe,
  dismiss,
};

export const toast = {
  show,
  dismiss,
  success: createToneDispatcher('success'),
  error: createToneDispatcher('error'),
  warning: createToneDispatcher('warning'),
  info: createToneDispatcher('info'),
};
