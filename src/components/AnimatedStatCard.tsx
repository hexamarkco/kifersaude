import { useEffect, useMemo, useRef, useState } from 'react';
import { Minus, TrendingUp, type LucideIcon } from 'lucide-react';
import { gsap } from 'gsap';
import { usePanelMotion } from '../hooks/usePanelMotion';
import { Surface } from '../design-system';

type AnimatedStatCardTone = 'brand' | 'earth' | 'forest' | 'plum' | 'copper';

type AnimatedStatCardProps = {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: AnimatedStatCardTone;
  prefix?: string;
  suffix?: string;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
};

const toneStyles: Record<
  AnimatedStatCardTone,
  {
    halo: string;
    iconColor: string;
    accent: string;
    accentSoft: string;
  }
> = {
  brand: {
    halo: 'var(--stat-brand-halo)',
    iconColor: 'var(--stat-brand-icon)',
    accent: 'var(--stat-brand-accent)',
    accentSoft: 'var(--stat-brand-soft)',
  },
  earth: {
    halo: 'var(--stat-earth-halo)',
    iconColor: 'var(--stat-earth-icon)',
    accent: 'var(--stat-earth-accent)',
    accentSoft: 'var(--stat-earth-soft)',
  },
  forest: {
    halo: 'var(--stat-forest-halo)',
    iconColor: 'var(--stat-forest-icon)',
    accent: 'var(--stat-forest-accent)',
    accentSoft: 'var(--stat-forest-soft)',
  },
  plum: {
    halo: 'var(--stat-plum-halo)',
    iconColor: 'var(--stat-plum-icon)',
    accent: 'var(--stat-plum-accent)',
    accentSoft: 'var(--stat-plum-soft)',
  },
  copper: {
    halo: 'var(--stat-copper-halo)',
    iconColor: 'var(--stat-copper-icon)',
    accent: 'var(--stat-copper-accent)',
    accentSoft: 'var(--stat-copper-soft)',
  },
};

const trendToneStyles = {
  positive: {
    color: 'var(--success-text)',
  },
  negative: {
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
  trend,
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
  const formattedValueText = String(formattedValue);
  const splitValueMatch = formattedValueText.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
  const splitCurrentValue = splitValueMatch ? Number(splitValueMatch[1]) : null;
  const splitTotalValue = splitValueMatch ? Number(splitValueMatch[2]) : null;
  const splitProgress = splitCurrentValue !== null && splitTotalValue && splitTotalValue > 0
    ? Math.min(100, Math.max(0, (splitCurrentValue / splitTotalValue) * 100))
    : 0;
  const shellStyle = {
    borderColor: toneMeta.accent,
  };
  const numericValueClassName = prefix === 'R$'
    ? 'max-w-full text-[clamp(2.35rem,2.75vw,3rem)] font-semibold leading-none tracking-[-0.055em] text-[var(--text-primary)] tabular-nums'
    : 'max-w-full text-[clamp(2.7rem,3.35vw,3.55rem)] font-semibold leading-none tracking-[-0.06em] text-[var(--text-primary)] tabular-nums';

  const cardContent = (
    <div className="relative flex h-full min-h-[15.5rem] flex-col overflow-hidden p-5 sm:p-6">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: toneMeta.halo }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--border-strong)] to-transparent" />

      <div className="relative flex h-[4.75rem] items-start gap-4">
        <div className="flex min-w-0 items-start gap-3.5">
          <div className="relative shrink-0">
            <div
              className="relative flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] border"
              style={{
                borderColor: toneMeta.accentSoft,
                background: 'transparent',
                boxShadow: `0 10px 24px -20px ${toneMeta.accent}`,
              }}
            >
              <Icon className="h-6 w-6" strokeWidth={1.75} style={{ color: toneMeta.iconColor }} />
            </div>
          </div>

          <div className="min-w-0 pt-0.5">
            <p className="text-[1.05rem] font-bold leading-tight" style={{ color: toneMeta.iconColor }}>
              {label}
            </p>
            {subtitle && (
              <p className="mt-1.5 text-[0.8125rem] leading-snug text-[var(--text-secondary)]">
                {subtitle}
              </p>
            )}
          </div>
        </div>

      </div>

      <div className="relative mt-4 min-h-[5.875rem] min-w-0">
        {splitValueMatch ? (
          <>
            <div className="flex min-w-0 items-end gap-2.5">
              <span className="text-[clamp(3rem,3.65vw,3.85rem)] font-semibold leading-none tracking-[-0.06em] text-[var(--text-primary)] tabular-nums">
                {splitCurrentValue}
              </span>
              <span className="pb-1.5 text-[clamp(2.35rem,2.85vw,3rem)] font-semibold leading-none tracking-[-0.05em] text-[var(--text-subtle)]">
                /
              </span>
              <span className="text-[clamp(2.35rem,2.85vw,3rem)] font-semibold leading-none tracking-[-0.05em] tabular-nums" style={{ color: toneMeta.iconColor }}>
                {splitTotalValue}
              </span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--bg-hover)]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${splitProgress}%`,
                  background: `linear-gradient(90deg, ${toneMeta.iconColor} 0%, ${toneMeta.accent} 100%)`,
                  boxShadow: `0 0 18px ${toneMeta.accentSoft}`,
                }}
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex min-w-0 items-end gap-2.5 overflow-visible">
              {prefix && (
                <span className="pb-1.5 text-[clamp(1.1rem,1.35vw,1.5rem)] font-semibold text-[var(--text-secondary)]">
                  {prefix}
                </span>
              )}
              <p className={numericValueClassName}>
                {formattedValue}
              </p>
              {suffix && (
                <span className="pb-1.5 text-[clamp(1.4rem,1.85vw,2rem)] font-semibold text-[var(--text-primary)]">
                  {suffix}
                </span>
              )}
            </div>
            <p className="mt-3 text-sm font-medium text-[var(--text-muted)]">
              {label.toLocaleLowerCase('pt-BR')}
            </p>
          </>
        )}
      </div>

      <div className="relative mt-4 flex min-h-5 items-center gap-2">
        {trend && trendTone ? (
          <>
            <span
              className="inline-flex items-center gap-1.5 text-sm font-semibold"
              style={{
                color: trendTone.color,
              }}
            >
              <TrendingUp className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              {trend.isPositive ? '+' : '-'} {Math.abs(trend.value).toFixed(1)}%
            </span>
            <span className="text-sm text-[var(--text-secondary)]">
              vs mês anterior
            </span>
          </>
        ) : !splitValueMatch ? (
          <>
            <span
              className="inline-flex items-center gap-1.5 text-sm font-semibold"
              style={{
                color: toneMeta.iconColor,
              }}
            >
              <Minus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              0%
            </span>
            <span className="text-sm text-[var(--text-secondary)]">
              vs mês anterior
            </span>
          </>
        ) : null}
      </div>

      <div className="relative mt-auto h-px bg-[var(--border-subtle)]" />
    </div>
  );

  return (
    <Surface padding="none" className="group h-full overflow-hidden" style={shellStyle}>
      {cardContent}
    </Surface>
  );
}
