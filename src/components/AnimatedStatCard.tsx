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
      duration: prefix === 'R$' ? Math.max(0.45, microDuration + 0.48) : Math.max(0.38, microDuration + 0.36),
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
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-10 transition-opacity group-hover:opacity-20`} />

      <div className="relative p-4 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500 sm:text-sm sm:normal-case sm:tracking-normal">
              {label}
            </p>
            <div className="flex items-baseline gap-1">
                {prefix && <span className="text-xl font-bold text-slate-900 sm:text-2xl">{prefix}</span>}
                <p className="text-2xl font-bold text-slate-900 sm:text-3xl">
                  {formattedValue}
                </p>
                {suffix && <span className="text-base font-semibold text-slate-600 sm:text-lg">{suffix}</span>}
              </div>
            {subtitle && (
              <p className="mt-1 text-xs text-slate-500 sm:text-sm">{subtitle}</p>
            )}
            {trend && (
              <div className="mt-2 flex items-center gap-1 text-xs sm:text-sm">
                <span
                  className={`text-sm font-semibold ${
                    trend.isPositive ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value).toFixed(1)}%
                </span>
                <span className="text-xs text-slate-500">vs mês anterior</span>
              </div>
            )}
          </div>
          <div
            className={`${iconBg} rounded-xl p-3 shadow-sm transition-transform duration-300 group-hover:scale-110 sm:p-4`}
          >
            <Icon className="h-5 w-5 text-white sm:h-6 sm:w-6" />
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`panel-glass-panel panel-interactive-glass relative w-full overflow-hidden rounded-2xl border border-slate-200 text-left shadow-lg
        hover:shadow-xl hover:scale-105 transition-all duration-300 group focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-teal-500`}
      >
        {cardContent}
      </button>
    );
  }

  return (
    <div
      className={`panel-glass-panel panel-interactive-glass relative overflow-hidden rounded-2xl border border-slate-200 shadow-lg
        hover:shadow-xl hover:scale-105 transition-all duration-300 group`}
    >
      {cardContent}
    </div>
  );
}
