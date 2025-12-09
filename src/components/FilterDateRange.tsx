import { useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown } from 'lucide-react';

export type FilterDateRangeProps = {
  icon: LucideIcon;
  label: string;
  fromValue: string;
  toValue: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  type?: 'date' | 'datetime-local';
};

const dropdownClasses =
  'absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg z-30 p-4 space-y-3';

export default function FilterDateRange({
  icon: Icon,
  label,
  fromValue,
  toValue,
  onFromChange,
  onToChange,
  type = 'date',
}: FilterDateRangeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const formatValue = (value: string) => {
    if (!value) return '';

    const baseDate = type === 'date' ? `${value}T00:00:00` : value;
    const parsed = new Date(baseDate);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });
    const timeFormatter = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (type === 'date') {
      return dateFormatter.format(parsed);
    }

    return `${dateFormatter.format(parsed)} ${timeFormatter.format(parsed)}`;
  };

  const displayValue = useMemo(() => {
    if (!fromValue && !toValue) {
      return 'Qualquer data';
    }

    if (fromValue && toValue) {
      return `${formatValue(fromValue)} — ${formatValue(toValue)}`;
    }

    if (fromValue) {
      return `A partir de ${formatValue(fromValue)}`;
    }

    return `Até ${formatValue(toValue)}`;
  }, [fromValue, toValue]);

  const hasActiveFilter = Boolean(fromValue || toValue);

  const handleClear = () => {
    onFromChange('');
    onToChange('');
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="relative w-full py-2 pl-10 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-left"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
          <span className={`text-sm ${hasActiveFilter ? 'text-slate-700' : 'text-slate-400'}`}>{displayValue}</span>
        </div>
        <ChevronDown
          className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className={dropdownClasses} role="dialog" aria-label={`Selecionar intervalo de ${label}`}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col text-sm text-slate-600 gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">De</span>
              <input
                type={type}
                value={fromValue}
                onChange={(event) => onFromChange(event.target.value)}
                className="w-full h-11 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </label>
            <label className="flex flex-col text-sm text-slate-600 gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Até</span>
              <input
                type={type}
                value={toValue}
                onChange={(event) => onToChange(event.target.value)}
                className="w-full h-11 px-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </label>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClear}
              className="text-sm font-medium text-teal-600 hover:text-teal-700"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1.5 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700"
            >
              Concluído
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
