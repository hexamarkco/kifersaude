import { useEffect, useState } from 'react';

import { Toast } from '../../design-system';
import { toastStore, type ToastItem } from '../../lib/toast';

const toneMeta = {
  success: {
    title: 'Sucesso',
    variant: 'success',
  },
  error: {
    title: 'Erro',
    variant: 'error',
  },
  warning: {
    title: 'Atenção',
    variant: 'warning',
  },
  info: {
    title: 'Informação',
    variant: 'info',
  },
} as const;

export default function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => toastStore.subscribe(setItems), []);

  useEffect(() => {
    if (items.length === 0) return;

    const timers = items.map((item) =>
      window.setTimeout(() => {
        toastStore.dismiss(item.id);
      }, item.durationMs ?? 4200),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [items]);

  if (items.length === 0) return null;

  const isDarkThemeActive = typeof document !== 'undefined'
    && document.querySelector('.painel-theme')?.classList.contains('theme-dark');

  return (
    <div className={`modal-theme-host painel-theme kifer-ds ${isDarkThemeActive ? 'theme-dark' : 'theme-light'} pointer-events-none fixed bottom-5 right-5 z-[500] flex w-[min(calc(100vw-2.5rem),22rem)] flex-col gap-3 sm:bottom-6 sm:right-6`}>
      {items.map((item) => {
        const meta = toneMeta[item.tone];

        return (
          <Toast
            key={item.id}
            className="pointer-events-auto"
            role="status"
            aria-live="polite"
            title={item.title || meta.title}
            description={item.message}
            variant={meta.variant}
            onDismiss={() => toastStore.dismiss(item.id)}
            duration={item.durationMs ?? 4200}
            showProgress
          />
        );
      })}
    </div>
  );
}
