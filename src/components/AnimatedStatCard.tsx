import { useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { gsap } from 'gsap';
import { usePanelMotion } from '../hooks/usePanelMotion';

type AnimatedStatCardTone = 'brand' | 'earth' | 'forest' | 'plum' | 'copper';

type AnimatedStatCardProps = {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: AnimatedStatCardTone;
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

const toneStyles: Record<
  AnimatedStatCardTone,
  {
    halo: string;
    iconShell: string;
    iconInset: string;
    iconColor: string;
    accent: string;
    accentSoft: string;
  }
> = {
  brand: {
    halo: 'radial-gradient(circle at top right, rgba(212,120,42,0.18), transparent 44%), radial-gradient(circle at bottom left, rgba(120,72,34,0.14), transparent 42%)',
    iconShell: 'linear-gradient(180deg, rgba(214,130,54,0.18), rgba(132,78,33,0.3))',
    iconInset: 'rgba(245,197,132,0.14)',
    iconColor: 'var(--panel-accent-warm,#efcf9f)',
    accent: 'var(--panel-accent-strong,#b85c1f)',
    accentSoft: 'rgba(216,135,53,0.18)',
  },
  earth: {
    halo: 'radial-gradient(circle at top right, rgba(162,111,72,0.16), transparent 44%), radial-gradient(circle at bottom left, rgba(91,70,53,0.12), transparent 42%)',
    iconShell: 'linear-gradient(180deg, rgba(157,127,90,0.16), rgba(91,70,53,0.26))',
    iconInset: 'rgba(228,213,192,0.12)',
    iconColor: 'var(--panel-text-soft,#5b4635)',
    accent: 'var(--panel-border-strong,#9d7f5a)',
    accentSoft: 'rgba(157,127,90,0.16)',
  },
  forest: {
    halo: 'radial-gradient(circle at top right, rgba(87,133,90,0.18), transparent 44%), radial-gradient(circle at bottom left, rgba(39,92,57,0.14), transparent 42%)',
    iconShell: 'linear-gradient(180deg, rgba(149,196,161,0.18), rgba(39,92,57,0.28))',
    iconInset: 'rgba(214,234,216,0.12)',
    iconColor: 'var(--panel-accent-green-text,#275c39)',
    accent: 'var(--panel-accent-green-border,#95c4a1)',
    accentSoft: 'rgba(149,196,161,0.16)',
  },
  plum: {
    halo: 'radial-gradient(circle at top right, rgba(134,92,158,0.18), transparent 44%), radial-gradient(circle at bottom left, rgba(91,52,115,0.14), transparent 42%)',
    iconShell: 'linear-gradient(180deg, rgba(172,140,197,0.18), rgba(96,58,126,0.3))',
    iconInset: 'rgba(221,205,235,0.12)',
    iconColor: '#d7b9f1',
    accent: '#9b5fd1',
    accentSoft: 'rgba(155,95,209,0.18)',
  },
  copper: {
    halo: 'radial-gradient(circle at top right, rgba(198,108,52,0.18), transparent 44%), radial-gradient(circle at bottom left, rgba(132,63,26,0.16), transparent 42%)',
    iconShell: 'linear-gradient(180deg, rgba(226,150,92,0.18), rgba(142,70,30,0.32))',
    iconInset: 'rgba(242,204,171,0.12)',
    iconColor: '#f2bf8f',
    accent: '#cf6a2d',
    accentSoft: 'rgba(207,106,45,0.18)',
  },
};

const trendToneStyles = {
  positive: {
    background: 'var(--panel-accent-green-bg,#edf6ef)',
    border: 'var(--panel-accent-green-border,#95c4a1)',
    color: 'var(--panel-accent-green-text,#275c39)',
  },
  negative: {
    background: 'var(--panel-accent-red-bg,#faecea)',
    border: 'var(--panel-accent-red-border,#d79a8f)',
    color: 'var(--panel-accent-red-text,#8a3128)',
  },
} as const;

export default function AnimatedStatCard({
  label,
  value,
  icon: Icon,
  tone = 'brand',
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
  const toneMeta = toneStyles[tone];

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

  const trendTone = trend?.isPositive ? trendToneStyles.positive : trendToneStyles.negative;

  const cardContent = (
    <>
      <div
        className="absolute inset-0 opacity-100"
        style={{
          background:
            `linear-gradient(180deg, color-mix(in srgb, var(--panel-surface,#fffdfa) 97%, white 3%) 0%, color-mix(in srgb, var(--panel-surface,#fffdfa) 92%, var(--panel-surface-soft,#efe6d8) 8%) 100%), ${toneMeta.halo}`,
        }}
      />
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent 0%, var(--panel-border-strong,#9d7f5a) 48%, transparent 100%)' }}
      />
      <div
        className="absolute inset-x-6 bottom-0 h-[2px] rounded-full"
        style={{ background: `linear-gradient(90deg, transparent 0%, ${toneMeta.accent} 20%, ${toneMeta.accent} 80%, transparent 100%)` }}
      />

      <div className="relative flex h-full flex-col p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-5 flex items-center justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: 'var(--panel-text-muted,#876f5c)' }}>
                Panorama
              </p>
              {contextLabel && contextValue && (
                <div
                  className="rounded-full border px-3 py-1.5 text-[11px] font-semibold"
                  style={{
                    borderColor: 'var(--panel-border-subtle,#e4d5c0)',
                    background: 'color-mix(in srgb, var(--panel-surface-soft,#efe6d8) 64%, transparent)',
                    color: 'var(--panel-text-soft,#5b4635)',
                    boxShadow: `inset 0 1px 0 ${toneMeta.accentSoft}`,
                  }}
                >
                  <span style={{ color: 'var(--panel-text-muted,#876f5c)' }}>{contextLabel}</span>{' '}
                  <span style={{ color: 'var(--panel-text,#1c1917)' }}>{contextValue}</span>
                </div>
              )}
            </div>

            <p className="text-base font-semibold sm:text-[1.05rem]" style={{ color: 'var(--panel-text-soft,#5b4635)' }}>
              {label}
            </p>

            <div className="mt-5 flex items-end gap-2">
              {prefix && (
                <span className="pb-1 text-lg font-bold sm:text-xl" style={{ color: 'var(--panel-text-soft,#5b4635)' }}>
                  {prefix}
                </span>
              )}
              <p
                className="text-[2.15rem] font-black leading-none tracking-[-0.05em] sm:text-[2.55rem]"
                style={{ color: 'var(--panel-text,#1c1917)' }}
              >
                {formattedValue}
              </p>
              {suffix && (
                <span className="pb-1 text-base font-bold sm:text-lg" style={{ color: 'var(--panel-text-muted,#876f5c)' }}>
                  {suffix}
                </span>
              )}
            </div>

            {subtitle && (
              <p className="mt-3 text-sm" style={{ color: 'var(--panel-text-muted,#876f5c)' }}>
                {subtitle}
              </p>
            )}

            {trend && trendTone && (
              <div className="mt-4 flex items-center gap-2 text-xs sm:text-sm">
                <span
                  className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
                  style={{
                    background: trendTone.background,
                    borderColor: trendTone.border,
                    color: trendTone.color,
                  }}
                >
                  {trend.isPositive ? '+' : '-'} {Math.abs(trend.value).toFixed(1)}%
                </span>
                <span className="text-xs" style={{ color: 'var(--panel-text-muted,#876f5c)' }}>
                  vs. mês anterior
                </span>
              </div>
            )}
          </div>

          <div
            className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.4rem] border sm:h-[4.5rem] sm:w-[4.5rem]"
            style={{
              borderColor: 'var(--panel-border,#d4c0a7)',
              background: toneMeta.iconShell,
              boxShadow: `inset 0 1px 0 ${toneMeta.accentSoft}, 0 18px 30px -24px rgba(20, 12, 8, 0.52)`,
            }}
          >
            <div
              className="absolute inset-[5px] rounded-[1.05rem] border"
              style={{
                borderColor: 'rgba(255,255,255,0.08)',
                background: toneMeta.iconInset,
              }}
            />
            <Icon className="relative h-6 w-6 sm:h-7 sm:w-7" style={{ color: toneMeta.iconColor }} />
          </div>
        </div>

        <div
          className="mt-6 flex items-center justify-between gap-3 border-t pt-4"
          style={{ borderColor: 'var(--panel-border-subtle,#e4d5c0)' }}
        >
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--panel-text-muted,#876f5c)' }}>
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                background: toneMeta.accent,
                boxShadow: `0 0 0 6px ${toneMeta.accentSoft}`,
              }}
            />
            <span>{footerLabel || 'Toque para abrir detalhes'}</span>
          </div>
          {onClick && (
            <span
              className="text-xs font-black uppercase tracking-[0.18em]"
              style={{ color: 'var(--panel-accent-strong,#b85c1f)' }}
            >
              Abrir
            </span>
          )}
        </div>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="panel-glass-panel panel-interactive-glass group relative h-full w-full overflow-hidden rounded-[2rem] border text-left shadow-[0_26px_50px_-38px_rgba(26,18,13,0.38)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_30px_54px_-36px_rgba(26,18,13,0.46)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--panel-focus,#c86f1d)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--panel-bg,#f8f5ef)]"
        style={{
          borderColor: 'var(--panel-border,#d4c0a7)',
          background: 'var(--panel-surface,#fffdfa)',
        }}
      >
        {cardContent}
      </button>
    );
  }

  return (
    <div
      className="panel-glass-panel group relative h-full overflow-hidden rounded-[2rem] border shadow-[0_26px_50px_-38px_rgba(26,18,13,0.38)] transition-all duration-300"
      style={{
        borderColor: 'var(--panel-border,#d4c0a7)',
        background: 'var(--panel-surface,#fffdfa)',
      }}
    >
      {cardContent}
    </div>
  );
}
