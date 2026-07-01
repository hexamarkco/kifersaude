import { useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { gsap } from 'gsap';
import { usePanelMotion } from '../hooks/usePanelMotion';
import { ActionSurface, Surface } from '../design-system';

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
    halo: 'var(--stat-brand-halo)',
    iconShell: 'var(--stat-brand-icon-bg)',
    iconInset: 'var(--stat-brand-icon-inset)',
    iconColor: 'var(--stat-brand-icon)',
    accent: 'var(--stat-brand-accent)',
    accentSoft: 'var(--stat-brand-soft)',
  },
  earth: {
    halo: 'var(--stat-earth-halo)',
    iconShell: 'var(--stat-earth-icon-bg)',
    iconInset: 'var(--stat-earth-icon-inset)',
    iconColor: 'var(--stat-earth-icon)',
    accent: 'var(--stat-earth-accent)',
    accentSoft: 'var(--stat-earth-soft)',
  },
  forest: {
    halo: 'var(--stat-forest-halo)',
    iconShell: 'var(--stat-forest-icon-bg)',
    iconInset: 'var(--stat-forest-icon-inset)',
    iconColor: 'var(--stat-forest-icon)',
    accent: 'var(--stat-forest-accent)',
    accentSoft: 'var(--stat-forest-soft)',
  },
  plum: {
    halo: 'var(--stat-plum-halo)',
    iconShell: 'var(--stat-plum-icon-bg)',
    iconInset: 'var(--stat-plum-icon-inset)',
    iconColor: 'var(--stat-plum-icon)',
    accent: 'var(--stat-plum-accent)',
    accentSoft: 'var(--stat-plum-soft)',
  },
  copper: {
    halo: 'var(--stat-copper-halo)',
    iconShell: 'var(--stat-copper-icon-bg)',
    iconInset: 'var(--stat-copper-icon-inset)',
    iconColor: 'var(--stat-copper-icon)',
    accent: 'var(--stat-copper-accent)',
    accentSoft: 'var(--stat-copper-soft)',
  },
};

const trendToneStyles = {
  positive: {
    background: 'var(--success-soft)',
    border: 'var(--success-border)',
    color: 'var(--success-text)',
  },
  negative: {
    background: 'var(--danger-soft)',
    border: 'var(--danger-border)',
    color: 'var(--danger-text)',
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
          background: `${toneMeta.halo}, var(--surface-bg)`,
        }}
      />
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent 0%, var(--border-strong) 48%, transparent 100%)' }}
      />
      <div
        className="absolute inset-x-6 bottom-0 h-[2px] rounded-full"
        style={{ background: `linear-gradient(90deg, transparent 0%, ${toneMeta.accent} 20%, ${toneMeta.accent} 80%, transparent 100%)` }}
      />

      <div className="relative flex h-full flex-col p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-5 flex items-center justify-between gap-3">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">
                Panorama
              </p>
              {contextLabel && contextValue && (
                <div
                  className="rounded-full border px-3 py-1.5 text-[11px] font-semibold"
                  style={{
                    borderColor: 'var(--border-subtle)',
                    background: 'var(--bg-hover)',
                    color: 'var(--text-secondary)',
                    boxShadow: `inset 0 1px 0 ${toneMeta.accentSoft}`,
                  }}
                >
                  <span className="text-[var(--text-muted)]">{contextLabel}</span>{' '}
                  <span className="text-[var(--text-primary)]">{contextValue}</span>
                </div>
              )}
            </div>

            <p className="text-base font-semibold text-[var(--text-secondary)] sm:text-[1.05rem]">
              {label}
            </p>

            <div className="mt-5 flex items-end gap-2">
              {prefix && (
                <span className="pb-1 text-lg font-bold text-[var(--text-secondary)] sm:text-xl">
                  {prefix}
                </span>
              )}
              <p
                className="text-[2.15rem] font-black leading-none tracking-[-0.05em] sm:text-[2.55rem]"
                style={{ color: 'var(--text-primary)' }}
              >
                {formattedValue}
              </p>
              {suffix && (
                <span className="pb-1 text-base font-bold text-[var(--text-muted)] sm:text-lg">
                  {suffix}
                </span>
              )}
            </div>

            {subtitle && (
              <p className="mt-3 text-sm text-[var(--text-muted)]">
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
                <span className="text-xs text-[var(--text-muted)]">
                  vs. mês anterior
                </span>
              </div>
            )}
          </div>

          <div
            className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border sm:h-[4.5rem] sm:w-[4.5rem]"
            style={{
              borderColor: 'var(--border-default)',
              background: toneMeta.iconShell,
              boxShadow: `inset 0 1px 0 ${toneMeta.accentSoft}, var(--stat-icon-shadow)`,
            }}
          >
            <div
              className="absolute inset-[5px] rounded-xl border"
              style={{
                borderColor: 'var(--stat-icon-inset-border)',
                background: toneMeta.iconInset,
              }}
            />
            <Icon className="relative h-6 w-6 sm:h-7 sm:w-7" style={{ color: toneMeta.iconColor }} />
          </div>
        </div>

        <div
          className="mt-6 flex items-center justify-between gap-3 border-t pt-4"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
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
              style={{ color: 'var(--brand-primary)' }}
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
      <ActionSurface
        type="button"
        onClick={onClick}
        padding="none"
        className="panel-glass-panel panel-interactive-glass group relative h-full overflow-hidden"
      >
        {cardContent}
      </ActionSurface>
    );
  }

  return (
    <Surface padding="none" className="panel-glass-panel group relative h-full overflow-hidden transition-all duration-300">
      {cardContent}
    </Surface>
  );
}
