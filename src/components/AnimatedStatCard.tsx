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
    <div className="relative flex h-full min-h-[12rem] flex-col overflow-hidden p-5 sm:p-6">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: toneMeta.halo }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--border-strong)] to-transparent" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-lg)] border"
            style={{
              borderColor: 'var(--border-accent)',
              background: toneMeta.iconShell,
              boxShadow: `inset 0 1px 0 ${toneMeta.accentSoft}, var(--stat-icon-shadow)`,
            }}
          >
            <div
              className="absolute inset-1 rounded-[var(--radius-md)] border"
              style={{
                borderColor: 'var(--stat-icon-inset-border)',
                background: toneMeta.iconInset,
              }}
            />
            <Icon className="relative h-5 w-5" style={{ color: toneMeta.iconColor }} />
          </div>

          <div className="min-w-0 pt-0.5">
            <p className="truncate text-sm font-semibold leading-tight text-[var(--brand-primary-hover)]">
              {label}
            </p>
            {subtitle && (
              <p className="mt-1 truncate text-xs text-[var(--text-muted)]">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {contextLabel && contextValue && (
          <div
            className="shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold leading-none"
            style={{
              borderColor: 'var(--border-subtle)',
              background: 'var(--badge-neutral-bg)',
              color: 'var(--text-secondary)',
            }}
          >
            <span className="text-[var(--text-muted)]">{contextLabel}</span>{' '}
            <span className="text-[var(--text-primary)]">{contextValue}</span>
          </div>
        )}
      </div>

      <div className="relative mt-6 flex items-end gap-2">
        {prefix && (
          <span className="pb-1 text-sm font-semibold text-[var(--text-secondary)]">
            {prefix}
          </span>
        )}
        <p className="text-3xl font-semibold leading-none tracking-[-0.04em] text-[var(--text-primary)] sm:text-[2rem]">
          {formattedValue}
        </p>
        {suffix && (
          <span className="pb-1 text-sm font-semibold text-[var(--text-muted)]">
            {suffix}
          </span>
        )}
      </div>

      {trend && trendTone && (
        <div className="relative mt-4 flex items-center gap-2">
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

      <div className="relative mt-auto border-t border-[var(--border-subtle)] pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-xs text-[var(--text-muted)]">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{
                background: toneMeta.accent,
                boxShadow: `0 0 0 5px ${toneMeta.accentSoft}`,
              }}
            />
            <span className="truncate">{footerLabel || 'Ver detalhes'}</span>
          </div>
          {onClick && (
            <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--brand-primary-hover)]">
              Abrir
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (onClick) {
    return (
      <ActionSurface
        type="button"
        onClick={onClick}
        padding="none"
        className="group h-full overflow-hidden"
      >
        {cardContent}
      </ActionSurface>
    );
  }

  return (
    <Surface padding="none" className="group h-full overflow-hidden">
      {cardContent}
    </Surface>
  );
}
