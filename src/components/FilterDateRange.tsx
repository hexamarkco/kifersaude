import { useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown } from 'lucide-react';
import { cx } from '../lib/cx';
import DateTimePicker from './ui/DateTimePicker';
import { getDropdownMenuClass, getDropdownTriggerClass, isPanelDarkTheme } from './ui/dropdownStyles';

export type FilterDateRangeProps = {
  icon: LucideIcon;
  label: string;
  fromValue: string;
  toValue: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  type?: 'date' | 'datetime-local';
};

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
  }, [fromValue, toValue]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasActiveFilter = Boolean(fromValue || toValue);
  const isDarkTheme = isPanelDarkTheme();

  const handleClear = () => {
    onFromChange('');
    onToChange('');
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={getDropdownTriggerClass({
          isDark: isDarkTheme,
          className: 'h-auto py-2.5',
        })}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <Icon
          className={cx(
            'absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2',
            isDarkTheme ? 'text-slate-500' : 'text-slate-400',
          )}
        />
        <div className="flex flex-col gap-0.5">
          <span
            className={cx(
              'text-xs font-semibold uppercase tracking-wide',
              isDarkTheme ? 'text-slate-400' : 'text-slate-500',
            )}
          >
            {label}
          </span>
          <span
            className={cx(
              'text-sm',
              hasActiveFilter
                ? isDarkTheme
                  ? 'text-slate-100'
                  : 'text-slate-700'
                : isDarkTheme
                  ? 'text-slate-400'
                  : 'text-slate-400',
            )}
          >
            {displayValue}
          </span>
        </div>
        <ChevronDown
          className={cx(
            'absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-transform',
            isDarkTheme ? 'text-slate-500' : 'text-slate-400',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen && (
        <div
          className={getDropdownMenuClass({
            isDark: isDarkTheme,
            position: 'absolute',
            className: 'left-0 right-0 mt-2 z-30 p-4 space-y-3',
          })}
          role="dialog"
          aria-label={`Selecionar intervalo de ${label}`}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={cx('flex flex-col gap-1 text-sm', isDarkTheme ? 'text-slate-300' : 'text-slate-600')}>
              <span className={cx('text-xs font-semibold uppercase tracking-wide', isDarkTheme ? 'text-slate-400' : 'text-slate-500')}>
                De
              </span>
              <DateTimePicker
                type={type}
                value={fromValue}
                onChange={onFromChange}
                placeholder={type === 'date' ? 'Selecionar data inicial' : 'Selecionar data e hora inicial'}
              />
            </label>
            <label className={cx('flex flex-col gap-1 text-sm', isDarkTheme ? 'text-slate-300' : 'text-slate-600')}>
              <span className={cx('text-xs font-semibold uppercase tracking-wide', isDarkTheme ? 'text-slate-400' : 'text-slate-500')}>
                Até
              </span>
              <DateTimePicker
                type={type}
                value={toValue}
                onChange={onToChange}
                placeholder={type === 'date' ? 'Selecionar data final' : 'Selecionar data e hora final'}
              />
            </label>
          </div>
          <div
            className={cx(
              'flex items-center justify-between border-t pt-2',
              isDarkTheme ? 'border-slate-700' : 'border-slate-100',
            )}
          >
            <button
              type="button"
              onClick={handleClear}
              className={cx(
                'text-sm font-medium',
                isDarkTheme ? 'text-teal-300 hover:text-teal-200' : 'text-teal-600 hover:text-teal-700',
              )}
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
