import { useEffect, useMemo, useRef, useState } from 'react';
import { LucideIcon } from 'lucide-react';
import { gsap } from 'gsap';
import { usePanelMotion } from '../hooks/usePanelMotion';

type AnimatedStatCardProps = {
  label: string;
  value: number | string;
  icon: LucideIcon;
  gradient: string;
  iconBg: string;
  prefix?: string;
  suffix?: string;
  subtitle?: string;
  contextLabel?: string;
  contextValue?: string;
  footerLabel?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  onClick?: () => void;
};

export default function AnimatedStatCard({
  label,
  value,
  icon: Icon,
  gradient,
  iconBg,
  prefix = '',
  suffix = '',
  subtitle,
  contextLabel,
  contextValue,
  footerLabel,
  trend,
  onClick,
}: AnimatedStatCardProps) {
  const [displayValue, setDisplayValue] = useState<number | string>(0);
  const isNumeric = typeof value === 'number';
  const counterRef = useRef<{ current: number }>({ current: isNumeric ? value : 0 });
  const { motionEnabled, microDuration } = usePanelMotion();

  useEffect(() => {
    if (!isNumeric) {
      setDisplayValue(value);
      return;
    }

    if (!motionEnabled) {
      setDisplayValue(value);
      counterRef.current.current = value;
      return;
    }

    const counter = counterRef.current;
    const animation = gsap.to(counter, {
      current: value,
      duration:
        prefix === 'R$'
          ? Math.max(0.45, microDuration + 0.48)
          : Math.max(0.38, microDuration + 0.36),
      ease: 'power2.out',
      overwrite: 'auto',
      onUpdate: () => {
        if (prefix === 'R$') {
          const nextValue = Math.round(counter.current * 100) / 100;
          setDisplayValue((current) => (current === nextValue ? current : nextValue));
          return;
        }

        const nextValue = Math.round(counter.current);
        setDisplayValue((current) => (current === nextValue ? current : nextValue));
      },
      onComplete: () => {
        setDisplayValue(value);
      },
    });

    return () => {
      animation.kill();
    };
  }, [isNumeric, microDuration, motionEnabled, prefix, value]);

  const formattedValue = useMemo(() => {
    if (!isNumeric || typeof displayValue !== 'number') {
      return displayValue;
    }

    return displayValue.toLocaleString('pt-BR', {
      minimumFractionDigits: prefix === 'R$' ? 2 : 0,
      maximumFractionDigits: prefix === 'R$' ? 2 : 0,
    });
  }, [displayValue, isNumeric, prefix]);

  const cardContent = (
    <>
      <div
        className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-[0.08] transition-opacity duration-300 group-hover:opacity-[0.14]`}
      />
      <div
        className="absolute inset-x-0 top-0 h-24"
        style={{
          background:
            'linear-gradient(180deg, color-mix(in srgb, var(--panel-surface) 88%, white 12%) 0%, transparent 100%)',
        }}
      />
      <div
        className="absolute right-[-34px] top-[-34px] h-28 w-28 rounded-full blur-2xl"
        style={{ background: 'color-mix(in srgb, var(--panel-surface) 82%, white 18%)' }}
      />

      <div className="relative p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: 'var(--panel-text-muted)' }}
              >
                Panorama
              </p>
              {contextLabel && contextValue && (
                <div
                  className="rounded-full border px-3 py-1 text-[11px] font-semibold shadow-sm"
                  style={{
                    borderColor: 'var(--panel-border-subtle)',
                    background: 'color-mix(in srgb, var(--panel-surface) 88%, transparent)',
                    color: 'var(--panel-text-soft)',
                  }}
                >
                  <span style={{ color: 'var(--panel-text-muted)' }}>{contextLabel}</span>{' '}
                  <span style={{ color: 'var(--panel-text)' }}>{contextValue}</span>
                </div>
              )}
            </div>

            <p className="mb-2 text-sm font-semibold sm:text-base" style={{ color: 'var(--panel-text-soft)' }}>
              {label}
            </p>

            <div className="flex items-end gap-2">
              {prefix && (
                <span className="pb-1 text-lg font-bold sm:text-xl" style={{ color: 'var(--panel-text-soft)' }}>
                  {prefix}
                </span>
              )}
              <p className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl" style={{ color: 'var(--panel-text)' }}>
                {formattedValue}
              </p>
              {suffix && (
                <span className="pb-1 text-base font-semibold sm:text-lg" style={{ color: 'var(--panel-text-muted)' }}>
                  {suffix}
                </span>
              )}
            </div>

            {subtitle && (
              <p className="mt-2 text-sm" style={{ color: 'var(--panel-text-muted)' }}>
                {subtitle}
              </p>
            )}

            {trend && (
              <div className="mt-3 flex items-center gap-2 text-xs sm:text-sm">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                    trend.isPositive
                      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                      : 'bg-red-50 text-red-700 ring-1 ring-red-100'
                  }`}
                >
                  {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value).toFixed(1)}%
                </span>
                <span className="text-xs" style={{ color: 'var(--panel-text-muted)' }}>vs mes anterior</span>
              </div>
            )}
          </div>

          <div
            className={`${iconBg} relative flex h-14 w-14 items-center justify-center rounded-2xl shadow-[0_18px_30px_-18px_rgba(15,23,42,0.45)] transition-transform duration-300 group-hover:scale-[1.04] sm:h-16 sm:w-16`}
          >
            <div className="absolute inset-1 rounded-[14px] border border-white/20" />
            <Icon className="relative h-6 w-6 text-white sm:h-7 sm:w-7" />
          </div>
        </div>

        <div
          className="mt-5 flex items-center justify-between gap-3 border-t pt-4"
          style={{ borderColor: 'var(--panel-border-subtle)' }}
        >
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--panel-text-muted)' }}>
            <span className={`h-2.5 w-2.5 rounded-full bg-gradient-to-br ${gradient}`} />
            <span>{footerLabel || 'Toque para abrir detalhes'}</span>
          </div>
          {onClick && (
            <span
              className="text-xs font-semibold uppercase tracking-[0.14em] transition-colors duration-300"
              style={{ color: 'var(--panel-text-subtle)' }}
            >
              Abrir
            </span>
          )}
        </div>
      </div>

      <div className={`absolute inset-x-5 bottom-0 h-1 rounded-full bg-gradient-to-r ${gradient} opacity-70`} />
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`panel-glass-panel panel-interactive-glass group relative w-full overflow-hidden rounded-[28px] border border-slate-200 text-left shadow-[0_24px_46px_-34px_rgba(15,23,42,0.34)]
        transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_56px_-34px_rgba(15,23,42,0.42)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-amber-500`}
      >
        {cardContent}
      </button>
    );
  }

  return (
    <div
      className={`panel-glass-panel panel-interactive-glass group relative overflow-hidden rounded-[28px] border border-slate-200 shadow-[0_24px_46px_-34px_rgba(15,23,42,0.34)]
        transition-all duration-300`}
    >
      {cardContent}
    </div>
  );
}
