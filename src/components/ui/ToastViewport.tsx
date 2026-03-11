import { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cx } from '../../lib/cx';
import { toastStore, type ToastItem } from '../../lib/toast';

const toneMeta = {
  success: {
    icon: CheckCircle2,
    title: 'Sucesso',
    className:
      'border-[color:rgba(52,211,153,0.35)] bg-[color:rgba(10,24,19,0.94)] text-emerald-50 shadow-[0_18px_40px_-24px_rgba(16,185,129,0.45)]',
    iconClassName: 'text-emerald-300',
    accentClassName: 'bg-emerald-400/80',
  },
  error: {
    icon: AlertCircle,
    title: 'Erro',
    className:
      'border-[color:rgba(248,113,113,0.34)] bg-[color:rgba(32,12,12,0.96)] text-red-50 shadow-[0_18px_40px_-24px_rgba(239,68,68,0.45)]',
    iconClassName: 'text-red-300',
    accentClassName: 'bg-red-400/80',
  },
  warning: {
    icon: AlertTriangle,
    title: 'Atenção',
    className:
      'border-[color:rgba(251,191,36,0.34)] bg-[color:rgba(39,24,8,0.96)] text-amber-50 shadow-[0_18px_40px_-24px_rgba(245,158,11,0.45)]',
    iconClassName: 'text-amber-300',
    accentClassName: 'bg-amber-400/80',
  },
  info: {
    icon: Info,
    title: 'Informação',
    className:
      'border-[color:rgba(96,165,250,0.34)] bg-[color:rgba(10,18,34,0.96)] text-blue-50 shadow-[0_18px_40px_-24px_rgba(59,130,246,0.42)]',
    iconClassName: 'text-blue-300',
    accentClassName: 'bg-blue-400/80',
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

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[160] flex w-[min(92vw,24rem)] flex-col gap-3">
      {items.map((item) => {
        const meta = toneMeta[item.tone];
        const Icon = meta.icon;

        return (
          <div
            key={item.id}
            className={cx(
              'pointer-events-auto relative overflow-hidden rounded-2xl border backdrop-blur-md transition-all duration-200',
              meta.className,
            )}
            role="status"
            aria-live="polite"
          >
            <div className={cx('absolute inset-y-0 left-0 w-1', meta.accentClassName)} />
            <div className="flex items-start gap-3 px-4 py-3">
              <Icon className={cx('mt-0.5 h-5 w-5 flex-shrink-0', meta.iconClassName)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.title || meta.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-white/88">{item.message}</p>
              </div>
              <button
                type="button"
                onClick={() => toastStore.dismiss(item.id)}
                className="rounded-lg p-1 text-white/64 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Fechar notificação"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
