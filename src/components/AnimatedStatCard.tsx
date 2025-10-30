import { useEffect, useState } from 'react';
import { LucideIcon } from 'lucide-react';

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
}: AnimatedStatCardProps) {
  const [displayValue, setDisplayValue] = useState<number | string>(0);
  const isNumeric = typeof value === 'number';

  useEffect(() => {
    if (!isNumeric) {
      setDisplayValue(value);
      return;
    }

    const duration = 1000;
    const steps = 30;
    const increment = value / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current += increment;

      if (step >= steps) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value, isNumeric]);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl shadow-lg border border-slate-200
        hover:shadow-xl hover:scale-105 transition-all duration-300 group`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-5 group-hover:opacity-10 transition-opacity`} />

      <div className="relative p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-600 mb-1">{label}</p>
            <div className="flex items-baseline space-x-1">
              {prefix && <span className="text-2xl font-bold text-slate-900">{prefix}</span>}
              <p className="text-3xl font-bold text-slate-900">
                {isNumeric
                  ? displayValue.toLocaleString('pt-BR', {
                      minimumFractionDigits: prefix === 'R$' ? 2 : 0,
                      maximumFractionDigits: prefix === 'R$' ? 2 : 0,
                    })
                  : displayValue}
              </p>
              {suffix && <span className="text-lg font-semibold text-slate-600">{suffix}</span>}
            </div>
            {subtitle && (
              <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
            )}
            {trend && (
              <div className="mt-2 flex items-center space-x-1">
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
            className={`${iconBg} p-4 rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300`}
          >
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
